"""
Integration tests for the persistence foundation: migrations, generic CRUD, and
idempotent seeding. These run against a real Postgres (the migration ledger and
ON CONFLICT upserts are Postgres-specific), so they target a dedicated test
database and are SKIPPED when it's unreachable — keeping a DB-less checkout
green.

  TEST_DATABASE_URL  defaults to postgresql+asyncpg://localhost/mip_tailwind_test
  Create it once:    createdb mip_tailwind_test
  Run:               .venv/bin/pytest         (from server/)
"""

from __future__ import annotations

import os

import pytest
from sqlalchemy import text

import db
import emit
import migrations
import seed

TEST_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://localhost/mip_tailwind_test")


@pytest.fixture(autouse=True)
async def fresh_db():
    """Point the module at the test DB, start from an empty schema each test."""
    os.environ["DATABASE_URL"] = TEST_URL
    if not await db.init_db():
        pytest.skip("test database unreachable")
    engine = db._require_engine()
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE records"))
        await conn.execute(text("TRUNCATE tokens"))
        await conn.execute(text("TRUNCATE schema_migrations"))
        await migrations.apply_migrations(conn)  # repopulate the ledger
    yield engine
    await db.dispose()


async def test_migrations_are_idempotent(fresh_db):
    # Ledger is fully populated by the fixture → a second run applies nothing.
    async with fresh_db.begin() as conn:
        ran = await migrations.apply_migrations(conn)
    assert ran == []
    async with fresh_db.connect() as conn:
        versions = (await conn.execute(text("SELECT version FROM schema_migrations ORDER BY version"))).scalars().all()
    assert [v for v, _ in migrations.MIGRATIONS] == list(versions)


async def test_crud_roundtrip(fresh_db):
    assert await db.list_records("settings") == []

    rec = await db.upsert_record("settings", "app", {"theme": "dark", "n": 1})
    assert rec["data"]["theme"] == "dark"

    got = await db.get_record("settings", "app")
    assert got is not None and got["data"]["n"] == 1

    # Upsert on the same id updates in place (no duplicate row).
    await db.upsert_record("settings", "app", {"theme": "light", "n": 2})
    rows = await db.list_records("settings")
    assert len(rows) == 1 and rows[0]["data"] == {"theme": "light", "n": 2}

    assert await db.delete_record("settings", "app") is True
    assert await db.delete_record("settings", "app") is False
    assert await db.get_record("settings", "app") is None


async def test_seed_seeds_empty_then_is_noop(fresh_db):
    # Empty collection → seeds the starter dashboards from seed/dashboards.json.
    result = await seed.seed_if_empty(fresh_db)
    assert result.get("dashboards") == 2
    rows = await db.list_records("dashboards")
    assert {r["id"] for r in rows} == {"overview", "marketing"}
    overview = await db.get_record("dashboards", "overview")
    assert overview is not None and overview["data"]["title"] == "Overview"
    assert len(overview["data"]["widgets"]) == 8

    # A user edits a seeded record, then a later boot re-runs seeding.
    await db.upsert_record("dashboards", "overview", {"title": "My Overview", "widgets": []})
    second = await seed.seed_if_empty(fresh_db)
    assert "dashboards" not in second  # non-empty → skipped, not clobbered
    edited = await db.get_record("dashboards", "overview")
    assert edited is not None and edited["data"]["title"] == "My Overview"


