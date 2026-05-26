"""
Schema migrations — a tiny, ordered, idempotent migration runner.

Replaces bare `metadata.create_all` so schema evolution is *tracked* and
*repeatable*: every change is a numbered step recorded in `schema_migrations`,
applied in order, exactly once. This is the seam that lets the next milestone
(typed `tokens` / `components` tables) land as migration 0002+ without manual
DDL or clobbering an existing database.

Design:
  - `schema_migrations(version TEXT PK, applied_at TIMESTAMPTZ)` tracks what ran.
  - `MIGRATIONS` is an ordered list of (version, sql) steps. Each step's SQL is
    written to be safe to run against a database that predates the runner (e.g.
    `CREATE TABLE IF NOT EXISTS`), so adopting migrations on an existing deploy
    is a no-op that simply backfills the ledger.
  - `apply_migrations(conn)` runs inside the caller's transaction.

To add a migration: append a new (version, sql) tuple with the next number.
Never edit or reorder an already-released step — add a new one.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# Ordered migration steps. version strings sort lexicographically, so zero-pad.
MIGRATIONS: list[tuple[str, str]] = [
    (
        "0001_records",
        """
        CREATE TABLE IF NOT EXISTS records (
            collection TEXT NOT NULL,
            id         TEXT NOT NULL,
            data       JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (collection, id)
        );
        """,
    ),
    (
        # Speeds up the list-by-collection query (the common read path).
        "0002_records_collection_idx",
        "CREATE INDEX IF NOT EXISTS records_collection_idx ON records (collection);",
    ),
    (
        # First typed table (directive #2): every design token is a first-class
        # row. (name, mode) is unique — a token has at most one light + one dark
        # value. `value` is verbatim CSS (literal color or a var(--…) reference);
        # `kind` ('color' for now) + `token_group` drive the Appearance browser.
        "0003_tokens",
        """
        CREATE TABLE IF NOT EXISTS tokens (
            name        TEXT NOT NULL,
            mode        TEXT NOT NULL,
            value       TEXT NOT NULL,
            kind        TEXT NOT NULL DEFAULT 'color',
            token_group TEXT NOT NULL DEFAULT '',
            updated_at  TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (name, mode)
        );
        """,
    ),
    (
        "0004_tokens_kind_idx",
        "CREATE INDEX IF NOT EXISTS tokens_kind_idx ON tokens (kind);",
    ),
]


async def apply_migrations(conn: AsyncConnection) -> list[str]:
    """Apply any not-yet-applied migrations in order. Returns the versions that
    were applied this run (empty when already up to date). Idempotent."""
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version    TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
    )
    applied = set(
        (await conn.execute(text("SELECT version FROM schema_migrations"))).scalars().all()
    )
    ran: list[str] = []
    for version, sql in MIGRATIONS:
        if version in applied:
            continue
        await conn.execute(text(sql))
        await conn.execute(
            text("INSERT INTO schema_migrations (version) VALUES (:v)"), {"v": version}
        )
        ran.append(version)
    return ran
