# mip → mip-tailwind — Migration Plan & Module Table

Mapping the original **mip** (vanilla-CSS, `mdp`) system onto **mip-tailwind** (Tailwind v4 + Untitled UI), under the locked architecture directives.

## Architecture directives (the "new system" rules)

1. **Everything persists to PostgreSQL.** All data currently in JSON files (dashboards, widgets, connections, apps, conversations, users, settings, themes, templates, tokens, components) is saved to a Postgres DB owned by the `server/` backend — localStorage becomes a cache only.
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
| Color tokens | Foundation (Token) | Brand ramp + semantic colors driving every surface | Move Untitled `@theme` colors into a `tokens` table (name, value, mode, group); emit CSS vars from DB at boot; edit via Settings → Appearance | DB + token API | L | 🟡 (browser UI + accent/mode override done; not DB-backed) | Editing a color from Settings → Appearance writes to DB and recolors app on reload; no hardcoded hex |
| Typography tokens | Foundation (Token) | Font families + display/text scale | Tokenize into `tokens` (group=typography); components reference token names; edit via Settings → Appearance | tokens table | M | 🟡 (shown in Appearance; not DB) | Type scale editable from DB **and** from Settings → Appearance UI |
| Shadow tokens | Foundation (Token) | Elevation scale | Tokenize shadows; edit via Settings → Appearance | tokens table | S | 🟡 (shown in Appearance) | Shadows editable from DB **and** from Settings → Appearance UI |
| Spacing tokens | Foundation (Token) | Spacing/gutter scale | Tokenize spacing; edit via Settings → Appearance | tokens table | M | 🟡 (shown in Appearance) | Spacing propagates from DB; editable from Settings → Appearance UI |
| Radius tokens | Foundation (Token) | Corner-radius scale | Tokenize radius; edit via Settings → Appearance | tokens table | S | 🟡 (shown in Appearance) | Radius editable from DB **and** from Settings → Appearance UI |
| Appearance token browser | Pattern / Block | Categorized token UI (Colors/Type/Shadows/Spacing) — the editing surface for every token | Done (read-only); make each token value editable inline + persist to `tokens` | tokens table | M | ✅ (read-only browser) | Editing any token in Appearance writes to DB and updates the app |
| Token emit pipeline (JSON + CSS) | Service / Feature | Compiles DB tokens to a **cached JSON** artifact and a **Tailwind-compatible CSS** (`@theme` / `:root` CSS vars) the app + Tailwind utilities consume | Backend job: `tokens` → `tokens.json` cache + generated `theme.css` (`@theme {…}`); invalidate cache on token edit; app loads the generated CSS at boot | tokens table + backend | L | ⬜ | DB tokens → JSON cache + Tailwind `@theme` CSS; `bg-primary`/`text-*`/`rounded-md` resolve from emitted vars; cache busts on edit |
| Figma token sync | Feature / Flow | Pull tokens from Figma → DB | Figma MCP / Tokens Studio export → `tokens` upsert job (feeds the JSON+CSS emit pipeline) | tokens table + Figma | L | ⬜ | Figma push updates DB tokens → re-emits JSON + CSS |

---

## B. Elements (Atoms) — widgetized indivisible UI

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
| Widget picker / editor | Pattern / Block | Add/edit widgets | Done | — | S | ✅ | Add + edit widgets |

---

## E. Modules (frontend architecture)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| `MipWidget` schema/contract | Module | Widget/document type contract | Ported; extend to reference tokenIds/componentIds | — | S | ✅ / 🟡 (refs) | Compiles; widgets reference ids |
| UI-kit adapter + registry | Module | `WidgetType` → renderer (kit-agnostic) | Done; extend to atoms/molecules + DB component lookup | components table | M | ✅ / 🟡 (DB) | Swapping adapter reskins app |
| Dashboard store | Module | Pages/widgets/edit/layout state | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (DB) | State persists to DB |
| Settings store | Module | Connections/apps/assistant config | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (DB) | Persists to DB |
| API client (`api.ts`) | Module | Calls FastAPI backend | Done (chat + test); add DB CRUD | backend routes | S | ✅ / 🟡 | CRUD + chat work |

---

