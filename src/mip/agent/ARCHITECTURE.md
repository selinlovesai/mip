# MIP Agent Architecture

The in-app assistant: an LLM driving a **typed, validated tool loop** over two
surfaces — a widget **dashboard** and a sandboxed **canvas**. This is the
canonical reference: the layers, the module map, exactly what the model sees each
turn, the reliability guards, and how to extend it.

---

## 1. The five layers

```
            ┌──────────────────────────────┐
            │          LLM (Brain)         │   provider (DeepSeek/OpenAI/Anthropic) via /api/chat
            └──────────────▲───────────────┘
              system+msgs  │   │  {say, ops[]}
            ┌──────────────┴───┴───────────────┐
            │            AGENT LOOP             │   agent.ts · runAgent()
            │  brain → parse → dispatch → feed  │
            └───┬───────────────────────┬───────┘
       composes │ prompt (per round)    │ registry (validate → run)
        ┌───────▼────────┐      ┌────────▼─────────┐
        │     SKILLS     │      │      TOOLS       │
        │ always|catalog │      │ doc·validate·run │
        │  (prompt.ts)   │      │  + on-demand idx │
        └────────────────┘      └────────┬─────────┘
                                  acts on │ ToolContext (the only door to the app)
                          ┌───────────────▼────────────────┐
                          │           SURFACES              │
                          │ dashboard store · canvas iframe │
                          │ connections · web (fetch/search)│
                          └─────────────────────────────────┘
```

| Layer | Module | Responsibility |
|---|---|---|
| **Brain** | `chat-panel.tsx brain()` → `api.ts chat()` → `server/main.py /api/chat` | One completion: provider/model, JSON mode, abort signal. |
| **Agent loop** | `agent.ts runAgent()` | Drive the turn: call brain, parse, validate+run ops, feed back, guard, stop. |
| **Reply parser** | `reply.ts` | Balanced-brace extraction → `{say, ops[]}`; tolerant of prose/fences/shapes. |
| **Skills** | `skills/*` + `prompt.ts` | Knowledge: `always` (inline) or `onDemand` (catalog + `loadSkill`). |
| **Tools** | `tools/*` | Registry: `{name, doc, summary, catalog, mutating, validate, run}`. |
| **Surfaces** | store · canvas bridge · connections · api | The real things tools read or mutate. |

Public API: `agent/index.ts`. UI glue (build `ToolContext`, render transcript,
JSON/API toggle, suggestions) lives in `shell/chat-panel.tsx`.

---

## 2. Module map (`src/mip/agent/`)

```
agent/
  index.ts        public barrel
  types.ts        AgentOp · OpResult · AgentReply · ApiMsg · Surface · Tool · ToolContext
  agent.ts        runAgent() — the loop + Brain type + RunAgentOptions
  reply.ts        parseAgentReply (balanced-brace) · coerceReply · claimsAction
  prompt.ts       buildSystemPrompt() · describeDashboard()
  config.ts       PageAgentConfig + resolveSkills()
  agent.test.ts   vitest unit tests (parser · skills · dispatch/validation · guards)
  tools/
    index.ts      ALL_TOOLS · toolsFor · catalogFor · toolIndexFor · isMutating · dispatch · describeTool
    integrations.ts  fetch · search(Tavily) · callApi(saved connection)
    injection.ts     injectJson · injectConnection · addWidget(alias)   (+ BINDABLE_TYPES)
    core.ts          listConnections · listWidgets · removeWidget · updateWidget · loadSkill · get/setContext · canvas DOM ops
  skills/
    index.ts · types.ts (Skill · SkillMode · SkillSurface)
    research.ts · mip-widgets.ts · injection.ts · canvas.ts
```

A **Tool** is the single source of truth tying an op `kind` → docs → validation →
implementation → mutation flag, so the catalog the model sees and the dispatcher
that runs ops cannot drift.

---

## 3. What the model receives each turn

Two inputs to `chat()`.

