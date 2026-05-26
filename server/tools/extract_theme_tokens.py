"""
One-shot generator: parse the frontend's `src/styles/theme.css` and emit the
typed-token seed at `server/tokens.seed.json`.

theme.css is the source of truth: light/default values live in the top-level
`@theme { … }` block, dark overrides in the `.dark-mode { … }` block. We extract
every design-token custom property — colors, typography (`--text-*`, `--font-*`),
radius (`--radius-*`), and shadows (`--shadow-*`) — and record a row per
(name, mode) with its `kind` + `group` inferred from the name. Values are kept
verbatim (literal OR a `var(--…)` reference) so the seed mirrors the CSS exactly.
Tailwind utility-alias vars (`--background-color-*`, `--ring-color-*`, …),
breakpoints, and animations are intentionally excluded — they're derived
mappings, not editable primitives.

Run from server/ after editing theme.css:
    .venv/bin/python tools/extract_theme_tokens.py
The committed `tokens.seed.json` is what `seed.py` loads — re-run + commit when
theme.css colors change.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

THEME_CSS = Path(__file__).resolve().parents[2] / "src" / "styles" / "theme.css"
OUT = Path(__file__).resolve().parents[1] / "tokens.seed.json"

# Token families we treat as editable design primitives, mapped to their kind.
# Order matters only for readability; classification is by exact prefix below.
KIND_BY_PREFIX = {
    "--color-": "color",
    "--text-": "typography",
    "--font-": "typography",
    "--radius-": "radius",
    "--shadow-": "shadow",
}

VAR_RE = re.compile(r"^\s*(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);", re.MULTILINE)


def _kind(name: str) -> str | None:
    for prefix, kind in KIND_BY_PREFIX.items():
        if name.startswith(prefix):
            return kind
    return None  # not an editable primitive (utility alias, breakpoint, …)


def _block(css: str, start_pat: str) -> str:
    """Return the body of the first brace-balanced block whose header matches."""
    m = re.search(start_pat, css)
    if not m:
        return ""
    i = css.index("{", m.start())
    depth = 0
    for j in range(i, len(css)):
        if css[j] == "{":
            depth += 1
        elif css[j] == "}":
            depth -= 1
            if depth == 0:
                return css[i + 1 : j]
    return css[i + 1 :]


def _group(name: str, kind: str) -> str:
    if kind != "color":
        # Non-color primitives group by kind (Typography / Radius / Shadow).
        return {"typography": "Typography", "radius": "Radius", "shadow": "Shadow"}.get(kind, kind.title())
    body = name[len("--color-") :]
    for prefix, group in (
        ("brand-", "Brand"),
        ("chart-", "Chart"),
        ("text-", "Text"),
        ("bg-", "Background"),
        ("border-", "Border"),
        ("fg-", "Foreground"),
        ("utility-", "Utility"),
    ):
        if body.startswith(prefix):
            return group
    return "Base"


def _vars(block: str) -> dict[str, str]:
    """name → value for every editable-primitive var in the block (last wins)."""
    out: dict[str, str] = {}
    for name, value in VAR_RE.findall(block):
        if _kind(name) is None:
            continue
        out[name] = re.sub(r"\s+", " ", value).strip()
    return out


def main() -> None:
    css = THEME_CSS.read_text()
    light = _vars(_block(css, r"@theme\b"))
    dark = _vars(_block(css, r"\.dark-mode\b"))

    rows = []
    for mode, vars_ in (("light", light), ("dark", dark)):
        for name in sorted(vars_):
            kind = _kind(name)
            rows.append({"name": name, "mode": mode, "value": vars_[name], "kind": kind, "group": _group(name, kind)})

    OUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    by_kind = {k: sum(1 for r in rows if r["kind"] == k) for k in sorted({r["kind"] for r in rows})}
    print(f"wrote {len(rows)} token rows ({len(light)} light, {len(dark)} dark) → {OUT.name}")
    print("  by kind:", by_kind)


if __name__ == "__main__":
    main()
