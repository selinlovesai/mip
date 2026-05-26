# mip → mip-tailwind — Migration Plan & Module Table

Mapping the original **mip** (vanilla-CSS, `mdp`) system onto **mip-tailwind** (Tailwind v4 + Untitled UI), under the locked architecture directives.

## Architecture directives (the "new system" rules)

1. **Everything persists to PostgreSQL.** All data currently in JSON files (dashboards, widgets, connections, apps, conversations, users, settings, themes, templates, tokens, components) is saved to a Postgres DB owned by the `server/` backend — localStorage becomes a cache only. Read-heavy catalogs (**tokens, components, apps, widgets/dashboards, themes, templates**) are additionally **cached as JSON** (server-emitted, cache-busted on write) for fast reads / offline.
2. **Design system is DB-driven.** Every **design token** and every **component** is a first-class row in the DB. Widgets do **not** hardcode styles/markup — they **pull from tokens/components** by id. Tokens are edited in Settings → Appearance and compiled to a **cached JSON** artifact + a **Tailwind-compatible CSS** (`@theme` / `:root` CSS vars) that the app and Tailwind utilities consume.
3. **Elements, Components, and Patterns are all widgetized.** Every atom (button/input/badge), molecule (form field/KPI card), and pattern/block is a placeable **widget type** in the registry. The widget catalog spans the full design-system hierarchy.
4. **Settings → Appearance is the token browser.** Foundations are managed there via categorized tabs (Colors / Typography / Shadows / Spacing & Radius), later synced from Figma.

## Type taxonomy

| Type | Meaning |
|---|---|
| **Foundation (Token)** | Indivisible style primitives — colors, typography, shadows, spacing, radius. DB-stored; later synced from Figma. |
| **Element (Atom)** | Indivisible UI parts — buttons, inputs, badges, icons, avatar, toggle. Widgetized. |
| **Component (Molecule)** | Simple combinations — Input+Label = Form Field; KPI card; search bar. Widgetized. |
| **Pattern / Block** | Complex standalone sections — charts, tables, hero/pricing, sidebar, chat, settings. Widgetized. |
| **Module** | Frontend architecture units — schema, adapter/registry, store. |
| **Data model (DB)** | A Postgres table / persisted entity. |
| **Service** | Backend/runtime service — FastAPI, DB layer, MCP, OAuth. |
| **Feature / Flow** | Cross-cutting behavior — drag-drop, AI chat, persistence, auth. |

## Legends
**Status:** ✅ Done (in mip-tailwind) · 🟡 Partial · ⬜ Not started
**Complexity:** S (<1d) · M (1–3d) · L (1–2wk) · XL (multi-week)

---

## A. Foundations (Tokens) — DB-stored style primitives, managed in Settings → Appearance

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Color tokens | Foundation (Token) | Brand ramp + semantic colors driving every surface | Move Untitled `@theme` colors into a `tokens` table (name, value, mode, group); emit CSS vars from DB at boot; edit via Settings → Appearance | DB + token API | L | 🟡 (browser UI + accent/mode override done; **color tokens now DB-backed** — 484 rows seeded from theme.css, `GET/PUT /api/tokens`; frontend read/edit wiring + CSS emit still pending) | Editing a color from Settings → Appearance writes to DB and recolors app on reload; no hardcoded hex |
| Typography tokens | Foundation (Token) | Font families + display/text scale | Tokenize into `tokens` (group=typography); components reference token names; edit via Settings → Appearance | tokens table | M | 🟡 (shown in Appearance; not DB) | Type scale editable from DB **and** from Settings → Appearance UI |
| Shadow tokens | Foundation (Token) | Elevation scale | Tokenize shadows; edit via Settings → Appearance | tokens table | S | 🟡 (shown in Appearance) | Shadows editable from DB **and** from Settings → Appearance UI |
| Spacing tokens | Foundation (Token) | Spacing/gutter scale | Tokenize spacing; edit via Settings → Appearance | tokens table | M | 🟡 (shown in Appearance) | Spacing propagates from DB; editable from Settings → Appearance UI |
| Radius tokens | Foundation (Token) | Corner-radius scale | Tokenize radius; edit via Settings → Appearance | tokens table | S | 🟡 (shown in Appearance) | Radius editable from DB **and** from Settings → Appearance UI |
| Appearance token browser | Pattern / Block | Categorized token UI (Colors/Type/Shadows/Spacing) — the editing surface for every token | Done (read-only); make each token value editable inline + persist to `tokens` | tokens table | M | 🟡 (**data-driven from `/api/tokens`** — Colors fans out into sub-tabs per group (Brand/Text/Background/Foreground/Border/Utility/Palette, 244 color tokens) + full type/shadow/radius sets; **color tokens editable** via picker → `PUT` → live overlay; static fallback when DB off; type/shadow/radius edit next) | Editing any token in Appearance writes to DB and updates the app |
| Token emit pipeline (JSON + CSS) | Service / Feature | Compiles DB tokens to a **cached JSON** artifact and a **Tailwind-compatible CSS** (`@theme` / `:root` CSS vars) the app + Tailwind utilities consume | Backend job: `tokens` → `tokens.json` cache + generated `theme.css` (`@theme {…}`); invalidate cache on token edit; app loads the generated CSS at boot | tokens table + backend | L | 🟡 (`emit.py` → `/api/tokens.json` + `/api/tokens.css` (`@theme` or runtime `:root`); **frontend overlays the `:root` build at boot** via `db-tokens.ts`, refreshed on edit; server-side cache-bust still pending) | DB tokens → JSON cache + Tailwind `@theme` CSS; `bg-primary`/`text-*`/`rounded-md` resolve from emitted vars; cache busts on edit |
| Figma token sync | Feature / Flow | Pull tokens from Figma → DB | Figma MCP / Tokens Studio export → `tokens` upsert job (feeds the JSON+CSS emit pipeline) | tokens table + Figma | L | ⬜ | Figma push updates DB tokens → re-emits JSON + CSS |

