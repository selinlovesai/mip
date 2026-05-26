"""
One-shot generator: parse the frontend's `src/styles/theme.css` and emit the
typed-token seed at `server/tokens.seed.json`.

theme.css is the source of truth: light/default values live in the top-level
`@theme { … }` block, dark overrides in the `.dark-mode { … }` block. We extract
every `--color-*` custom property and record a row per (name, mode) with its
group (Brand / Text / Background / Border / Foreground / Utility / Base) inferred
from the name. Values are kept verbatim (literal `rgb(...)` OR a `var(--…)`
reference) so the seed mirrors the CSS exactly.

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

VAR_RE = re.compile(r"^\s*(--color-[A-Za-z0-9_-]+)\s*:\s*([^;]+);", re.MULTILINE)


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


def _group(name: str) -> str:
    body = name[len("--color-") :]
    for prefix, group in (
        ("brand-", "Brand"),
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
    # Last definition wins (CSS cascade within a block).
    out: dict[str, str] = {}
    for name, value in VAR_RE.findall(block):
        out[name] = re.sub(r"\s+", " ", value).strip()
    return out


def main() -> None:
    css = THEME_CSS.read_text()
    light = _vars(_block(css, r"@theme\b"))
    dark = _vars(_block(css, r"\.dark-mode\b"))

    rows = []
    for name in sorted(light):
        rows.append({"name": name, "mode": "light", "value": light[name], "kind": "color", "group": _group(name)})
    for name in sorted(dark):
        rows.append({"name": name, "mode": "dark", "value": dark[name], "kind": "color", "group": _group(name)})

    OUT.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} token rows ({len(light)} light, {len(dark)} dark) → {OUT.name}")


if __name__ == "__main__":
    main()
