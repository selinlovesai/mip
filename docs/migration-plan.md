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
| Dashboard store | Module | Pages/widgets/edit/layout state | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (DB) | State persists to DB |
| Settings store | Module | Connections/apps/assistant config | Done (localStorage); back with DB | DB API | M | ✅ / 🟡 (DB) | Persists to DB |
| API client (`api.ts`) | Module | Calls FastAPI backend | Done (chat + test); add DB CRUD | backend routes | S | ✅ / 🟡 | CRUD + chat work |

---

## F. Data models (PostgreSQL tables) — directives #1 & #2

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| `tokens` | Data model (DB) | Design tokens (color/type/spacing/radius/shadow) | New table; seed from Untitled `@theme`; serve as CSS vars | Postgres + backend | L | ⬜ | Tokens CRUD; app reads from DB |
| `components` | Data model (DB) | Atom/molecule/pattern defs widgets pull from | New table (id, kind, props schema, token refs, variant); registry resolves by id; **cached as JSON** | Postgres + registry | XL | ⬜ | Widgets render from DB component rows; JSON cache busts on edit |
| `widgets`/`dashboards`/`pages` | Data model (DB) | Dashboard docs (reference token/component ids) | Replace seed.ts + localStorage with DB (jsonb, mip parity); **cached as JSON** | Postgres + backend | L | ⬜ (localStorage) | Dashboards load/save from DB; JSON cache |
| `connections` | Data model (DB) | Data sources (auth/headers/endpoints/isAiModel) | Persist settings-store connections to DB; **encrypt credential fields at rest** (API keys/tokens/passwords) via app-level AES-GCM or pgcrypto, key from env/KMS; decrypt only server-side at request time; never return secrets to the browser (masked) | Postgres + encryption key | L | ⬜ | Connections persist + survive devices; secrets encrypted at rest, never sent to client in plaintext |
| `apps` / `installed_apps` | Data model (DB) | Connector catalog + install state | Move `apps-catalog.ts` → DB; **cached as JSON** | Postgres | M | ⬜ | Catalog + install state from DB; JSON cache |
| `conversations` | Data model (DB) | Chat transcripts per dashboard/page | New table (mip composite PK) | Postgres + backend | M | ⬜ (in-memory) | Chat history persists |
| `users` | Data model (DB) | Identity, roles, scopes | New table (mip parity); hash server-only | Postgres + auth | L | ⬜ (mock) | Users CRUD; roles enforced |
| `themes` / `templates` | Data model (DB) | Palettes + starter dashboards | JSON → DB; **cached as JSON** | Postgres | M | ⬜ | From DB; JSON cache |
| `access_tokens` | Data model (DB) | API tokens (hash only) | New table (mip parity) | Postgres + auth | M | ⬜ | Mint/revoke tokens |

---

## G. Services (backend / runtime)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| FastAPI backend | Service | Chat + endpoint-test proxy | Done (`server/`); expand to DB CRUD | Postgres | M | 🟡 (chat + test) | All data flows through backend |
| Postgres + ORM layer | Service | DB access (SQLAlchemy/asyncpg) | New: schema + migrations + seed (mirror `@mip/db`) | Postgres instance | L | ⬜ | Migrate + seed succeed |
| AI chat (real inference) | Service / Flow | Provider proxy (OpenAI/Anthropic/local) | Done; add tool-use loop + widget injection | connections in DB | L | 🟡 (chat; no tool-injection) | Assistant injects widgets via tools |
| secretRef / secret storage | Service / Feature | Keep keys server-side, **encrypted at rest** | New: encrypt secrets (AES-GCM/pgcrypto, key from env/KMS) on write; store + resolve `secretRef` in backend; decrypt in-memory only at request time; mask on read | Postgres + encryption key | M | ⬜ (client-side now) | Keys never reach browser; ciphertext at rest; rotate-able key |
| OAuth flow | Service / Flow | code → token exchange | New: `/oauth/exchange` + callback (mip parity) | backend + manifests | L | ⬜ | OAuth connect succeeds |
| MCP server | Service | Tools to create/validate/inject dashboards | New: port mip-mcp-server | schema + injection | L | ⬜ | MCP client builds dashboards |
| Endpoint test proxy | Service | Tests REST endpoints (CORS bypass) | Done | — | S | ✅ | Returns status + body |