## F. Data models (PostgreSQL tables) — directives #1 & #2

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| `tokens` | Data model (DB) | Design tokens (color/type/spacing/radius/shadow) | New table; seed from Untitled `@theme`; serve as CSS vars | Postgres + backend | L | ⬜ | Tokens CRUD; app reads from DB |
| `components` | Data model (DB) | Atom/molecule/pattern defs widgets pull from | New table (id, kind, props schema, token refs, variant); registry resolves by id | Postgres + registry | XL | ⬜ | Widgets render from DB component rows |
| `widgets`/`dashboards`/`pages` | Data model (DB) | Dashboard docs (reference token/component ids) | Replace seed.ts + localStorage with DB (jsonb, mip parity) | Postgres + backend | L | ⬜ (localStorage) | Dashboards load/save from DB |
| `connections` | Data model (DB) | Data sources (auth/headers/endpoints/isAiModel) | Persist settings-store connections to DB | Postgres | M | ⬜ | Survive across devices |
| `apps` / `installed_apps` | Data model (DB) | Connector catalog + install state | Move `apps-catalog.ts` → DB | Postgres | M | ⬜ | Catalog + install state from DB |
| `conversations` | Data model (DB) | Chat transcripts per dashboard/page | New table (mip composite PK) | Postgres + backend | M | ⬜ (in-memory) | Chat history persists |
| `users` | Data model (DB) | Identity, roles, scopes | New table (mip parity); hash server-only | Postgres + auth | L | ⬜ (mock) | Users CRUD; roles enforced |
| `themes` / `templates` | Data model (DB) | Palettes + starter dashboards | JSON → DB | Postgres | M | ⬜ | From DB |
| `access_tokens` | Data model (DB) | API tokens (hash only) | New table (mip parity) | Postgres + auth | M | ⬜ | Mint/revoke tokens |

---

## G. Services (backend / runtime)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| FastAPI backend | Service | Chat + endpoint-test proxy | Done (`server/`); expand to DB CRUD | Postgres | M | 🟡 (chat + test) | All data flows through backend |
| Postgres + ORM layer | Service | DB access (SQLAlchemy/asyncpg) | New: schema + migrations + seed (mirror `@mip/db`) | Postgres instance | L | ⬜ | Migrate + seed succeed |
| AI chat (real inference) | Service / Flow | Provider proxy (OpenAI/Anthropic/local) | Done; add tool-use loop + widget injection | connections in DB | L | 🟡 (chat; no tool-injection) | Assistant injects widgets via tools |
| secretRef / secret storage | Service / Feature | Keep keys server-side | New: store + resolve `secretRef` in backend | Postgres + backend | M | ⬜ (client-side now) | Keys never reach browser |
| OAuth flow | Service / Flow | code → token exchange | New: `/oauth/exchange` + callback (mip parity) | backend + manifests | L | ⬜ | OAuth connect succeeds |
| MCP server | Service | Tools to create/validate/inject dashboards | New: port mip-mcp-server | schema + injection | L | ⬜ | MCP client builds dashboards |
| Endpoint test proxy | Service | Tests REST endpoints (CORS bypass) | Done | — | S | ✅ | Returns status + body |

---

## H. Features / Flows (cross-cutting)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Drag-drop + resize | Feature / Flow | Rearrange widgets | Done (RGL v2) | layout in DB | M | ✅ / 🟡 (DB) | Layout persists to DB |
| Persistence (3-tier) | Feature / Flow | localStorage → backend → DB | Add DB write-through (mip pattern) | Postgres | L | 🟡 (localStorage) | Survives reload + device switch |
| Live widget data | Feature / Flow | Widgets fetch from connections | Wire `WidgetDataState` → backend query (connection+endpoint+JSONPath) | connections in DB + backend | L | ⬜ (authored settings) | Widget shows live API data |
| Theme/appearance | Feature / Flow | Light/dark + accent + tokens | Done; persist tokens to DB | tokens table | M | ✅ / 🟡 (DB) | Theme persists from DB |
| Auth / roles / permissions | Feature / Flow | Users, page permissions | New: login + roles + page access (mip parity) | users table + backend | XL | ⬜ | Role-gated edit/view works |
| Chat memory / recall | Feature / Flow | Scoped past-conversation recall | New: memory search over `conversations` (scope server-side) | conversations + auth | L | ⬜ | Assistant recalls prior context |
| Dynamic pages / variables | Feature / Flow | Parameterized pages | Port page variables + dynamic-page category | pages in DB | M | ⬜ | Dynamic pages resolve vars |
| Templates import | Feature / Flow | Starter dashboards | Port template picker → DB templates | templates table | M | ⬜ | Import seeds a dashboard |
| Google Sheets builder | Feature / Flow | Sheets → chart widget | Port modals; fetch via backend | backend + sheets conn | M | ⬜ | Sheets range → chart |

---

## Recommended migration order (critical path)

1. **Postgres + ORM + backend CRUD** (F+G foundation) — unblocks everything DB.
2. **`tokens` + `components` tables + registry resolution** (directive #2) — the design-system spine; make the Appearance browser editable + persisted.
3. **Widgetize atoms/molecules** into the registry pulling from DB components (directive #3).
4. **Persist dashboards/connections/settings to DB** (replace localStorage; directive #1).
5. **Live widget data** (connections → backend → JSONPath).
6. **Auth/users/roles** → **secretRef + OAuth** → **conversations + memory** → **MCP**.
7. **Figma token sync** (foundations refresh loop).