### A. `system` — `buildSystemPrompt(surface, …)`, re-built EVERY round
```
1 Context          page.systemPrompt + global assistant prompt        (user-authored, first)
2 This dashboard   TITLE · description · widgets as "id · type · title"  (describeDashboard — LIVE)
3 Role line        "you are the dashboard assistant" / canvas
4 Skills (always)  resolved skill blocks injected inline
5 Skill catalog    on-demand skills: name — description                 (→ loadSkill)
6 Tools (always)   full docs for essential tools (fetch/search/callApi/inject/list)
7 More tools       compact index of on-demand tools                    (→ describeTool)
8 Protocol         {say, ops} contract + worked examples
9 Directive        JSON/API injection mode (composer toggle)
```
Because it's recomputed each round from **live** page state, a widget added in
round 1 (with its real id) is visible in round 3 — no stale "no widgets" telling
the model to re-add things.

### B. `messages`
- Prior **user/assistant** turns only (tool/skills/status rows are UI-only, filtered out).
- Current message, augmented with the readable text of any URLs it contained.
- Each round appends `assistant(rawReply)` + `user("Tool results: …")` (results
  shrunk field-wise, see §4).

---

## 4. The turn loop (`runAgent`)

```
for round in 0..8:
  signal.aborted? ─────────────────► return                       (Stop button)
  reply = brain(messages, buildSystem(), jsonMode, signal)         ← system rebuilt per round
  parsed = parseAgentReply(reply)                                  (balanced-brace, tolerant)
  ├ no JSON?   → nudge once "reply ONLY {say,ops}"; else finish(text); return
  ├ ops==[] ?  → claims action & nothing mutated & NOT a question? → nudge; else finish(say); return
  └ ops:
      emit(say)                                  (non-blank only)
      for op in ops:
          mutated |= isMutating(op.kind)
          result  = dispatch(op, surface, ctx)   ── validate(op) → run(op,ctx)
          lastError = result.error (if failed)
          onTool(op,result)                       ── collapsible transcript row
      messages += assistant(reply) + user("Tool results: " + summarizeResult(results))
finish() → say step-limit note
```

### Reliability guards (all live)
- **JSON mode** (OpenAI-compatible) → no prose refusals.
- **Balanced-brace parse** → skips stray prose braces; never truncates nested objects; never dumps raw JSON to chat.
- **Prose nudge** → recovers a narrated reply once.
- **Op validation** → a malformed op (missing `url`/`query`/`sourceId`/`type`/`id`) returns a typed error and is **not** applied; the model self-corrects.
- **Mutation guard** → catches "I added a widget" with no mutating op — fires **only when the user asked for a change** (add/edit/remove…), so questions and "confirm you deleted it" don't trip it.
- **Failure circuit-breaker** → halts after N consecutive all-failed rounds (`maxFailStreak`, default 2) and reports the error — no burning 8 rounds on repeated 404s/validation errors.
- **Endpoint guard (structural)** → `callApi` rejects any path that isn't a listed endpoint of the connection (placeholder/numeric-aware) **before the network call** — guessing is impossible, not just discouraged; the error points at `findEndpoints` with `didYouMean`/`resourceAreas`.
- **No blank output / graceful finish** → assistant text is emitted only when non-blank; if a turn ends saying nothing, the **last tool error** (or a neutral note) is surfaced instead of an empty bubble.
- **Structured truncation** → tool results shrink field-wise (clip strings, cap arrays) keeping VALID JSON.
- **Abort** → Stop sets the signal; the loop bails AND the in-flight `fetch`/`testEndpoint`/model call is cancelled.
- **Canvas isolation** → the iframe runs `allow-scripts` WITHOUT `allow-same-origin` (opaque origin, no host access); the parent bridge ignores any postMessage whose `source` isn't our iframe.

---

## 5. Tools registry + ToolContext

`dispatch(op, surface, ctx)`: resolve by `op.kind` → check surface → `validate(op)`
→ `run(op, ctx)`. Everything a tool needs arrives via **`ToolContext`**, rebuilt
each send and **pinned to one `pageId`** (captured at send), so a dashboard switch
mid-run can't cross-write:

```
ToolContext = {
  fetchPage · testEndpoint              web / proxy (carry the AbortSignal)
  connections · resolveConnection · tavily   saved APIs (dashboard-allowed subset)
  canvasSend                            sandboxed iframe bridge
  listWidgets · getWidget · addWidget · updateWidget · removeWidget · widgetSize
                                        store — reads via LIVE getPage(pageId), writes target pageId
  getContext · setContext               page system-prompt note
  getSkill                              on-demand skill lookup (loadSkill)
  apiCalls[]                            turn scratch (strict-REST guard)
  injectMode                            JSON/API toggle (enforced)
}
```

