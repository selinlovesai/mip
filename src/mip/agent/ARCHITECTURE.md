# MIP Agent Architecture

The in-app assistant: an LLM driving a **typed tool loop** over two surfaces (a
widget **dashboard** and a sandboxed **canvas**). This doc is the modular
reference — what's connected to what, exactly what data the model sees, and the
reliability guards that keep it honest.

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
       composes │ prompt          uses  │ registry (validate → run)
        ┌───────▼────────┐      ┌────────▼─────────┐
        │     SKILLS     │      │      TOOLS       │
        │ always | catalog│     │ doc·validate·run │
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
| **Reply parser** | `reply.ts` | Tolerantly turn model text into `{say, ops[]}`. |
| **Skills** | `skills/*` + `prompt.ts` | Knowledge: `always` (inline) or `onDemand` (catalog + `loadSkill`). |
| **Tools** | `tools/*` | Registry: `{name, doc, summary, catalog, mutating, validate, run}`. |
| **Surfaces** | store / canvas bridge / connections / api | The real things tools read or mutate. |

Public API: `agent/index.ts`. UI glue (build `ToolContext`, render transcript,
JSON/API toggle) lives in `shell/chat-panel.tsx`.

---

## 2. Module map (`src/mip/agent/`)

```
agent/
  index.ts        public barrel
  types.ts        AgentOp · OpResult · AgentReply · ApiMsg · Surface · Tool · ToolContext
  agent.ts        runAgent() — loop + Brain type + RunAgentOptions
  reply.ts        parseAgentReply / coerceReply / claimsAction
  prompt.ts       buildSystemPrompt() · describeDashboard()
  config.ts       PageAgentConfig + resolveSkills()
  agent.test.ts   unit tests (parser · resolveSkills · dispatch/validation · catalog split)
  tools/
    index.ts      ALL_TOOLS · toolsFor · catalogFor · toolIndexFor · isMutating · dispatch · describeTool
    integrations.ts  fetch · search(Tavily) · callApi(saved connection)
    injection.ts     injectJson · injectConnection · addWidget(alias)
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

Two inputs to `chat()`:

### A. `system` — `buildSystemPrompt(surface, …)`
```
1 Context          page.systemPrompt + global assistant prompt   (user-authored)
2 This dashboard   TITLE · description · current widgets          (describeDashboard — live facts)
3 Role line        "you are the dashboard assistant" / canvas
4 Skills (always)  resolved skill blocks injected inline
5 Skill catalog    on-demand skills: name — description  (→ loadSkill)
6 Tools (always)   full docs for essential tools
7 More tools       compact index of on-demand tools     (→ describeTool)
8 Protocol         {say,ops} contract + worked examples
9 Directive        JSON/API injection mode (appended in chat-panel)
```

### B. `messages` — the conversation
- Prior **user/assistant** turns only (tool/skills/status rows are UI-only, filtered out).
- Current message, augmented with the readable text of any URLs it contained.
- Each round appends `assistant(rawReply)` + `user("Tool results: …")`.

> §2 (dashboard facts) closed the old "hallucinated title" bug — the model no
> longer guesses the page; it's told. The same facts feed the suggestion
> generator, so they can't disagree.

---

## 4. The turn loop (`runAgent`)

```
for round in 0..8:
  signal.aborted? ───────────────────────────► return            (Stop button)
  reply = brain(messages, system, jsonMode, signal)
  parsed = parseAgentReply(reply)              (reply.ts — tolerant)
  ├ no JSON?  → nudge once "reply ONLY {say,ops}" else show; return
  ├ ops==[] ? → claims action but nothing mutated? → nudge "emit the op"; else show; return
  └ ops:
      show say
      for op in ops:
          mutated |= isMutating(op.kind)
          result  = dispatch(op, surface, ctx)  ── validate(op) → run(op,ctx)
          onTool(op,result)                      ── collapsible transcript row
      messages += assistant(reply) + user("Tool results: …")
