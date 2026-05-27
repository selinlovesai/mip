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


def emit_css(rows: Iterable[TokenRow], scope: str = "theme") -> str:
    """A light/base + `.dark-mode` stylesheet from the tokens.

    scope="theme" (default): light vars in a Tailwind `@theme {}` block — the
      build-time artifact that can replace the hand-written theme.css.
    scope="root": light vars in `:root {}` — a RUNTIME override the SPA can
      inject at boot so DB token edits take effect without a rebuild (Tailwind's
      already-generated utilities read the same custom properties).
    Dark overrides always target `.dark-mode` (the app's dark-mode class)."""
    by_mode = _by_mode(rows)
    light_open = "@theme {" if scope == "theme" else ":root {"
    lines: list[str] = ["/* GENERATED from the DB `tokens` table — do not edit by hand. */", light_open]
    for name in sorted(by_mode["light"]):
        lines.append(f"    {name}: {by_mode['light'][name]};")
    lines.append("}")

    if by_mode["dark"]:
        lines.append("")
        if scope == "theme":
            lines += ["@layer base {", "    .dark-mode {"]
            indent = "        "
            close = ["    }", "}"]
        else:
            lines.append(".dark-mode {")
            indent = "    "
            close = ["}"]
        for name in sorted(by_mode["dark"]):
            lines.append(f"{indent}{name}: {by_mode['dark'][name]};")
        lines += close

    # Tailwind v4 INLINES `--shadow-*` theme values into the `shadow-*` utilities
    # (they don't read `var(--shadow-*)`), so a runtime `:root` override of a
    # shadow token wouldn't reach them. For the runtime overlay only, re-point the
    # shadow utilities at their token var. Mode is handled by the var itself
    # (`:root` vs `.dark-mode` redefines `--shadow-*`), so one rule per name works.
    if scope == "root":
        shadow_names = sorted(n for n in (set(by_mode["light"]) | set(by_mode["dark"])) if n.startswith("--shadow-"))
        if shadow_names:
            lines.append("")
            lines.append("/* Shadow utilities reference their token so edits apply live. */")
            for name in shadow_names:
                suffix = name[len("--shadow-") :]
                selector = ".shadow" if suffix in ("", "DEFAULT") else f".shadow-{suffix}"
                lines.append(f"{selector} {{ --tw-shadow: var({name}); }}")

    return "\n".join(lines) + "\n"
