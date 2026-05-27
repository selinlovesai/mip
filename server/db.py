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
    "widget_types",
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

# First typed table (directive #2) — design tokens. Created by migration 0003,
# defined here so the CRUD accessors below can query it via SQLAlchemy core.
tokens = Table(
    "tokens",
    metadata,
    Column("name", String, primary_key=True),
    Column("mode", String, primary_key=True),  # 'light' | 'dark'
    Column("value", String, nullable=False),
    Column("kind", String, nullable=False, default="color"),
    Column("token_group", String, nullable=False, default=""),
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
    """Create the engine, run pending migrations, and seed empty collections.
    Returns True on success; on any failure the backend degrades to db-disabled
    (frontend falls back to its localStorage cache) rather than crashing."""
    global _engine
    import migrations
    import seed

    url = _normalize_url(os.environ.get("DATABASE_URL", DEFAULT_URL))
    try:
        engine = create_async_engine(url, pool_pre_ping=True, future=True)
        async with engine.begin() as conn:
            ran = await migrations.apply_migrations(conn)
        if ran:
            print(f"[db] applied migrations: {', '.join(ran)}")
        _engine = engine
        # Seed AFTER the engine is published (seed.py uses the module-level CRUD).
        try:
            await seed.seed_if_empty(engine)
            await seed.seed_tokens(engine)
            await seed.seed_widget_types(engine)
            await seed.seed_apps(engine)
            await seed.seed_templates(engine)
            await seed.seed_components(engine)
        except Exception as exc:  # noqa: BLE001 - seeding is best-effort
            print(f"[db] seed skipped ({exc.__class__.__name__}: {exc})")
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


# ---------------------------------------------------------------------------
# Typed tokens table (directive #2)
# ---------------------------------------------------------------------------

def _token_row(r: Any) -> dict[str, Any]:
    return {"name": r.name, "mode": r.mode, "value": r.value, "kind": r.kind, "group": r.token_group, "updatedAt": r.updated_at.isoformat()}


async def list_tokens(kind: str | None = None) -> list[dict[str, Any]]:
    """All tokens, optionally filtered by kind (e.g. 'color'), ordered for stable
    rendering (group, then name, then mode)."""
    engine = _require_engine()
    stmt = select(tokens)
    if kind:
        stmt = stmt.where(tokens.c.kind == kind)
    stmt = stmt.order_by(tokens.c.token_group, tokens.c.name, tokens.c.mode)
    async with engine.connect() as conn:
        rows = (await conn.execute(stmt)).all()
    return [_token_row(r) for r in rows]


async def count_tokens() -> int:
    engine = _require_engine()
    from sqlalchemy import func

    async with engine.connect() as conn:
        return (await conn.execute(select(func.count()).select_from(tokens))).scalar_one()


async def upsert_token(name: str, mode: str, value: str, kind: str = "color", group: str = "") -> dict[str, Any]:
    engine = _require_engine()
    now = datetime.now(timezone.utc)
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    stmt = pg_insert(tokens).values(name=name, mode=mode, value=value, kind=kind, token_group=group, updated_at=now)
    # On edit, update the value/kind/group but keep the (name, mode) identity.
    stmt = stmt.on_conflict_do_update(
        index_elements=[tokens.c.name, tokens.c.mode],
        set_={"value": value, "kind": kind, "token_group": group, "updated_at": now},
    )
    async with engine.begin() as conn:
        await conn.execute(stmt)
    return {"name": name, "mode": mode, "value": value, "kind": kind, "group": group, "updatedAt": now.isoformat()}
