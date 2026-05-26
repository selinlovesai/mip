# User Test Plan — Appearance UI settings, chart tokens & dashboard persistence

Manual QA for the work landed **after** the first token test plan
(`docs/test-plan-db-tokens.md`).

| Commit | Scope |
|---|---|
| `2b02e08` | Data-driven Appearance browser — color sub-tabs + full token set |
| `f7a0795` | Theme tab "UI elements" — semantic token pickers |
| `84f2f59` | Swatch-rendering token dropdown (searchable) |
| `8e22f61` | UI settings for menu/title/surfaces + `--color-chart-*` tokens |
| `bd9c6eb` | Token seeding backfills missing rows (no manual re-seed) |
| `1b8f699` | Dashboard store DB write-through |

Work through in order. Each test has **Steps** and **✅ Expected**. Note the test
ID (e.g. `C3`) if anything diverges.

---

## A. Setup

Same as the first plan. In short:
1. Postgres running; `mip_tailwind` + `mip_tailwind_test` databases exist.
2. Backend: `cd server && DATABASE_URL='postgresql+asyncpg://localhost/mip_tailwind' .venv/bin/uvicorn main:app --port 8799` (or reuse the running one).
3. Frontend: `npm run dev` → http://localhost:5173
4. Sanity: `cd server && .venv/bin/pytest -q` → **9 passed**. `npx tsc -b && npm run build` → clean.

---

## B. Backfill seeding (no more manual re-seed)

**B1 — Full token set present**
```bash
curl -s http://localhost:8799/api/tokens | python3 -c "import sys,json;d=json.load(sys.stdin)['tokens'];print('total',len(d));import collections;print(collections.Counter(t['kind'] for t in d))"
```
✅ `total 590`, kinds include `color`, `typography`, `radius`, `shadow`.

**B2 — Chart tokens exist**
```bash
curl -s "http://localhost:8799/api/tokens?kind=color" | python3 -c "import sys,json;d=json.load(sys.stdin)['tokens'];print(sorted({t['name'] for t in d if t['group']=='Chart'}))"
```
✅ `['--color-chart-1' … '--color-chart-6']`.

**B3 — Backfill is automatic + non-destructive** (test DB)
```bash
cd server && TEST_DATABASE_URL='postgresql+asyncpg://localhost/mip_tailwind_test' .venv/bin/pytest -q -k tokens_seed
```
✅ Passes — confirms a missing token is backfilled and an edited token is never overwritten. (You should never again need to manually `TRUNCATE tokens`.)

---

## C. Appearance — data-driven browser & color sub-tabs (http://localhost:5173)

Open **sidebar user menu → Settings → Appearance**.

**C1 — Colors fans out into sub-tabs**
Click **Colors**.
✅ A row of pill sub-tabs appears: **Brand · Text · Background · Foreground · Border · Utility · Palette · Chart**, each with a count. Selecting one shows that group's swatches (name + live value).
✅ Counts are non-trivial (e.g. Utility ~134, Chart 6).

**C2 — Typography / Shadows / Spacing show the full set**
Click **Typography** → font families + a full type scale (with a count). **Shadows** → all shadow samples. **Spacing & Radius** → all radius samples + spacing steps.

**C3 — Edit a color token (light)**
Theme = Light. On **Colors → Brand**, click the `color-brand-600` swatch → pick a clearly different color.
✅ Picker opens, swatch + printed value update, and brand-colored UI (primary buttons, active nav) recolors immediately. Reload → still applied.

**C4 — Edit a Chart color and see a chart change**
Make sure a page has a chart (the **Overview** page has area/bar/donut charts). Settings → Appearance → **Colors → Chart** → edit `color-chart-1`.
✅ The chart's primary series/first slice recolors live. Reload → persists.

---

## D. Theme tab — UI element settings

Settings → Appearance → **Theme**. Scroll to **UI elements** (below Mode + Accent).

**D1 — Grouped settings render**
✅ Sub-sections: **Icons & accents**, **Text & navigation**, **Surfaces & actions**, **Charts** — each row has a swatch preview, label, hint, and a dropdown.

**D2 — Swatch dropdown**
Open any setting's dropdown.
✅ It shows a **color chip beside every token**, grouped by category, with a **search box** at top and a checkmark on the current selection. Typing filters. Click-outside / **Esc** closes.

**D3 — Re-point a semantic token (Accent)**
Set **Icons & accents → Accent color** to e.g. a pink token.
✅ Accent-driven elements (featured icons, progress, active states) recolor live. The trigger now shows the pink chip + name. Reload → persists.

**D4 — Chart color via Theme tab**
**Charts → Chart color 2** → pick a green token.
✅ The second chart series/slice recolors live (same target as `Colors → Chart` edits — they're consistent).

**D5 — Light/dark are independent**
Switch Theme → Dark, change a UI setting, switch back to Light.
✅ Each mode keeps its own choice.

**D6 — DB-off fallback**
Stop the backend, reload.
✅ App still fully styled; Appearance is **read-only** (no pickers open; UI element dropdowns disabled with a note). Restart backend → reload → editing returns.

---

## E. Dashboard persistence (DB write-through)

Backend must be up. Use the browser + a quick API check.

**E1 — Edits persist to the DB**
On a dashboard, enter edit mode, move/resize a widget (or add one via **+**). Wait ~1s, then:
```bash
curl -s http://localhost:8799/api/db/dashboards | python3 -c "import sys,json;d=json.load(sys.stdin)['records'];print(sorted(r['id'] for r in d))"
```
✅ The page ids are listed. Inspect the edited page's record — the widget's new layout/settings are saved:
```bash
curl -s http://localhost:8799/api/db/dashboards/overview | python3 -c "import sys,json;d=json.load(sys.stdin)['record']['data'];print('widgets',len(d['widgets']))"
```
✅ Reflects your change (e.g. widget count after an add).

**E2 — Survives reload from the DB**
Hard-reload the page.
✅ Your edit is still there (loaded from the DB on mount, not just localStorage).

**E3 — New page is created + removed in the DB**
Add a page (sidebar **+**), wait ~1s → it appears in the `GET /api/db/dashboards` id list. Delete the page → after ~1s it's gone from the list.

**E4 — Cross-"device" persistence**
Edit, then open the app in a private/incognito window (no shared localStorage).
✅ Your changes appear — proving they came from the DB, not local cache.

**E5 — Degrade-safe when DB is off**
Stop the backend, reload, make an edit.
✅ App keeps working off localStorage; no errors block use. (Edits made while offline are not pushed when the backend returns — that's expected for this pass.)

---

## F. Regression sanity

**F1** — Dashboards render; drag/resize/add/delete still work.
**F2** — AI assistant opens and responds (untouched).
**F3** — Charts render with the (possibly edited) chart palette; light/dark toggle still recolors everything.

---

## Known scope / notes

- Only **color** tokens are editable in the UI; typography/shadow/radius are browse-only.
- UI element settings re-point **shared** semantic tokens (e.g. "Menu item text" = `--color-text-secondary`, "Page background" = `--color-bg-primary`), so effects can be broader than the label — hints note this. Chart colors are dedicated tokens and isolated.
- Dashboard write-through is **dashboards only**; settings/connections stores still use localStorage.
- Edits made while the backend is down are not back-synced when it returns (no offline queue yet).
- A brief hydration race exists: editing in the first ~100ms before the DB load returns could be overwritten by hydration (low-risk, DB is local/fast).
