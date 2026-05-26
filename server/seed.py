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


async def seed_tokens_if_empty(engine: AsyncEngine) -> int:
    """Seed the typed `tokens` table from tokens.seed.json, but only when it's
    empty (never clobbers edited tokens). Returns the number of rows seeded."""
    if not TOKENS_SEED.is_file():
        return 0
    if await db.count_tokens():
        return 0  # already populated — leave user edits alone
    try:
        rows = json.loads(TOKENS_SEED.read_text())
    except Exception as exc:  # noqa: BLE001
        print(f"[seed] tokens skipped: invalid {TOKENS_SEED.name} ({exc})")
        return 0
    n = 0
    for r in rows:
        name, mode, value = r.get("name"), r.get("mode"), r.get("value")
        if not (name and mode and value is not None):
            continue
        await db.upsert_token(str(name), str(mode), str(value), r.get("kind", "color"), r.get("group", ""))
        n += 1
    if n:
        print(f"[seed] tokens: seeded {n} token row(s)")
    return n