---

## B. Elements (Atoms) — widgetized indivisible UI

> **Design tab:** every atom widget exposes a **Design** tab in its settings — change color, spacing, font, and layout, all bound to tokens (pick a token or override). Overrides save to the widget; defaults inherit from the DB token/component.

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Button | Element (Atom) | Action trigger (variants/sizes) | Untitled `Button`; register as widget type + `components` row referencing tokens | registry + components table | S | 🟡 (`button` widget exists; not DB-driven) | Placeable as widget; style from tokens |
| Input / TextArea / Select | Element (Atom) | Text/number/select entry | Untitled form atoms → standalone widget types | components table | M | 🟡 (inside form widget) | Each placeable standalone |
| Checkbox / Toggle / Radio | Element (Atom) | Boolean/choice controls | Untitled atoms → widget types | components table | S | 🟡 (inside form widget) | Placeable standalone |
| Badge / Tag | Element (Atom) | Status/label chips | Untitled `Badge` → widget type | components table | S | 🟡 (used in KPI/table) | Placeable standalone |
| Avatar | Element (Atom) | Image/initials | Untitled `Avatar` → widget type | components table | S | 🟡 (used in list/users) | Placeable standalone |
| Icon | Element (Atom) | `@untitledui/icons` glyph | Icon-picker widget; store name in settings | icon registry | S | ⬜ | Searchable + placeable |
| Progress bar | Element (Atom) | Linear progress | Untitled `ProgressBar` | components table | S | ✅ (as `progress`) | Renders value/target |
| Tooltip | Element (Atom) | Hover hint | Wrapper capability | — | S | 🟡 (in chrome) | Available on widgets |

---

## C. Components (Molecules) — widgetized simple combinations

