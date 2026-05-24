"""
Postgres persistence layer for the MIP-Tailwind backend.

Design — a single generic *document store* table, `records`, keyed by
`(collection, id)` with a `jsonb` payload. One table backs every entity the app
persists (dashboards, connections, settings, tokens, components, apps,
conversations, themes, templates, users), so the frontend can move off
localStorage onto the DB without a migration per entity. First-class typed
tables (e.g. dedicated `tokens`/`components` with referential columns) can be
introduced later behind the same CRUD surface.

Graceful degradation: if `DATABASE_URL` is unset or the DB is unreachable, the
backend stays up and the CRUD routes report `db: false` so the frontend falls
back to its localStorage cache (mirrors mip's degrade-to-503 behavior).

Env:
  DATABASE_URL   e.g. postgresql+asyncpg://localhost/mip_tailwind
                 (a plain postgres:// URL is auto-rewritten to the asyncpg driver)
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Column, DateTime, MetaData, String, Table, delete, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

DEFAULT_URL = "postgresql+asyncpg://localhost/mip_tailwind"

# Collections the app is allowed to read/write. Acts as a light allowlist so an
# arbitrary path segment can't create unbounded tables-by-convention.
COLLECTIONS = {
    "dashboards",
    "connections",
    "settings",
    "tokens",
    "components",
    "apps",
    "conversations",
    "themes",
    "templates",
    "users",
    "access_tokens",
}

metadata = MetaData()

records = Table(
    "records",
    metadata,
    Column("collection", String, primary_key=True),
    Column("id", String, primary_key=True),
    Column("data", JSONB, nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

_engine: AsyncEngine | None = None


def _normalize_url(url: str) -> str:
    # Accept plain postgres:// and upgrade it to the asyncpg driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    return url


def is_enabled() -> bool:
    return _engine is not None


async def init_db() -> bool:
    """Create the engine + ensure the schema exists. Returns True on success."""
    global _engine
    url = _normalize_url(os.environ.get("DATABASE_URL", DEFAULT_URL))
    try:
        engine = create_async_engine(url, pool_pre_ping=True, future=True)
        async with engine.begin() as conn:
            await conn.run_sync(metadata.create_all)
        _engine = engine
        return True
    except Exception as exc:  # noqa: BLE001 - degrade gracefully
        print(f"[db] disabled — could not connect ({exc.__class__.__name__}: {exc})")
        _engine = None
        return False


async def dispose() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


def _require_engine() -> AsyncEngine:
    if _engine is None:
        raise RuntimeError("database not configured")
    return _engine


async def list_records(collection: str) -> list[dict[str, Any]]:
    engine = _require_engine()
    async with engine.connect() as conn:
        rows = (await conn.execute(select(records).where(records.c.collection == collection))).all()
    return [{"id": r.id, "data": r.data, "updatedAt": r.updated_at.isoformat()} for r in rows]


async def get_record(collection: str, rid: str) -> dict[str, Any] | None:
    engine = _require_engine()
    async with engine.connect() as conn:
        row = (
            await conn.execute(
                select(records).where(records.c.collection == collection, records.c.id == rid)
            )
        ).first()
    if row is None:
        return None
    return {"id": row.id, "data": row.data, "updatedAt": row.updated_at.isoformat()}


async def upsert_record(collection: str, rid: str, data: Any) -> dict[str, Any]:
    engine = _require_engine()
    now = datetime.now(timezone.utc)
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    stmt = pg_insert(records).values(collection=collection, id=rid, data=data, updated_at=now)
    stmt = stmt.on_conflict_do_update(
        index_elements=[records.c.collection, records.c.id],
        set_={"data": data, "updated_at": now},
    )
    async with engine.begin() as conn:
        await conn.execute(stmt)
    return {"id": rid, "data": data, "updatedAt": now.isoformat()}


async def delete_record(collection: str, rid: str) -> bool:
    engine = _require_engine()
    async with engine.begin() as conn:
        result = await conn.execute(
            delete(records).where(records.c.collection == collection, records.c.id == rid)
        )
    return (result.rowcount or 0) > 0