Tool inventory:
- **integrations** (read): `fetch` · `search` · `callApi` · `findEndpoints` (keyword-search a connection's own endpoints, so the agent picks a real path instead of guessing/web-searching).
- **injection** (mutate): `injectJson` (inline) · `injectConnection` (live bind) · `addWidget` (alias).
- **core**: `listConnections`/`listWidgets` (read) · `removeWidget`/`updateWidget` (mutate; edit/move/resize) · `loadSkill`/`get`/`setContext` · `describeTool` · canvas DOM ops.

**On-demand tool catalog:** tools flagged `catalog:true` (editing, context,
loadSkill) appear as a one-line index; the agent expands one with
`describeTool { name }` before use. Essentials keep full docs inline — lean
prompt, full discoverability.

**Injection enforcement** (data widgets only — `BINDABLE_TYPES`: kpi, progress,
charts, table, list, detail):
- `injectMode === "api"` → `injectJson` hard-refused for data widgets (→ `injectConnection`).
- a `callApi` happened this turn → `injectJson` refused for data widgets (snapshotting live data is wrong); relaxed under `json` mode.
- static/utility widgets (header, markdown, card, CTA, image…) are **always** allowed via `injectJson`.

---

## 6. Per-dashboard agent config (global default fills gaps)

| Aspect | Source |
|---|---|
| Connection / model | `page.agent.connectionId/model` → `assistant.*` → first AI connection |
| Skills | NATIVE on minus `disabledSkillIds`, plus `enabledSkillIds`; `resolveSkills()` filters by surface; each skill is `always` or `onDemand` |
| Callable connections | `page.agent.callableConnectionIds` → gates `ctx.connections` |
| Context | `page.systemPrompt` (Dashboard Settings → Agent) |
| Injection mode | composer JSON/API toggle → `ctx.injectMode` |

Configured in **Settings** (global assistant, Skills library, Widgets defaults)
and **Dashboard Settings → Agent** (per-page model/skills/connections/context).

---

## 7. End-to-end: "show the latest posts from the Boudoir API" (API mode)

```
chat-panel.sendText
  ├ pageId = activePage.id                                    (pin for the run)
  ├ system = () => context + LIVE dashboard facts + skills(+catalog) + tools(+index) + protocol + "API mode"
  ├ ToolContext(pageId, signal, activeSkills)                 (live getPage, page-targeted writes)
  └ runAgent:
      r1  {ops:[listConnections]}                 → ids + endpoints
      r2  {ops:[callApi sourceId,path]}            → JSON shape (apiCalls += …)
      r3  {ops:[injectConnection …map…]}           → bound widget, first-fit placement
          (tries injectJson? → validate/guard refuses → "use injectConnection")
      r4  {ops:[]}                                 → finish(say)
   each op → collapsible transcript row; failures surface a typed error
```

---

## 8. Tests

`npm test` (vitest, `agent.test.ts`) covers the pure core: parser shapes
(fenced / balanced / alt-key / single-op / no-dump / prose / stray-brace),
`claimsAction`, `resolveSkills` (builtins on, disable/enable, surface filter), and
`dispatch` (unknown op, cross-surface block, validation, API-mode refusal, static
exemption, `updateWidget` merge, mutation flags, catalog split). `npm run typecheck`
runs the full type build.

---

## 9. Known gaps / next

- **Secrets not persisted** (by design) — model lists / callApi / search degrade
  after reload until keys are re-entered. Needs encrypted-at-rest storage (backend).
- **Research is soft** — the agent can still reflexively search or invent figures;
  prompt-guided only. A sourcing convention (each data widget records its source)
  would make it auditable.
- **Cross-turn data memory** — tool results aren't persisted across turns; the
  agent is told to keep key figures in its `say`. A small rolling tool-result
  cache (last 2–3) injected into history would make follow-ups ("what was that
  number?") answerable without re-running the tool.
- **Canvas agent** shares the loop but its surface ops differ; deferred to a
  dedicated pass.
- **Token budget** — `always` skills + essential tool docs ship every turn; the
  on-demand catalog could extend further if needed.
```
