"""
Token emit pipeline (directive #2) — compile the DB `tokens` table into the two
artifacts the app + Tailwind consume:

  · emit_json(rows) → { "light": {name: value}, "dark": {name: value} }
      a compact, cache-friendly map for any consumer that wants raw values.
  · emit_css(rows)  → a Tailwind-compatible stylesheet mirroring theme.css:
      light/base values in an `@theme { … }` block, dark overrides in
      `@layer base { .dark-mode { … } }`.

Both are PURE functions over the row shape returned by `db.list_tokens()`
(`{name, mode, value, kind, group}`), so they're unit-testable without a DB and
trivial to cache. The frontend can load the emitted CSS at boot instead of the
hand-written theme.css once token editing lands.
"""

from __future__ import annotations

from typing import Any, Iterable

TokenRow = dict[str, Any]


def _by_mode(rows: Iterable[TokenRow]) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {"light": {}, "dark": {}}
    for r in rows:
        mode = r.get("mode")
        if mode in out and r.get("name"):
            out[mode][str(r["name"])] = str(r.get("value", ""))
    return out


def emit_json(rows: Iterable[TokenRow]) -> dict[str, dict[str, str]]:
    """Mode → {name: value}. Names sorted for stable, diff-friendly output."""
    by_mode = _by_mode(rows)
    return {mode: {k: by_mode[mode][k] for k in sorted(by_mode[mode])} for mode in ("light", "dark")}


def emit_css(rows: Iterable[TokenRow]) -> str:
    """A `@theme` (light/base) + `.dark-mode` stylesheet, mirroring theme.css."""
    by_mode = _by_mode(rows)
    lines: list[str] = ["/* GENERATED from the DB `tokens` table — do not edit by hand. */"]

    lines.append("@theme {")
    for name in sorted(by_mode["light"]):
        lines.append(f"    {name}: {by_mode['light'][name]};")
    lines.append("}")

    if by_mode["dark"]:
        lines.append("")
        lines.append("@layer base {")
        lines.append("    .dark-mode {")
        for name in sorted(by_mode["dark"]):
            lines.append(f"        {name}: {by_mode['dark'][name]};")
        lines.append("    }")
        lines.append("}")

    return "\n".join(lines) + "\n"