say("step limit reached")
```

Reliability guards (all live):
- **JSON mode** (OpenAI-compatible) → no prose refusals.
- **Tolerant parse** → never dumps raw JSON to chat.
- **Prose nudge** → recovers a narrated reply once.
- **Mutation guard** → catches "I added a widget" with no mutating op.
- **Op validation** → a malformed op returns a typed error and is *not* applied; the model self-corrects.
- **Abort signal** → Stop halts mid-flight (cancels the in-flight model call).

---

## 5. Tools registry + ToolContext

`dispatch(op, surface, ctx)`: look up by `op.kind` → check surface → `validate(op)`
→ `run(op, ctx)`. Everything a tool needs from the app arrives via **`ToolContext`**
(rebuilt each send), keeping tools React/store-free and unit-testable:

```
ToolContext = {
  fetchPage · testEndpoint                         web / proxy
  connections · resolveConnection · tavily         saved APIs (dashboard-allowed subset)
  canvasSend                                       sandboxed iframe bridge
  listWidgets · getWidget · addWidget · updateWidget · removeWidget · widgetSize   store
  getContext · setContext                          page system-prompt note
  getSkill                                         on-demand skill lookup (loadSkill)
  apiCalls[]                                       turn scratch (strict-REST guard)
  injectMode                                       JSON/API toggle (enforced)
}
```

Tool inventory:
- **integrations** (read): `fetch` · `search` · `callApi`.
- **injection** (mutate): `injectJson` (inline) · `injectConnection` (live bind) · `addWidget` (alias).
- **core**: `listConnections`/`listWidgets` (read) · `removeWidget`/`updateWidget` (mutate, edit/move/resize) · `loadSkill`/`get`/`setContext` · `describeTool` · canvas DOM ops.

**On-demand tool catalog:** tools flagged `catalog:true` (editing, context, loadSkill)
are shown as a compact one-liner index; the agent expands one with
`describeTool { name }` before use. Essentials (fetch/search/callApi/inject/list)
keep full docs inline — lean prompt, full discoverability.

**Injection enforcement:** `injectMode` is honored in `injectJson.run` — `api`
hard-refuses (→ use `injectConnection`), `json` relaxes the post-`callApi`
strict-REST guard, `auto` keeps the default (API data → bind).

---

## 6. Per-dashboard agent config (global default fills gaps)

| Aspect | Source |
|---|---|
| Connection / model | `page.agent.connectionId/model` → `assistant.*` → first AI connection |
| Skills | NATIVE on minus `disabledSkillIds`, plus `enabledSkillIds`; `resolveSkills()` filters by surface; each skill is `always` or `onDemand` |
| Callable connections | `page.agent.callableConnectionIds` → gates `ctx.connections` |
| Context | `page.systemPrompt` (Dashboard Settings → Agent) |
| Injection mode | composer JSON/API toggle → `ctx.injectMode` |

---

## 7. End-to-end: "show the latest posts from the Boudoir API" (API mode)

```
chat-panel.sendText
  ├ system = context + THIS dashboard facts + skills(+catalog) + tools(+index) + protocol + "API mode" directive
  ├ ToolContext (allowed connections, store actions, apiCalls=[], injectMode="api")
  └ runAgent:
      r1  {ops:[listConnections]}                 → ids + endpoints
      r2  {ops:[callApi sourceId,path]}            → JSON shape (apiCalls += …)
      r3  {ops:[injectConnection …map…]}           → bound widget, first-fit placement
          (if it tried injectJson → validate/guard refuses → "use injectConnection")
      r4  {ops:[]}                                 → done
   each op → collapsible transcript row
```

---

## 8. Tests

`npm test` (vitest) covers the pure core in `agent.test.ts`:
parser shapes (fenced/bare/alt-key/single-op/no-dump/prose), `claimsAction`,
`resolveSkills` (builtins on, disable/enable, surface filter), and `dispatch`
(unknown op, cross-surface block, validation, API-mode refusal, mutation flags,
catalog split). Run `npm run typecheck` for the full type build.

---

## 9. Known gaps / next

- **Secrets not persisted** (by design) — model lists / callApi / search degrade
  after reload until keys are re-entered. Needs encrypted-at-rest storage (backend).
- **Research is soft** — the agent *can* still invent figures; only prompt-guided.
  A sourcing convention (every data widget records where numbers came from) would
  make it auditable.
- **Canvas agent** shares the loop but its surface ops differ; deferred for a
  dedicated pass.
- **Token budget** — `always` skills + essential tool docs still ship every turn;
  the on-demand catalog mechanism could extend further if needed.
```