---

## H. Features / Flows (cross-cutting)

| Item | Type | What it Does | How to Migrate | Prerequisites | Complexity | Status | Success Criteria |
|---|---|---|---|---|---|---|---|
| Widget Design tab | Feature / Flow | Per-widget **Design** tab in settings — edit color/spacing/font/layout of the widget **and the elements/components nested inside it**, bound to tokens (pick a token or override) | Add a Design tab to the widget editor: token-bound controls (color pickers from `tokens`, spacing/radius/font selectors, layout); for molecules/patterns, a sub-element targeting tree; overrides save to `widget.style`/per-element style, defaults inherit from token/component | tokens + components in DB; widget editor | L | ⬜ | Changing a token-bound control restyles the widget (and chosen nested element) live and persists |
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

## I. Screens — UI/UX inventory (current mip-tailwind state)

Screen-by-screen UI/UX inventory across **both** systems. Status: ✅ built in mip-tailwind · 🟡 built, needs DB/real-data wiring · ⬜ exists in mip, not yet in mip-tailwind (target to migrate).

| Screen | Entry / Route | UI (layout & components) | UX (interaction & behavior) | Status |
|---|---|---|---|---|
| **App shell** | `/` | Three columns: collapsible left **Sidebar** (w-64) · center column (Topbar + main) · optional right **AI chat** panel. Dark Untitled theme. | Sidebar collapses to width-0 (animated); chat panel pushes content as a sibling; everything themed by tokens. | ✅ |
| **Sidebar** | left of `/` | Brand header ("M" tile + "Protocol Foundation / MIP runtime"), **WORKSPACE** section with page nav items (Untitled `NavItemBase`, active highlight), `+` add page, user footer (avatar + "Super Admin" + chevron). | Click page → switch; hover page row → `•••` menu (Rename inline / Duplicate / Delete); collapse chevron hides sidebar; footer opens account menu (Profile / Settings / Sign out). | ✅ |
| **Topbar** | top of `/` | Left: chevron-right reopen (when collapsed) + "Page / <title>". Right: theme toggle (sun/moon), Settings gear, Add-widget `+`, Edit-mode lock, AI sparkle — all Untitled `ButtonUtility`. | Toggles light/dark; gear opens Settings surface; `+` opens widget picker; lock toggles edit mode (drag/resize); sparkle opens chat. Active controls get a brand ring. | ✅ |
| **Dashboard canvas** | `/` main | `react-grid-layout` grid of widget cards on the secondary bg; each widget is an Untitled-styled card (ring, rounded, token colors). | Read mode: hover a widget → expand button (top-right). Renders KPIs/charts/table/list/etc. from authored settings (→ live data later). | ✅ / 🟡 (live data) |
| **Edit mode** | lock toggle | Each widget shows a top-right toolbar: drag grip, edit (pencil), expand, delete; a brand ring on hover. | Drag by the grip to reorder; resize from SE corner; layout persists (localStorage → DB later). | ✅ / 🟡 (DB) |
| **Widget picker** | topbar `+` | Untitled `Modal`: title "Add widget", search `Input`, catalog grouped by category (Data/Charts/Content/Marketing/Diagrams/Integrations) as ring cards with type label. | Search filters; click a card → widget added to bottom of page; modal closes. | ✅ |
| **Widget editor** | edit-mode pencil | Untitled `SlideoutMenu` drawer: "Edit widget / <type>", Title `Input`, **Settings (JSON)** `TextArea`, Cancel / Save. | Edit title + settings JSON → Save persists via store; invalid JSON shows error. **Design tab planned** (token-bound color/spacing/font/layout + nested elements). | ✅ (JSON) / ⬜ (Design tab) |
| **Widget expand** | hover expand | Untitled `Modal` (≤900px): header (title + close) + the widget rendered large. | Opens the widget full-size; click outside / X to close. | ✅ |
| **AI chat — sidebar** | topbar sparkle | Full-height right panel (w-96, border-l): header shows the **active connection · model** (e.g. "DeepSeek · deepseek-reasoner") or "No AI connection"; greeting ("How can I help you create your next interface?"); message list (user bubbles right, assistant markdown left w/ avatar); composer ("Ask anything…" + send); footer toolbar = compact/chat/sidebar mode toggles + **settings gear**. | Type + Enter to send; suggestion chips when empty + unconfigured; "thinking…" while awaiting; real reply when an AI connection is set (else demo responder); gear → Assistant Settings popover. | ✅ (UI) / 🟡 (real AI) |
| **AI chat — chat mode** | footer toggle | Same content as a **floating** rounded ~420px panel pinned top-right, shadowed/detached. | Toggle from footer; overlaps content rather than pushing it. | ✅ |
| **AI chat — compact mode** | footer toggle | Small floating bar pinned top-right: greeting/last assistant line + footer toolbar + composer only. | Minimal footprint for quick prompts; expand back to chat/sidebar. | ✅ |
| **Assistant Settings (in-chat popover)** | chat footer gear | Popover "Assistant Settings": **AI provider** — Connection `Select` (e.g. DeepSeek) + Model `Select` (e.g. DeepSeek-R1) + note "used automatically on send, no apply button"; **Connections the assistant can call** — checkbox grid of connections (Tavily, Gemma4 Local, DeepSeek, Binance, CoinGecko, Boudoir API…) each with base URL, enabling live tool requests to those endpoints. | Pick provider+model inline; toggle which connections the assistant may hit as tools. mip-tailwind has provider/model in Settings → Assistant but not this in-chat popover + callable-connections toggles. | ⬜ |
| **Settings shell** | gear → main swaps | Dedicated surface with its **own inner sidebar** (Profile · Appearance · Connections · Apps · Assistant · Users) + content pane; outer workspace sidebar/topbar stay. Back arrow returns to dashboard. | Click a tab → content swaps; back arrow closes settings. | ✅ |
| **Settings · Profile** | Settings | Avatar + name/role, Name & Email `Input`s, Save. | Edit fields → Save (local; → DB later). | ✅ (UI) / 🟡 (DB) |
| **Settings · Appearance** | Settings | **Token browser**: inner tabs Theme · Colors · Typography · Shadows · Spacing & Radius. Colors = Brand/Text/Bg/Border/Fg/Utility swatch grids w/ token name + live value; Type = font + display scale samples; Shadows = elevation boxes; Spacing/Radius = sized samples. Theme tab = light/dark/system + accent swatches. | Browse tokens (read-only now); accent swatch + mode apply live. **Inline editing → DB planned.** | ✅ (browser) / ⬜ (editable) |
| **Settings · Connections (list)** | Settings | "Quick connect from installed apps" card grid + "Saved connections" list (avatar + name + type Badge) + "Custom connection" button. | Click an app/saved row → opens editor; Custom → new blank connection in editor. | ✅ (UI) / 🟡 (DB) |
| **Settings · Connection editor** | from list | mip-parity editor: Data source / Source type (REST/JSON/CSV) / Name; Base URL + Authentication (7 modes); "This connection provides an AI model" toggle (+ provider/model); Connection headers; Endpoint index (per-endpoint method/path/map-path/body/params editor); Add/Discover endpoints; Import Postman; footer Save / Test selected endpoint / Delete / Close + Response preview. | Edit fields; Test posts via backend → JSON response preview; Save persists; AI-model toggle makes it selectable in Assistant. Secrets → encrypted at rest (planned). | ✅ (UI) / 🟡 (DB+encrypt) |
| **Settings · Apps** | Settings | Connector gallery grouped by category: colored brand logo tile + name + category + description + status (Connect button / "Coming soon" / "Scheduled" Badge); installed cards get a brand ring. Search bar. | Search filters; Connect → modal (API key / OAuth fields) → marks installed; installed → Disconnect. | ✅ (UI) / 🟡 (DB) |
| **Settings · Assistant** | Settings | Select AI-model connection + Model `Input` + System-prompt `TextArea` + Save; empty-state guidance when no AI connection. | Pick connection/model/prompt → Save; feeds the chat panel. | ✅ (UI) / 🟡 (DB) |
| **Settings · Users** | Settings | Member list (avatar + name + email + role Badge) + Invite button. | Mock list now; CRUD + roles → DB/auth later. | 🟡 (mock) |
| **Dashboard Settings · General** | per-page settings (topbar gear / page menu) | Modal "Dashboard Settings" with left tabs (General · Access · Dynamic Variables). General = "Page Settings": Title `Input`, **Page ID** (e.g. `new-page-17-5zdir`), Description `TextArea`, **Layout Mode** `Select` (Dashboard sidebar+topbar / Fullpage) with helper, **AI assistant context (system prompt)** `TextArea` ("added to the assistant's system prompt whenever this dashboard is open"). Footer: Cancel / Save Settings. | Edit page identity, layout mode, and per-page assistant context; Save persists to the page (→ DB). | ⬜ |
| **Dashboard Settings · Access** | same modal | "Access Control" — role rows each with a Page-Access `Select`: **Admin** = Can edit (locked, can't restrict), **Editor** = Can edit, **Viewer** = View only, **Public** = No access; note re storage + workspace RBAC; **AI assistant access** checkbox "Allow the assistant to access this page" (off → hidden from assistant tools). | Set per-role page access; toggle assistant page access; Save. Mirrors mip `pagePermissions`. | ⬜ |
| **Dashboard Settings · Dynamic Variables** | same modal | "Define input variables for this dynamic page": **Add Variable**; each row = Variable name `Input` + source `Select` (**$_GET / Query · Path Variable · Body JSON**) + Required checkbox + delete. | Add/remove typed page variables for parameterized (dynamic) pages; Save. | ⬜ |
| **Dashboard Templates** | topbar (templates control) | Modal "Dashboard Templates": search `Input` + category filter chips (All · Analytics · Finance · Management · General · Business · Marketing) + grid of template cards (icon tile, "N widgets" badge + warning icon when keys needed, title, description, category Badge, optional green "No keys needed" Badge). Templates incl. Analytics Dashboard, Crypto Monitor, Project Tracker, Quick Start, Sales Report (Shopify / WooCommerce). | Search/filter by category; click a card → opens the import-confirm modal. | ⬜ |
| **Template import (confirm)** | from a Templates card | Modal `Import "<name>"`: auto-config note (e.g. "✓ Auto-configured: Binance, CoinGecko — no API keys needed"), "This template will add **N widgets** to your current page", then buttons **Connect & Import** / **Continue with Mock Data** / **Set Up in Connections →**. | Pick: connect real APIs, use mock data, or jump to Connections first; injects the template's widgets + dataSources into the page. | ⬜ |
| **Start screen** | `/start` | The Untitled starter home (logo + "add component" hint). | Reference/landing; not the main app. | ✅ |
| **Gallery** | `/gallery` | One sample of every design-block/diagram/misc widget rendered via the adapter. | Visual QA surface for all renderers. | ✅ |

## Recommended migration order (critical path)

1. **Postgres + ORM + backend CRUD** (F+G foundation) — unblocks everything DB.
2. **`tokens` + `components` tables + registry resolution** (directive #2) — the design-system spine; make the Appearance browser editable + persisted.
3. **Widgetize atoms/molecules** into the registry pulling from DB components (directive #3).
4. **Persist dashboards/connections/settings to DB** (replace localStorage; directive #1).
5. **Live widget data** (connections → backend → JSONPath).
6. **Auth/users/roles** → **secretRef + OAuth** → **conversations + memory** → **MCP**.
7. **Figma token sync** (foundations refresh loop).
