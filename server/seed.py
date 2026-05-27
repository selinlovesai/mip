"""
Database seeding — populate baseline catalogs on first boot, idempotently.

For each `server/seed/<collection>.json` whose collection is in the allowlist,
seed its rows **only when that collection is currently empty**. This gives a
fresh database the same starter content the frontend used to hold in
localStorage (e.g. the Overview / Marketing dashboards) without ever clobbering
data a user has already created — re-running on a populated collection is a
no-op.

Seed file format: a JSON array of `{"id": "<id>", "data": { ... }}` objects,
matching the shape the CRUD routes return (`records.data` = the document).

Adding a seed: drop `<collection>.json` in `server/seed/` (collection must be
in `db.COLLECTIONS`). Keep the data in sync with the frontend source of truth
noted in each file's companion comment.

Two seeding policies:
  · Generic collections (`seed_if_empty`) — whole documents are user-owned, so
    we seed only when the collection is EMPTY (never partially overwrite).
  · Typed tokens (`seed_tokens`) — individual rows, so we BACKFILL missing
    (name, mode) rows on every boot. This auto-adds tokens introduced later
    (e.g. --color-chart-*) without clobbering edited values.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine

import db

SEED_DIR = Path(__file__).parent / "seed"
# Typed-token seed lives OUTSIDE SEED_DIR so the generic records seeder never
# tries to load it. Generated from theme.css by tools/extract_theme_tokens.py.
TOKENS_SEED = Path(__file__).parent / "tokens.seed.json"
# Catalogs whose canonical JSON lives in the frontend data dir (the SAME files
# the app imports), so the DB seed and the app share one source of truth — no
# regenerated copies. Each is a { "<key>": [ {id-bearing object}, … ] } doc.
DATA_DIR = Path(__file__).parent.parent / "src" / "mip" / "data"
WIDGET_TYPES_SEED = DATA_DIR / "widget-types.json"
APPS_SEED = DATA_DIR / "apps.json"
TEMPLATES_SEED = DATA_DIR / "templates.json"
COMPONENTS_SEED = DATA_DIR / "components.json"


def _load_seed_files() -> dict[str, list[dict[str, Any]]]:
    """Read every <collection>.json in SEED_DIR. Skips unknown collections and
    malformed files (logged) so one bad file can't block startup."""
    out: dict[str, list[dict[str, Any]]] = {}
    if not SEED_DIR.is_dir():
        return out
    for path in sorted(SEED_DIR.glob("*.json")):
        collection = path.stem
        if collection not in db.COLLECTIONS:
            print(f"[seed] skip {path.name}: '{collection}' is not an allowed collection")
            continue
        try:
            items = json.loads(path.read_text())
        except Exception as exc:  # noqa: BLE001 - never let a bad seed crash boot
            print(f"[seed] skip {path.name}: invalid JSON ({exc})")
            continue
        if not isinstance(items, list):
            print(f"[seed] skip {path.name}: expected a JSON array")
            continue
        out[collection] = items
    return out


async def seed_if_empty(engine: AsyncEngine) -> dict[str, int]:
    """Seed each collection that has a seed file AND is currently empty. Returns
    {collection: rows_seeded} for collections actually seeded this run."""
    seeds = _load_seed_files()
    seeded: dict[str, int] = {}
    for collection, items in seeds.items():
        async with engine.connect() as conn:
            count = (
                await conn.execute(
                    select(func.count()).select_from(db.records).where(db.records.c.collection == collection)
                )
            ).scalar_one()
        if count:
            continue  # already has data — don't clobber
        n = 0
        for item in items:
            rid = item.get("id")
            if not rid:
                print(f"[seed] {collection}: skipping item with no id")
                continue
            await db.upsert_record(collection, str(rid), item.get("data", {}))
            n += 1
        if n:
            seeded[collection] = n
            print(f"[seed] {collection}: seeded {n} record(s)")
    return seeded


async def seed_tokens(engine: AsyncEngine) -> int:
    """Backfill the typed `tokens` table from tokens.seed.json: insert any
    (name, mode) row that isn't already present, and NEVER overwrite an existing
    one. This both populates a fresh DB and backfills new tokens added to the
    seed later (e.g. --color-chart-*) without clobbering user edits. Returns the
    number of rows inserted this run."""
    if not TOKENS_SEED.is_file():
        return 0
    try:
        rows = json.loads(TOKENS_SEED.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] tokens skipped: invalid {TOKENS_SEED.name} ({exc})")
        return 0
    existing = {(t["name"], t["mode"]) for t in await db.list_tokens()}
    n = 0
    for r in rows:
        name, mode, value = r.get("name"), r.get("mode"), r.get("value")
        if not (name and mode and value is not None):
            continue
        if (name, mode) in existing:
            continue  # already there — leave it (could be an edit)
        await db.upsert_token(str(name), str(mode), str(value), r.get("kind", "color"), r.get("group", ""))
        n += 1
    if n:
        print(f"[seed] tokens: backfilled {n} new token row(s)")
    return n


async def _seed_catalog(engine: AsyncEngine, collection: str, path: Path, key: str, id_field: str) -> int:
    """Seed a frontend-canonical catalog JSON ({ "<key>": [ … ] }) into a records
    collection, one row per item keyed by `id_field`. Seed-if-empty: never
    clobbers edits. Returns rows seeded this run."""
    if not path.is_file():
        return 0
    async with engine.connect() as conn:
        count = (
            await conn.execute(select(func.count()).select_from(db.records).where(db.records.c.collection == collection))
        ).scalar_one()
    if count:
        return 0  # already populated — don't clobber
    try:
        doc = json.loads(path.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] {collection} skipped: invalid {path.name} ({exc})")
        return 0
    items = doc.get(key) if isinstance(doc, dict) else doc
    if not isinstance(items, list):
        print(f"[seed] {collection} skipped: expected a {{{key}:[…]}} object or array")
        return 0
    n = 0
    for entry in items:
        rid = entry.get(id_field) if isinstance(entry, dict) else None
        if not rid:
            continue
        await db.upsert_record(collection, str(rid), entry)
        n += 1
    if n:
        print(f"[seed] {collection}: seeded {n} row(s)")
    return n


async def seed_widget_types(engine: AsyncEngine) -> int:
    return await _seed_catalog(engine, "widget_types", WIDGET_TYPES_SEED, "types", "type")


async def seed_apps(engine: AsyncEngine) -> int:
    return await _seed_catalog(engine, "apps", APPS_SEED, "apps", "id")


async def seed_templates(engine: AsyncEngine) -> int:
    return await _seed_catalog(engine, "templates", TEMPLATES_SEED, "templates", "id")


async def seed_components(engine: AsyncEngine) -> int:
    return await _seed_catalog(engine, "components", COMPONENTS_SEED, "components", "id")
