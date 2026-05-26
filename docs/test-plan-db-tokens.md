# User Test Plan — DB foundation & design tokens

Manual QA for everything landed **after** the prompt-injection security work:

| Commit | Scope |
|---|---|
| `4daa5c7` | DB foundation — migration runner + idempotent seeding |
| `9b8ec8c` | Typed `tokens` table seeded from theme.css |
| `6f58ff7` | All token kinds + CSS/JSON emit pipeline |
| `1757b9d` | Frontend wiring — boot CSS overlay + editable color tokens |

Work through the sections in order. Each test has **Steps** and **✅ Expected**.
If anything diverges, note the test ID (e.g. `B2`) when reporting.

---

## A. Prerequisites & setup

1. **Postgres running** locally (`pg_isready` → accepting connections).
2. App + test databases exist:
   ```bash
   createdb mip_tailwind        # app DB (skip if it exists)
   createdb mip_tailwind_test   # test DB (skip if it exists)
   ```
3. Backend deps installed:
   ```bash
   cd server
   python -m venv .venv && source .venv/bin/activate   # if not already
   pip install -r requirements.txt
   ```
4. Start the backend against the **app** DB:
   ```bash
   cd server
   DATABASE_URL='postgresql+asyncpg://localhost/mip_tailwind' .venv/bin/uvicorn main:app --port 8799
   ```
   (If port 8799 is busy, a backend is already running — that's fine.)
5. Start the frontend (separate terminal):
   ```bash
   npm run dev          # http://localhost:5173
   ```

---

## B. Automated checks (fast confidence)

**B1 — Backend tests pass**
```bash
cd server && .venv/bin/pytest -q
```
✅ `8 passed` (migrations idempotency, CRUD, seeding, tokens CRUD, seed-then-noop, emit purity + round-trip). If the test DB is unreachable, tests **skip** (not fail).

**B2 — Frontend typechecks & builds**
```bash
npx tsc -b && npm run build
```
✅ No type errors; build succeeds (a chunk-size warning is pre-existing and unrelated).

---

## C. Backend foundation — migrations & seeding

**C1 — Cold boot migrates + seeds**
On a fresh DB, watch the backend startup logs.
✅ Logs include `applied migrations: 0001_records, 0002_records_collection_idx, 0003_tokens, 0004_tokens_kind_idx`, `seed: dashboards seeded 2 record(s)`, and `tokens: seeded 584 token row(s)`.

**C2 — Reboot is a clean no-op (idempotent)**
Stop and restart the backend.
✅ No migrations re-applied (no "applied migrations" line, or empty); **no** re-seed lines. Data intact.

**C3 — Starter dashboards present**
```bash
curl -s http://localhost:8799/api/db/dashboards | python3 -m json.tool
```
✅ `ok: true`, two records with ids `overview` (8 widgets) and `marketing` (4 widgets).

**C4 — Seeding never clobbers** (run against the **test** DB so app data is safe)
```bash
cd server
TEST_DATABASE_URL='postgresql+asyncpg://localhost/mip_tailwind_test' .venv/bin/pytest -q -k seed
```
✅ Passes — confirms an edited record/token is **not** overwritten on a later seed pass.

**C5 — Health endpoint**
```bash
curl -s http://localhost:8799/api/health
```
✅ `{"status":"ok","db":true}`.

---

## D. Typed tokens & emit pipeline (API)

**D1 — List tokens**
```bash
curl -s "http://localhost:8799/api/tokens?kind=color" | python3 -c "import sys,json;d=json.load(sys.stdin);print('ok',d['ok'],'count',len(d['tokens']))"
```
✅ `ok True` and a count of color tokens (~484). Drop `?kind=color` → ~584 total (color/typography/radius/shadow).

**D2 — JSON emit**
```bash
curl -s http://localhost:8799/api/tokens.json | python3 -c "import sys,json;d=json.load(sys.stdin);print('light',len(d['tokens']['light']),'dark',len(d['tokens']['dark']))"
```
✅ `light 325 dark 259` (approx).

**D3 — CSS emit, build-time scope**
```bash
curl -s "http://localhost:8799/api/tokens.css?scope=theme" | head -5
```
✅ Starts with the generated banner + `@theme {` and a dark block under `@layer base { .dark-mode {`.

**D4 — CSS emit, runtime scope**
```bash
curl -s "http://localhost:8799/api/tokens.css?scope=root" | head -5
```
✅ Same content but opens with `:root {` (no `@theme`); dark block is a bare `.dark-mode {`.

**D5 — Bad scope rejected**
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8799/api/tokens.css?scope=bogus"
```
✅ `400`.

**D6 — Edit a token persists + reflects in emit**
```bash
curl -s -X PUT http://localhost:8799/api/tokens/--color-brand-600/light \
  -H 'content-type: application/json' -d '{"value":"#123456","kind":"color","group":"Brand"}'
curl -s "http://localhost:8799/api/tokens.css?scope=root" | grep -m1 "color-brand-600:"
```
✅ PUT returns `ok:true`; the grep shows `--color-brand-600: #123456;`.
**Restore** before UI testing:
```bash
curl -s -X PUT http://localhost:8799/api/tokens/--color-brand-600/light \
  -H 'content-type: application/json' -d '{"value":"rgb(127 86 217)","kind":"color","group":"Brand"}'
```

**D7 — Bad mode rejected**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT http://localhost:8799/api/tokens/x/sideways \
  -H 'content-type: application/json' -d '{"value":"#000"}'
```
✅ `400` (mode must be light/dark).

---

## E. Frontend wiring (browser — http://localhost:5173)

**E1 — Boot overlay is injected**
Open the app, then DevTools → Console:
```js
document.getElementById("mip-db-tokens")?.textContent.slice(0, 40)
```
✅ Returns the generated CSS banner (`/* GENERATED from the DB ... */`). Element exists in `<head>`, after the bundled styles.

**E2 — Appearance browser shows live values**
Sidebar **user menu → Settings → Appearance → Colors**.
✅ Color groups (Brand/Text/Background/Border/Foreground/Utility) render swatches with token names + current values.

**E3 — Color token is editable (light mode)**
Ensure Theme = Light (Appearance → Theme → Light). On Colors, click a **Brand** swatch (e.g. `color-brand-600`).
✅ A native color picker opens. Pick a distinctly different color.
✅ On selection: the swatch updates, the printed value changes, **and brand-colored elements across the app recolor immediately** (e.g. primary buttons, active nav). No reload needed.

**E4 — Edit persists across reload**
Reload the page.
✅ The edited color is still applied (loaded from DB via the boot overlay).

**E5 — Light/dark are independent**
Switch Theme → Dark. Edit the same token to a different color. Switch back to Light.
✅ Light shows your E3 color; Dark shows your E5 color — edits are per-mode.
(Reset: re-run `D6` restore, or set values back via the picker.)

**E6 — Degrade-safe when DB is off**
Stop the backend (Ctrl-C). Reload the app.
✅ App still loads and is fully styled (bundled theme.css). Appearance → Colors swatches are **read-only** (no color picker opens on click). No console errors block rendering.
Restart the backend → reload → pickers return (E3 works again).

---

## F. Regression sanity (unchanged behavior)

**F1** — Dashboards (Overview/Marketing) render with widgets; drag/resize in edit mode still works.
**F2** — AI assistant still opens and responds (the security-hardened chat is untouched by this work).
**F3** — Theme light/dark/system toggle + accent swatches still work.

---

## Notes / known scope

- **Token seeding backfills on every boot** (`seed_tokens`): new tokens added to
  `tokens.seed.json` (e.g. `--color-chart-*`) are inserted automatically on the
  next start, and edited values are never overwritten. Current seed: **590**
  tokens. (Generic collection seeding stays empty-only — whole documents.)
- Only **color** tokens are editable in the UI so far; typography/shadow/radius are browse-only (editing planned).
- Emit is recomputed per request (no server-side cache yet) — fine at ~584 rows.
- `components` table (the other half of plan step 2) is not started.
