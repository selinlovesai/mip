# MIP Agent Architecture

> Status: **design doc** (no rewrite applied yet). Goal: a clean modular picture of
> how the assistant works today, exactly what data reaches the model, where the
> observed **reliability bugs** come from, and the target structure that fixes them.

---

## 1. The five layers

```
            ┌──────────────────────────────┐
            │          LLM (Brain)         │   provider call (DeepSeek/OpenAI/Anthropic)
            └──────────────▲───────────────┘
              system+msgs  │   │  {say, ops[]}
            ┌──────────────┴───┴───────────────┐
            │            AGENT LOOP             │   agent.ts · runAgent()
            │  brain → parse → dispatch → feed  │
            └───┬───────────────────────┬───────┘
       assembles│ prompt          uses  │ registry
        ┌───────▼────────┐      ┌────────▼─────────┐
        │     SKILLS     │      │      TOOLS       │
        │ knowledge text │      │ run() + doc +    │
        │ (prompt.ts)    │      │ mutating flag    │
        └────────────────┘      └────────┬─────────┘
                                  acts on │ ToolContext
                          ┌───────────────▼────────────────┐
                          │           SURFACES              │
                          │  dashboard store · canvas iframe │
                          │  connections · web (fetch/search)│
                          └─────────────────────────────────┘
```

| Layer | Module | Responsibility |
|---|---|---|
| **Brain** | `chat-panel.tsx` `brain()` → `api.ts chat()` → `server/main.py /api/chat` | One completion. Picks provider/model, JSON mode, abort signal. |
| **Agent loop** | `agent.ts` `runAgent()` | Drives the turn: call brain, parse, run ops, feed results back, guard, stop. |
| **Reply parser** | `reply.ts` | Tolerantly turns the model's text into `{say, ops[]}`. |
| **Skills** | `skills/*` + `prompt.ts` | Knowledge injected into the system prompt. |
| **Tools** | `tools/*` | The op registry: `name`, `doc`, `mutating`, `run(op, ctx)`. |
| **Surfaces** | store / canvas bridge / connections / api | The real things tools mutate or read. |

Public surface is `agent/index.ts`. UI glue (building `ToolContext`, rendering the
transcript, the JSON/API toggle) lives in `shell/chat-panel.tsx`.

---

## 2. Module map (`src/mip/agent/`)

```
agent/
  index.ts        barrel (public API)
  types.ts        AgentOp · OpResult · AgentReply · ApiMsg · Surface · Tool · ToolContext
  agent.ts        runAgent() — the loop + Brain type + RunAgentOptions
  reply.ts        parseAgentReply / coerceReply / claimsAction
  prompt.ts       buildSystemPrompt(surface, {pageContext, assistantContext, skills})
  config.ts       PageAgentConfig + resolveSkills()
  tools/
    index.ts      ALL_TOOLS · toolsFor · catalogFor · isMutating · dispatch
    integrations.ts  fetch · search (Tavily) · callApi (saved connection)
    injection.ts     injectJson · injectConnection · addWidget(alias)
    core.ts          listConnections · listWidgets · removeWidget · get/setContext · canvas DOM ops
  skills/
    index.ts      NATIVE_SKILLS
    types.ts      Skill · SkillSurface
    research.ts · mip-widgets.ts · injection.ts · canvas.ts
```

A **Tool** is the single source of truth tying an op `kind` to its prompt
documentation, its implementation, and whether it mutates the surface — so the
catalog the model sees and the dispatcher that runs ops can't drift apart.

---

## 3. What data is fed to the model (per turn)

Two inputs go to `chat()`:

### A. `system` (string) — assembled by `buildSystemPrompt(surface, …)`
In order:
1. **Context** — `pageContext` (the page's "AI assistant context") + `assistantContext` (global, Settings → Assistant).
2. **Role line** — "you are the dashboard assistant" / "you operate a sandboxed canvas".
3. **Skills** — the resolved knowledge blocks for this dashboard+surface (`resolveSkills`).
4. **Tool catalog** — `catalogFor(surface)` (each tool's `doc`).
5. **Protocol + examples** — the strict `{say, ops}` contract.
6. *(appended in chat-panel)* the **injection directive** from the JSON/API toggle.

### B. `messages` (ApiMsg[]) — the conversation
- Prior **user/assistant** turns only (tool/skills/status transcript rows are UI-only and filtered out).
- The current user message, optionally **augmented** with the readable text of any URLs it contained.
- During the loop, each round appends `{role:assistant, content:rawReply}` and `{role:user, content: "Tool results: …"}`.

### ⚠ What is NOT fed today (root of the reliability bugs)
- **The dashboard's title, description, or list of existing widgets.** The model
  only knows the page through whatever the user typed. → see Bug #1.
- The model/provider identity, the available widget *defaults*, the user's
  current selection, etc. (mostly fine, but title/widgets matter.)

> Note the **inconsistency**: the *starter-suggestions* feature (chat-panel
> `useEffect`) DOES build a context string with the title/description/widgets for a
> separate one-off call. The main agent loop does not. That's why suggestions can
> reference the title but the agent hallucinates it.

---

## 4. The turn loop (`runAgent`)

```
for round in 0..maxRounds:
    if signal.aborted: return                      # Stop button
    result = brain(messages, system, jsonMode, signal)
    if aborted or !result.ok: handle + return
    parsed = parseAgentReply(result.content)
    if !parsed:                                     # pure prose / refusal
        nudge once ("reply with ONLY JSON {say,ops}") else show text; return
    if parsed.ops is empty:
        if claimsAction(say) and nothing mutated and not yet act-nudged:
            nudge ("you haven't changed anything; emit the op"); continue
        show say; return
    show say
    for op in parsed.ops:
        mutated ||= isMutating(op.kind, surface)
        result = dispatch(op, surface, ctx)         # registry lookup + run
        onTool({op, result})                        # collapsible transcript entry
    append assistant+results to messages            # feed back
say("step limit reached")
```

Reliability guards already in the loop:
- **JSON mode** (OpenAI-compatible) forces an object reply → no prose refusals.
- **Tolerant parsing** (`coerceReply`) → never dumps raw JSON into chat.
- **Prose nudge** → recovers a narrated reply once.
- **Mutation guard** → catches "I added a widget" with no mutating op.
- **Abort signal** → Stop halts mid-flight.

---

## 5. Tools & ToolContext

`dispatch(op, surface, ctx)` looks the tool up by `op.kind`, checks the surface,
and calls `tool.run(op, ctx)`. Everything a tool needs from the live app arrives
via **`ToolContext`** (built fresh each send in chat-panel), keeping tools free of
React/store coupling and unit-testable:

```
ToolContext = {
  fetchPage, testEndpoint,                  // web / proxy
  connections, resolveConnection, tavily,   // saved APIs (dashboard-allowed subset)
  canvasSend,                               // canvas iframe bridge
  listWidgets, addWidget, removeWidget, widgetSize,   // dashboard store
  getContext, setContext,                   // page system-prompt note
  apiCalls,                                 // turn scratch (strict-REST guard)
}
```

Tool groups:
- **integrations** (read-only): `fetch`, `search`, `callApi`.
- **injection** (mutating): `injectJson` (inline), `injectConnection` (live bind), `addWidget` (alias).
- **core**: `listConnections`/`listWidgets` (read), `removeWidget`/`get`/`setContext` (mutate), canvas DOM ops.

---

## 6. Per-dashboard agent config

Agent power is a property of each dashboard (`DashboardPage.agent: PageAgentConfig`),
with the global default filling gaps:

| Aspect | Source |
|---|---|
| Connection / model | `page.agent.connectionId/model` → `assistant.*` → first AI connection |
| Skills | native on-by-default minus `disabledSkillIds`, plus `enabledSkillIds`; `resolveSkills()` filters by surface |
| Callable connections | `page.agent.callableConnectionIds` (gates the `connections` the ToolContext exposes) |
| Context | `page.systemPrompt` |

---

## 7. Reliability failures — root cause → fix

### Bug #1 — Agent hallucinated the dashboard title ("Global EV Market" vs "Lingerie Market")
**Cause:** §3.⚠ — title/description/widgets are never put in the system prompt.
The model invented a plausible title.
**Fix:** add a `dashboard` block to `PromptContext` and render a `## This dashboard
(live facts — do not invent)` section: title, description, current widgets. Feed
it from chat-panel (`activePage.title/description/kind/widgets`). One source of
truth shared with the suggestion generator.

### Bug #2 — "API" toggle selected but it used `injectJson`
**Cause:** the toggle only **appended prose** to the prompt ("use injectConnection")
— there was no hard enforcement, so the model fell back to `injectJson` when no
matching connection existed.
**Fix:** thread `injectMode` into `ToolContext`; in `injectJson.run`, **hard-refuse**
when `injectMode === "api"` (return an error telling it to `injectConnection` or ask
the user to add a connection). When `injectMode === "json"`, relax the
post-`callApi` strict-REST guard.

### Bug #3 — Invented data ("Market Share A/B/C")
**Cause:** research discipline is prompt-only; nothing forces a search for vague
real-world asks.
**Fix (prompt, already partly done):** require search/fetch/callApi for real-world
numbers; if unavailable, label `(sample)` and say so. *(Optional hard guard: tag a
data widget built with no research-op this turn as `(sample)` — but that would
false-positive on user-supplied numbers, so keep it soft.)*

---

## 8. Target modular structure (incremental, low-risk)

Keep the current module boundaries; tighten three seams for reliability:

1. **Context provider** — a single `buildDashboardContext(page)` used by BOTH the
   agent loop and the suggestion generator, so the model always sees the real
   title/widgets (kills Bug #1 and the inconsistency).
2. **Enforced modes** — move the JSON/API toggle and the strict-REST rule out of
   prose and into `ToolContext` + `injection.ts` guards (kills Bug #2). Modes
   become data the registry honors, not hints.
3. **Op schemas** — give each Tool an optional `validate(op)` (zod-style) so a
   malformed op returns a typed error to the model instead of partially applying.
   This makes "missing nodes"-type failures self-correcting.

Nothing above changes the public API (`agent/index.ts`) or the chat UX; it's a
tightening of what data flows where. Estimated change: ~3 small PRs, each
independently shippable, each with a unit test (parser, resolveSkills, dispatch,
injection guards) — the pieces are already pure functions.
```