def test_emit_json_and_css_are_pure():
    rows = [
        {"name": "--color-brand-600", "mode": "light", "value": "rgb(127 86 217)", "kind": "color", "group": "Brand"},
        {"name": "--color-brand-600", "mode": "dark", "value": "rgb(158 119 237)", "kind": "color", "group": "Brand"},
        {"name": "--radius-md", "mode": "light", "value": "0.375rem", "kind": "radius", "group": "Radius"},
    ]
    j = emit.emit_json(rows)
    assert j["light"]["--color-brand-600"] == "rgb(127 86 217)"
    assert j["light"]["--radius-md"] == "0.375rem"
    assert j["dark"]["--color-brand-600"] == "rgb(158 119 237)"

    css = emit.emit_css(rows)
    assert "@theme {" in css
    assert "--color-brand-600: rgb(127 86 217);" in css
    assert ".dark-mode {" in css
    assert "--color-brand-600: rgb(158 119 237);" in css
    # A mode with no rows emits no dark block.
    assert ".dark-mode" not in emit.emit_css([rows[2]])

    # Runtime scope swaps @theme → :root (so the SPA can inject it live).
    root_css = emit.emit_css(rows, scope="root")
    assert ":root {" in root_css and "@theme" not in root_css
    assert "--color-brand-600: rgb(127 86 217);" in root_css and ".dark-mode {" in root_css


async def test_emit_roundtrips_seeded_tokens(fresh_db):
    await seed.seed_tokens(fresh_db)
    rows = await db.list_tokens()
    css = emit.emit_css(rows)
    assert "--color-brand-600:" in css
    j = emit.emit_json(rows)
    # Every kind we seed shows up in the light map.
    kinds = {r["kind"] for r in rows}
    assert {"color", "radius", "shadow", "typography"} <= kinds
    assert "--shadow-md" in j["light"] or "--shadow-md" in j["dark"]


async def test_seed_files_reference_known_collections():
    # Guards against a seed file for a collection the allowlist doesn't permit.
    for collection in seed._load_seed_files():
        assert collection in db.COLLECTIONS


async def test_tokens_crud_roundtrip(fresh_db):
    assert await db.count_tokens() == 0
    await db.upsert_token("--color-brand-600", "light", "rgb(127 86 217)", "color", "Brand")
    await db.upsert_token("--color-brand-600", "dark", "rgb(158 119 237)", "color", "Brand")

    rows = await db.list_tokens(kind="color")
    assert len(rows) == 2
    light = next(r for r in rows if r["mode"] == "light")
    assert light["value"] == "rgb(127 86 217)" and light["group"] == "Brand"

    # Editing keeps (name, mode) identity — no duplicate row.
    await db.upsert_token("--color-brand-600", "light", "rgb(0 0 0)", "color", "Brand")
    rows = await db.list_tokens()
    assert len(rows) == 2
    assert next(r for r in rows if r["mode"] == "light")["value"] == "rgb(0 0 0)"


async def test_tokens_seed_backfills_then_noop(fresh_db):
    n = await seed.seed_tokens(fresh_db)
    assert n > 0  # populated from tokens.seed.json (generated from theme.css)
    total = await db.count_tokens()
    assert total == n

    # A known token resolved from the seed.
    brand = [r for r in await db.list_tokens() if r["name"] == "--color-brand-600" and r["mode"] == "light"]
    assert brand and brand[0]["value"].startswith("rgb(")

    # Re-seeding a fully-populated table inserts nothing and never clobbers edits.
    await db.upsert_token("--color-brand-600", "light", "rgb(1 2 3)", "color", "Brand")
    assert await seed.seed_tokens(fresh_db) == 0
    edited = [r for r in await db.list_tokens() if r["name"] == "--color-brand-600" and r["mode"] == "light"]
    assert edited[0]["value"] == "rgb(1 2 3)"


async def test_tokens_seed_backfills_missing_only(fresh_db):
    await seed.seed_tokens(fresh_db)
    # Simulate a DB seeded before a token was added: drop one row.
    async with fresh_db.begin() as conn:
        await conn.execute(text("DELETE FROM tokens WHERE name = '--color-brand-600' AND mode = 'light'"))
    before = await db.count_tokens()

    # Re-seeding backfills exactly the missing row, leaving everything else.
    assert await seed.seed_tokens(fresh_db) == 1
    assert await db.count_tokens() == before + 1
    restored = [r for r in await db.list_tokens() if r["name"] == "--color-brand-600" and r["mode"] == "light"]
    assert restored and restored[0]["value"].startswith("rgb(")
