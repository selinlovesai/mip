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


async def test_seed_files_reference_known_collections():
    # Guards against a seed file for a collection the allowlist doesn't permit.
    for collection in seed._load_seed_files():
        assert collection in db.COLLECTIONS