> **Design tab:** the Design tab here also targets the **nested elements** inside the molecule (e.g. a Form Field's label vs. input) — color/spacing/font/layout per sub-element, token-bound.

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| KPI / metric card | Component (Molecule) | Label + value + delta badge | Done; make style pull from tokens | tokens | S | ✅ (UI) / 🟡 (tokens) | Renders value/format/delta |
| Form field (Input+Label) | Component (Molecule) | Labeled controlled field | Compose atom + label as molecule widget | atoms widgetized | M | 🟡 (inside `form`) | Placeable standalone |
| Search bar | Component (Molecule) | Icon + input + filter | Compose from atoms | atoms | S | 🟡 (in pickers) | Reusable widget |
| Stat group | Component (Molecule) | Row of stats + deltas | `statsGrid` widget | tokens | S | ✅ | Renders stats |
| Dropdown menu | Component (Molecule) | Trigger + menu items | Untitled `Dropdown` → widget action | — | M | 🟡 (sidebar/page menu) | Works on widgets |
| Detail (key/value) | Component (Molecule) | Record field list | `detail` widget | data binding | S | ✅ (UI) | Renders record |
| Pagination | Component (Molecule) | Table page controls | Untitled `pagination` → table | table widget | M | ⬜ | Tables paginate |

---

## D. Patterns & Blocks — widgetized complex sections

> **Design tab:** patterns expose the deepest Design tab — restyle the block and every element/component nested inside it (e.g. a pricing block's tier card, badge, button, price text) — color/spacing/font/layout, token-bound, with per-sub-element targeting.

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Charts (line/bar/area/pie/donut) | Pattern / Block | Data viz | Done (recharts + Untitled charts-base); bind live data | live data | M | ✅ (UI) / 🟡 (live data) | All 5 render w/ tooltips/legend |
| Table (advanced) | Pattern / Block | Sortable rows + status pills | Done (Untitled `Table`); add sort/paginate/live data | data binding | M | ✅ (UI) / 🟡 | Renders rows + status |
| List / activity feed | Pattern / Block | Avatar rows + value | Done (`list`) | data binding | S | ✅ (UI) | Renders items |
| Markdown | Pattern / Block | Rich text | Done (dep-free parser) | — | S | ✅ | Renders markdown |
| Diagrams (flow/seq/mindmap/timeline/gantt) | Pattern / Block | Mermaid | Done (lazy) | — | M | ✅ | Renders + theme-aware |
| Design blocks (hero/cta/pricing/faq/featureGrid/statsGrid/testimonial/contentSection) | Pattern / Block | Marketing sections | Done | tokens | M | ✅ (UI) | All 8 render |
| Image/Map/Modal/Drawer/Tabs/Card/Page header | Pattern / Block | Misc widgets | Done | — | S | ✅ | Render correctly |
| Sidebar (workspace nav) | Pattern / Block | Page nav, collapse, user menu | Done | pages in DB | M | ✅ (UI) / 🟡 (DB) | Nav + collapse + menu work |
| Topbar | Pattern / Block | Title + controls + reopen | Done | — | S | ✅ | Controls work |
| Widget grid (drag/resize) | Pattern / Block | Draggable canvas | Done (RGL v2) | layout in DB | M | ✅ (UI) / 🟡 (DB) | Drag/resize persists |
| AI chat panel (3 modes) | Pattern / Block | Compact/chat/sidebar assistant | Done; add tool-injection | backend + DB convos | L | ✅ (UI) / 🟡 (real AI) | Modes switch; live replies; injects widgets |
| Settings surface (inner sidebar) | Pattern / Block | Profile/Appearance/Connections/Apps/Assistant/Users | Done | DB settings | M | ✅ (UI) | All tabs render |
| Connections editor | Pattern / Block | Source/auth/headers/endpoints/test/Postman | Done; persist DB + backend test | backend + DB | L | ✅ (UI) / 🟡 (DB) | Editor + test work |
| Widget picker / editor | Pattern / Block | Add/edit widgets (title + settings JSON + **Design tab**) | Done (JSON settings drawer); add the Design tab (see H) | — | S | ✅ (JSON) / ⬜ (Design tab) | Add + edit widgets; Design tab present |

---

## E. Modules (frontend architecture)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| `MipWidget` schema/contract | Module | Widget/document type contract | Ported; extend to reference tokenIds/componentIds | — | S | ✅ / 🟡 (refs) | Compiles; widgets reference ids |
| UI-kit adapter + registry | Module | `WidgetType` → renderer (kit-agnostic) | Done; extend to atoms/molecules + DB component lookup | components table | M | ✅ / 🟡 (DB) | Swapping adapter reskins app |
| Dashboard store | Module | Pages/widgets/edit/layout state | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (**DB write-through live** — hydrates from `/api/db/dashboards` on mount, debounced per-page upsert/delete on change, localStorage kept as cache; settings/connections stores next) | State persists to DB |
| Settings store | Module | Connections/apps/assistant config | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (DB) | Persists to DB |
| API client (`api.ts`) | Module | Calls FastAPI backend | Done — chat + test + **DB client** (`dbList/dbGet/dbPut/dbDelete/dbAvailable`, degrade-safe); wire stores to write-through next | backend routes | S | ✅ (client) / 🟡 (store write-through) | CRUD + chat work; stores persist via DB |
| Document validator | Module | Structural + **referential** validation (unique ids, nav/source/action/field refs resolve, enum membership, layout `x+w`≤cols) before render + save | Port `@mip/validator`; run on load + pre-DB-save; surface path-precise errors (`$.pages[0].widgets[2].layout`) | schema | M | ⬜ | Invalid docs rejected with exact error paths; valid docs render |
| Action → intent resolver | Module | Maps widget `actions[]`/`submit` to intents (submit · refresh · navigate · openModal · openDrawer) | Port `@mip/actions` (`resolveActionIntent`); wire button/form widgets to dispatch | schema + store | M | ⬜ | Button/form widgets trigger nav/submit/modal/drawer |
| Injection engine + runtime bridge | Module | Pure doc mutators (`injectDashboardWidget` / `createDashboardPage` / `withDefaultWidgetContent`) + global `window.mipRuntime` the AI tools call to mutate the doc | Port `mipInjection.ts`; expose `mipRuntime` (createPage/addWidget/injectWidget/removeWidget/updateWidget/reorganizePage/setPageLocked/setPageContext/getActivePage); back with store + validator | store + schema + validator | L | ⬜ | AI tools build/edit pages via the bridge; every mutation re-validates |
| Connectors execution engine | Module / Service | Executes **mock/rest/json/csv** requests — JSONPath read (`readJsonPath`), quoted-CSV parser, `resolveSecretRef`, skip-Bearer-when-apiKey-header | Port `@mip/connectors` into FastAPI; back live widget data + endpoint test | backend | M | 🟡 (REST test proxy only) | All 4 source types fetch + map server-side |

---

## F. Data models (PostgreSQL tables) — directives #1 & #2

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| `tokens` | Data model (DB) | Design tokens (color/type/spacing/radius/shadow) | New table; seed from Untitled `@theme`; serve as CSS vars | Postgres + backend | L | 🟡 (typed table live — **590 tokens** (color incl. new `--color-chart-1..6`, typography/radius/shadow) seeded from theme.css via migration 0003 + `GET/PUT /api/tokens` + JSON/CSS emit, verified by tests; charts now read tokens) | Tokens CRUD; app reads from DB |
| `components` | Data model (DB) | Atom/molecule/pattern defs widgets pull from | New table (id, kind, props schema, token refs, variant); registry resolves by id; **cached as JSON** | Postgres + registry | XL | ⬜ | Widgets render from DB component rows; JSON cache busts on edit |
| `widgets`/`dashboards`/`pages` | Data model (DB) | Dashboard docs (reference token/component ids) | Replace seed.ts + localStorage with DB (jsonb, mip parity); **cached as JSON** | Postgres + backend | L | ⬜ (localStorage) | Dashboards load/save from DB; JSON cache |
| `connections` | Data model (DB) | Data sources (auth/headers/endpoints/isAiModel) | Persist settings-store connections to DB; **encrypt credential fields at rest** (API keys/tokens/passwords) via app-level AES-GCM or pgcrypto, key from env/KMS; decrypt only server-side at request time; never return secrets to the browser (masked) | Postgres + encryption key | L | ⬜ | Connections persist + survive devices; secrets encrypted at rest, never sent to client in plaintext |
| `apps` / `installed_apps` | Data model (DB) | Connector catalog + install state | Move `apps-catalog.ts` → DB; **cached as JSON** | Postgres | M | ⬜ | Catalog + install state from DB; JSON cache |
| `conversations` | Data model (DB) | Chat transcripts per dashboard/page | New table (mip composite PK) | Postgres + backend | M | ⬜ (in-memory) | Chat history persists |
| `users` | Data model (DB) | Identity, roles, scopes | New table (mip parity); hash server-only | Postgres + auth | L | ⬜ (mock) | Users CRUD; roles enforced |
| `themes` / `templates` | Data model (DB) | Palettes + starter dashboards | JSON → DB; **cached as JSON** | Postgres | M | ⬜ | From DB; JSON cache |
| `access_tokens` | Data model (DB) | API tokens (hash only) | New table (mip parity) | Postgres + auth | M | ⬜ | Mint/revoke tokens |
| `widget_types` (registry catalog) | Data model (DB) | Per-type labels, descriptions, **dataMap keys+shapes**, accent colors, default layouts — feeds the picker AND AI injection/data-binding | Port `widget-types.json` → DB; **cached as JSON**; registry + AI tools read type metadata from it | Postgres + registry | M | ⬜ | Picker + AI read per-type metadata + dataMap shapes from DB |
| `messages` (strings) | Data model (DB) | Centralized user-facing strings by surface | Port `messages.json` → DB/JSON | Postgres | S | ⬜ | UI strings sourced centrally (i18n-ready) |

---

## G. Services (backend / runtime)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| FastAPI backend | Service | Chat + endpoint-test proxy + **generic DB CRUD** (`/api/db/{collection}`) + **typed tokens** (`/api/tokens`) | Done (`server/`); chat + test + generic CRUD + typed token routes live; expand to remaining typed/secret routes | Postgres | M | 🟡 (chat + test + CRUD + tokens) | All data flows through backend |
| Postgres + ORM layer | Service | DB access (SQLAlchemy async + asyncpg) — generic `records(collection,id,data jsonb)` store + **ordered idempotent migration runner** (`schema_migrations`) + **seed-if-empty** loader (`seed/*.json`, e.g. starter dashboards), graceful degrade when down | Done (foundation + migrations + seed); add typed `tokens`/`components` tables as the next migration (mirror `@mip/db`) | Postgres instance | L | 🟡 (generic store + CRUD + migrations + seed verified by `test_db.py`) | CRUD round-trips persist; migrations tracked + idempotent; empty collections seed without clobber; typed tables next |
| AI chat (real inference) | Service / Flow | Provider proxy (OpenAI/Anthropic/local) | Done; add tool-use loop + widget injection | connections in DB | L | 🟡 (chat; no tool-injection) | Assistant injects widgets via tools |
| secretRef / secret storage | Service / Feature | Keep keys server-side, **encrypted at rest** | New: encrypt secrets (AES-GCM/pgcrypto, key from env/KMS) on write; store + resolve `secretRef` in backend; decrypt in-memory only at request time; mask on read | Postgres + encryption key | M | ⬜ (client-side now) | Keys never reach browser; ciphertext at rest; rotate-able key |
| OAuth flow | Service / Flow | code → token exchange | New: `/oauth/exchange` + callback (mip parity) | backend + manifests | L | ⬜ | OAuth connect succeeds |
| MCP server | Service | Tools to create/validate/inject dashboards | New: port mip-mcp-server | schema + injection | L | ⬜ | MCP client builds dashboards |
| Endpoint test proxy | Service | Tests REST endpoints (CORS bypass) | Done | — | S | ✅ | Returns status + body |
| AI tool catalog (~18 tools) | Service / Flow | The assistant's tools: `mip_list_pages` · `mip_list_connections` · `mip_get_widget_spec` · `mip_create_page` · `mip_set_dashboard_context` · `mip_inject_widget` · `mip_inspect_page` · `mip_remove_widget` · `mip_update_widget` · `mip_reorganize_page` · `mip_fetch_url` · `mip_send_connection_request` · `mip_ai_request` · `mip_web_search` · `mip_memory_*` · `mip_generate_image` | Port `aiTools.ts` + `executeTool`; gate css/script, **require `dataMap` + validate each JSONPath against a live sample** for real connections; block `pageHeader` inject | injection engine + backend | L | 🟡 (inject only, stubbed) | Assistant runs the full tool set with the same gates as mip |
| Prompted tool mode + aliases | Service / Flow | JSON tool-calling for models **without** native function-calling + tolerant output normalization (tool/arg/widget-type synonyms) | Port `aiPromptedTools.ts` + `ai-aliases.json` | AI tool catalog | M | ⬜ | Local / non-native LLMs can drive the same tools |
| Web search tool | Service | `mip_web_search` (e.g. Tavily) for in-chat research | New backend route + tool; key via encrypted connection | backend + key | S | ⬜ | Assistant can web-search and cite |
| Image generation + storage | Service | `mip_generate_image` + image save/serve routes | New backend routes + tool (mip `/mip/images/save` + `/mip/images/:file`) | backend | M | ⬜ | Assistant generates + embeds images |

---

## H. Features / Flows (cross-cutting)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Widget Design tab | Feature / Flow | Per-widget **Design** tab in settings — edit color/spacing/font/layout of the widget **and the elements/components nested inside it**, bound to tokens (pick a token or override) | Add a Design tab to the widget editor: token-bound controls (color pickers from `tokens`, spacing/radius/font selectors, layout); for molecules/patterns, a sub-element targeting tree; overrides save to `widget.style`/per-element style, defaults inherit from token/component | tokens + components in DB; widget editor | L | ⬜ | Changing a token-bound control restyles the widget (and chosen nested element) live and persists |
| Drag-drop + resize | Feature / Flow | Rearrange widgets | Done (RGL v2) | layout in DB | M | ✅ / 🟡 (DB) | Layout persists to DB |
| Persistence (3-tier) | Feature / Flow | localStorage → backend → DB | Add DB write-through (mip pattern) | Postgres | L | 🟡 (localStorage) | Survives reload + device switch |
| Live widget data | Feature / Flow | Widgets fetch from connections | Done — `useWidgetData` resolves `widget.data` (sourceId+request+map) → backend proxy → JSONPath (`readJsonPath`); KPI honors the map. Crypto template KPIs pull live Binance/CoinGecko. Collection widgets (chart/table mapping arrays-of-arrays) still TODO. | connections + backend | L | ✅ (KPIs live) / 🟡 (collections) | Widget shows live API data |
| Theme/appearance | Feature / Flow | Light/dark + accent + tokens | Done; persist tokens to DB | tokens table | M | ✅ / 🟡 (DB) | Theme persists from DB |
| Auth / roles / permissions | Feature / Flow | Users, page permissions | New: login + roles + page access (mip parity) | users table + backend | XL | ⬜ | Role-gated edit/view works |
| Chat memory / recall | Feature / Flow | Scoped past-conversation recall | New: memory search over `conversations` (scope server-side) | conversations + auth | L | ⬜ | Assistant recalls prior context |
| Dynamic pages / variables | Feature / Flow | Parameterized pages | Port page variables + dynamic-page category | pages in DB | M | ⬜ | Dynamic pages resolve vars |
| Templates import | Feature / Flow | Starter dashboards | Port template picker → DB templates | templates table | M | ⬜ | Import seeds a dashboard |
| Google Sheets builder | Feature / Flow | Sheets → chart widget | Port modals; fetch via backend | backend + sheets conn | M | ⬜ | Sheets range → chart |
| Widget interactivity / actions | Feature / Flow | Buttons/forms trigger submit/refresh/navigate/openModal/openDrawer; widget `actions[]` run | Wire the action→intent resolver to renderers + store/router | action resolver | M | ⬜ | Clicking a button/submitting a form performs its action |
| Undo / redo | Feature / Flow | Revert dashboard edits (mip undo stack, history length from config) | Port the undo stack into the store | store | S | ⬜ | Ctrl-Z reverts the last edit |
| Import-URL deep-link | Feature / Flow | base64url `mipImport` batch URL builds pages/widgets at boot | Port import-URL apply + MCP `create_import_url` | injection engine | M | ⬜ | Opening an import URL seeds the dashboard |
| Table cell formats + animations | Feature / Flow | 29 cell-format ids + 9 animation ids for table/KPI cells | Port `table-field-formats.json` + `table-field-animations.json` registries | table widget | S | ⬜ | Cells format/animate per id |

---

## I. Screens — UI/UX inventory (current mip-tailwind state)

Screen-by-screen UI/UX inventory across **both** systems. Status: ✅ built in mip-tailwind · 🟡 built, needs DB/real-data wiring · ⬜ exists in mip, not yet in mip-tailwind (target to migrate).

📷 **Screenshots:** drop PNGs in [`docs/screens/`](screens/README.md) named per the index there; they then embed inline per screen.

| Screen | Entry / Route | UI (layout & components) | UX (interaction & behavior) | Status |
|---|---|---|---|---|
| **App shell** | `/` | Three columns: collapsible left **Sidebar** (w-64) · center column (Topbar + main) · optional right **AI chat** panel. Dark Untitled theme. | Sidebar collapses to width-0 (animated); chat panel pushes content as a sibling; everything themed by tokens. | ✅ |
| **Login** | `/` (unauthenticated) | Auth gate (mip `AppRoot` → `LoginScreen`): brand mark, demo login (any password), one-click **"sign in as"** role chips. | No session → login screen; pick a chip / sign in → app mounts keyed by `userId` (clean remount on user switch). mip-tailwind has no auth gate yet (mock user only). | ⬜ |
| **Sidebar** | left of `/` | Brand header ("M" tile + "Protocol Foundation / MIP runtime"), **WORKSPACE** section with page nav items (Untitled `NavItemBase`, active highlight), `+` add page, user footer (avatar + "Super Admin" + chevron). **mip also groups pages into categories — Dashboards / Dynamic Pages / Workspace — plus custom workspaces, and supports pin / move-between-category.** | Click page → switch; hover page row → `•••` menu (Rename inline / Duplicate / Delete); collapse chevron hides sidebar; footer opens account menu (Profile / Settings / Sign out). mip-tailwind shows a **flat** page list — category groups (incl. Dynamic Pages), custom workspaces, and pin/move are not built. | 🟡 (flat list; categories/workspaces/pin-move ⬜) |
| **Topbar** | top of `/` | Left: chevron-right reopen (when collapsed) + "Page / <title>". Right: theme toggle (sun/moon), **responsive (feed) toggle**, **Dashboard-settings gear (per-page)**, **Templates**, Add-widget `+`, Edit-mode lock, AI sparkle — all Untitled `ButtonUtility`. | Toggles light/dark; responsive toggle re-flows to feed view; **gear opens the per-page Dashboard Settings modal** (system Settings is in the sidebar user menu); Templates opens the templates modal; `+` opens widget picker; lock toggles edit mode; sparkle opens chat. | ✅ |
| **Dashboard canvas** | `/` main | `react-grid-layout` grid of widget cards on the secondary bg; each widget is an Untitled-styled card (ring, rounded, token colors). | Read mode: hover a widget → expand button (top-right). Renders KPIs/charts/table/list/etc. from authored settings (→ live data later). | ✅ / 🟡 (live data) |
| **Edit mode** | lock toggle | Each widget shows a top-right toolbar: drag grip, edit (pencil), expand, delete; a brand ring on hover. | Drag by the grip to reorder; resize from SE corner; layout persists (localStorage → DB later). | ✅ / 🟡 (DB) |
| **Layout / Feed view (responsive)** | topbar responsive toggle (phone/monitor icon) | A phone icon ("Responsive view — single column") switches the page between **Layout view** (the multi-column grid) and **Feed view** — every widget full-width, stacked vertically as a single-column feed; a monitor icon switches back. | Toggle re-flows the page to one column for a mobile/responsive preview while preserving the underlying grid layout. | ✅ |
| **Widget picker** | topbar `+` | Untitled `Modal`: title "Add widget", search `Input`, catalog grouped by category (Data/Charts/Content/Marketing/Diagrams/Integrations) as ring cards with type label. | Search filters; click a card → widget added to bottom of page; modal closes. | ✅ |
| **Widget editor** | edit-mode pencil | Untitled `SlideoutMenu` drawer: "Edit widget / <type>", Title `Input`, **Settings (JSON)** `TextArea`, Cancel / Save. | Edit title + settings JSON → Save persists via store; invalid JSON shows error. **Design tab planned** (token-bound color/spacing/font/layout + nested elements). | ✅ (JSON) / ⬜ (Design tab) |
| **Widget expand** | hover expand | Untitled `Modal` (≤900px): header (title + close) + the widget rendered large. | Opens the widget full-size; click outside / X to close. | ✅ |
| **AI chat — sidebar** | topbar sparkle | Full-height right panel (w-96, border-l): header shows the **active connection · model** (e.g. "DeepSeek · deepseek-reasoner") or "No AI connection"; greeting ("How can I help you create your next interface?"); message list (user bubbles right, assistant markdown left w/ avatar); composer ("Ask anything…" + send); footer toolbar = compact/chat/sidebar mode toggles + **settings gear**. | Type + Enter to send; suggestion chips when empty + unconfigured; "thinking…" while awaiting; real reply when an AI connection is set (else demo responder); gear → Assistant Settings popover. | ✅ (UI) / 🟡 (real AI) |
| **AI chat — chat mode** | footer toggle | Same content as a **floating** rounded ~420px panel pinned top-right, shadowed/detached. | Toggle from footer; overlaps content rather than pushing it. | ✅ |
| **AI chat — compact mode** | footer toggle | Small floating bar pinned top-right: greeting/last assistant line + footer toolbar + composer only. | Minimal footprint for quick prompts; expand back to chat/sidebar. | ✅ |
| **Assistant Settings (in-chat popover)** | chat footer gear | Popover "Assistant Settings": **AI provider** — Connection `Select` (e.g. DeepSeek) + Model `Select` (e.g. DeepSeek-R1) + note "used automatically on send, no apply button"; **Connections the assistant can call** — checkbox grid of connections (Tavily, Gemma4 Local, DeepSeek, Binance, CoinGecko, Boudoir API…) each with base URL, enabling live tool requests to those endpoints. | Pick provider+model inline; toggle which connections the assistant may hit as tools. Built: the chat footer gear opens an Assistant Settings popover with provider Connection + Model + a callable-connections checkbox grid. | ✅ |
| **Settings shell (system-wide)** | **sidebar user menu → Settings** | Dedicated surface with its **own inner sidebar** (Profile · Appearance · Connections · Apps · Assistant · Access · Users) + content pane; outer workspace sidebar/topbar stay. Back arrow returns to dashboard. | Opens from the account/user menu (the topbar gear now opens per-page Dashboard Settings); click a tab → content swaps; back arrow closes. | ✅ |
| **Settings · Profile** | Settings | Avatar + name/role, Name & Email `Input`s, Save. | Edit fields → Save (local; → DB later). | ✅ (UI) / 🟡 (DB) |
| **Settings · Appearance** | Settings | **Token browser**: inner tabs Theme · Colors · Typography · Shadows · Spacing & Radius. Colors = Brand/Text/Bg/Border/Fg/Utility swatch grids w/ token name + live value; Type = font + display scale samples; Shadows = elevation boxes; Spacing/Radius = sized samples. Theme tab = light/dark/system + accent swatches. | Browse tokens; accent swatch + mode apply live. **Color tokens editable when DB is up** — swatch is a color picker → `PUT /api/tokens` for the active mode → applied live via the boot CSS overlay. Type/shadow/radius editing still planned. | ✅ (browser; colors editable) / 🟡 (other kinds) |
| **Settings · Connections (list)** | Settings | "Quick connect from installed apps" card grid + "Saved connections" list (avatar + name + type Badge) + "Custom connection" button. | Click an app/saved row → opens editor; Custom → new blank connection in editor. | ✅ (UI) / 🟡 (DB) |
| **Connection editor — data source** | from Connections list (saved/custom) | Full editor: **Data source** / **Source type** `Select` (REST API · JSON · CSV) / **Name**. REST → **Base URL** + **Authentication** `Select` (No auth · Bearer token · Basic auth · API key (header) · API key (query param) · Digest auth · Custom header) + matching credential field(s); JSON → **JSON payload** `TextArea` (e.g. `{"rows":[{"label":"A","value":10}]}`); CSV → **CSV payload** `TextArea` (e.g. `label,value\nA,10\nB,20`). **"This connection provides an AI model"** toggle (self-hosted/OpenAI-compatible LLM). **Connection headers** (`{{variable}}` Postman vars) + Add header. **Endpoint index** — empty state "No endpoints indexed"; each endpoint expands to **Endpoint label / Method `Select` / Path / Default map path (`$.data`) / Description / Query params (+Add param) / Body / Delete endpoint**; **+Add endpoint** & **Discover endpoints**. **Import Postman collection** — Collection JSON `TextArea` + Import collection. Footer: Save connection / **Test selected endpoint** / Delete / Close + Response preview. | Edit fields; Test posts via backend → JSON response preview; Save persists; AI-model toggle makes it selectable in Assistant. Secrets → encrypted at rest (planned). | ✅ (UI) / 🟡 (DB+encrypt) |
| **Connection editor — app / AI provider** | from a quick-connect app card | Simpler provider form: **Connection name**; tabs **API Key** / **OAuth (CLI/Web)**; API Key → masked **API Key** `Input` + **API Base URL** `Input` (e.g. `https://api.deepseek.com`); OAuth → client id/secret + scopes; footer Save connection / Test selected endpoint / Delete / Close. | Configure an installed app's credentials (e.g. DeepSeek) via API key or OAuth; Test verifies; Save persists (secrets encrypted, planned). | ✅ (via connect modal) / 🟡 (OAuth + DB) |
| **Settings · Apps** | Settings | Connector gallery grouped by category: colored brand logo tile + name + category + description + status (Connect button / "Coming soon" / "Scheduled" Badge); installed cards get a brand ring. Search bar. | Search filters; Connect → modal (API key / OAuth fields) → marks installed; installed → Disconnect. | ✅ (UI) / 🟡 (DB) |
| **Settings · Assistant** | Settings | **mip:** "Tune what the AI sidebar agent is allowed to do." **Permissions** — checkbox "Allow design-block CSS & script injection" (scoped `css`/`script` args on design-block widgets, auto-scoped per container, scripts in an isolated IIFE, cleaned up on removal) + checkbox "Allow second-opinion AI requests" (`mip_ai_request` tool to re-ask its own LLM). **Chat memory** — assistant recalls past chats via read-only memory tools, scoped to the user's **data-access level** (set per-user by an admin in Settings → Users, not self-granted). **mip-tailwind:** the Assistant tab instead has AI-connection + Model + System-prompt (provider/model lives in mip's in-chat popover). | Toggle assistant capabilities; memory scope is admin-set. Divergent surfaces to reconcile. | 🟡 (mip-tailwind has provider/model/prompt; missing CSS-script + second-opinion + memory-scope) |
| **Settings · Users** | Settings | Member list (avatar + name + email + role Badge) + Invite button. | Mock list now; CRUD + roles → DB/auth later. | 🟡 (mock) |
| **Settings · Access** | Settings | "Access": **This device's token** (`mip_…` `Input` + Save token / Clear) — the proxy bearer credential stored in this browser, sent on every proxy request; **Manage access tokens** (admin) — Name `Input` + Scope `Select` (Data / Admin) + Expires (days) `Input` + **Create token** (secret shown once); token list; proxy-reachability error line. | Paste/save the proxy token (localStorage `mip:proxy-token`); admins mint/revoke scoped API tokens (client-side registry until backend auth lands). | ✅ (UI) / 🟡 (backend auth) |
| **Dashboard Settings · General** | per-page settings (topbar gear / page menu) | Modal "Dashboard Settings" with left tabs (General · Access · Dynamic Variables). General = "Page Settings": Title `Input`, **Page ID** (e.g. `new-page-17-5zdir`), Description `TextArea`, **Layout Mode** `Select` (Dashboard sidebar+topbar / Fullpage) with helper, **AI assistant context (system prompt)** `TextArea` ("added to the assistant's system prompt whenever this dashboard is open"). Footer: Cancel / Save Settings. | Edit page identity, layout mode, and per-page assistant context; Save persists to the page via `store.updatePageSettings` (→ DB later). | ✅ |
| **Dashboard Settings · Access** | same modal | "Access Control" — role rows each with a Page-Access `Select`: **Admin** = Can edit (locked, can't restrict), **Editor** = Can edit, **Viewer** = View only, **Public** = No access; note re storage + workspace RBAC; **AI assistant access** checkbox "Allow the assistant to access this page" (off → hidden from assistant tools). | Set per-role page access (Admin locked to edit); toggle assistant page access; Save. Mirrors mip `pagePermissions`. | ✅ |
| **Dashboard Settings · Dynamic Variables** | same modal | "Define input variables for this dynamic page": **Add Variable**; each row = Variable name `Input` + source `Select` (**$_GET / Query · Path Variable · Body JSON**) + Required checkbox + delete. | Add/remove typed page variables for parameterized (dynamic) pages; Save. | ✅ |
| **Dashboard Templates** | topbar (templates control) | Modal "Dashboard Templates": search `Input` + category filter chips (All · Analytics · Finance · Management · General · Business · Marketing) + grid of template cards (icon tile, "N widgets" badge + warning icon when keys needed, title, description, category Badge, optional green "No keys needed" Badge). Templates incl. Analytics Dashboard, Crypto Monitor, Project Tracker, Quick Start, Sales Report (Shopify / WooCommerce). | Search/filter by category; click a card → opens the import-confirm view. | ✅ |
| **Template import (confirm)** | from a Templates card | Modal `Import "<name>"`: auto-config note (e.g. "✓ Auto-configured: Binance, CoinGecko — no API keys needed"), "This template will add **N widgets** to your current page", then buttons **Connect & Import** / **Continue with Mock Data** / **Set Up in Connections →**. | Pick: connect real APIs, use mock data, or jump to Connections first; imports the template's widgets as a new page (via `store.importTemplate`). | ✅ |
| **Start screen** | `/start` | The Untitled starter home (logo + "add component" hint). | Reference/landing; not the main app. | ✅ |
| **Gallery** | `/gallery` | One sample of every design-block/diagram/misc widget rendered via the adapter. | Visual QA surface for all renderers. | ✅ |

## Recommended migration order (critical path)

1. **Postgres + ORM + backend CRUD** (F+G foundation) — unblocks everything DB.
2. **`tokens` + `components` tables + registry resolution** (directive #2) — the design-system spine; make the Appearance browser editable + persisted.
3. **Widgetize atoms/molecules** into the registry pulling from DB components (directive #3).
4. **Persist dashboards/connections/settings to DB** (replace localStorage; directive #1).
5. **Document validator + injection engine + runtime bridge** (E) — the doc-integrity + mutation spine; unblocks safe AI builds and import-URL.
6. **Connectors execution engine + live widget data** (connections → backend → mock/rest/json/csv → JSONPath).
7. **AI tool catalog + prompted mode + aliases** (full tool set with dataMap/JSONPath gates), then **web search / image-gen tools**.
8. **Action → intent resolver + widget interactivity** (buttons/forms do something).
9. **Auth/login/users/roles** → **secretRef + OAuth** → **conversations + memory** → **MCP**.
10. **Undo/redo, import-URL, table cell formats/animations, sidebar categories/workspaces** (parity polish).
11. **Figma token sync** (foundations refresh loop).
