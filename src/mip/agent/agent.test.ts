/**
 * Unit tests for the agent's pure logic — the parser, skill resolution, the tool
 * registry (validation + dispatch + on-demand split), and the injection guards.
 * These are the bits we patched reactively; locking them down stops regressions.
 */

import { describe, it, expect } from "vitest";
import { parseAgentReply, coerceReply, claimsAction } from "./reply";
import { resolveSkills } from "./config";
import { dispatch, isMutating, catalogFor, toolIndexFor } from "./tools";
import { runAgent } from "./agent";
import type { Skill } from "./skills/types";
import type { ToolContext } from "./types";

// ── reply.ts ───────────────────────────────────────────────────────────────
describe("parseAgentReply", () => {
    it("parses a fenced json block", () => {
        expect(parseAgentReply('```json\n{"say":"hi","ops":[]}\n```')).toEqual({ say: "hi", ops: [] });
    });
    it("parses a bare object", () => {
        expect(parseAgentReply('{"say":"x","ops":[{"kind":"fetch","url":"u"}]}')).toEqual({ say: "x", ops: [{ kind: "fetch", url: "u" }] });
    });
    it("accepts ops under an alternate key", () => {
        expect(parseAgentReply('{"say":"x","operations":[{"kind":"a"}]}')?.ops).toEqual([{ kind: "a" }]);
    });
    it("wraps a single op object", () => {
        expect(parseAgentReply('{"kind":"fetch","url":"u"}')?.ops).toEqual([{ kind: "fetch", url: "u" }]);
    });
    it("never dumps raw data: unknown object → terminal no-op", () => {
        expect(parseAgentReply('{"points":[1,2,3]}')).toEqual({ ops: [] });
    });
    it("returns null for non-JSON prose", () => {
        expect(parseAgentReply("I cannot do that.")).toBeNull();
    });
    it("balanced-matches a nested object amid prose (no greedy over-capture)", () => {
        const r = parseAgentReply('Sure! {"say":"hi","ops":[{"kind":"injectJson","settings":{"a":{"b":1}}}]} — done.');
        expect(r?.ops?.[0]).toMatchObject({ kind: "injectJson" });
    });
    it("ignores a stray brace in prose before the real object", () => {
        const r = parseAgentReply('I use {curly} braces. {"say":"x","ops":[]}');
        expect(r).toEqual({ say: "x", ops: [] });
    });
});

describe("coerceReply / claimsAction", () => {
    it("treats a say-only object as a no-op message", () => {
        expect(coerceReply({ say: "done" })).toEqual({ say: "done", ops: [] });
    });
    it("flags action claims", () => {
        expect(claimsAction("Added a chart")).toBe(true);
        expect(claimsAction("Here is what I found")).toBe(false);
    });
});

// ── config.ts (resolveSkills) ────────────────────────────────────────────────
const sk = (id: string, extra: Partial<Skill> = {}): Skill => ({ id, name: id, content: id, ...extra });

describe("resolveSkills", () => {
    const lib: Skill[] = [
        sk("nat-dash", { builtin: true, surfaces: ["dashboard"] }),
        sk("nat-canvas", { builtin: true, surfaces: ["canvas"] }),
        sk("custom-a"),
    ];
    it("includes builtins by default, filtered by surface", () => {
        const got = resolveSkills(lib, undefined, "dashboard").map((s) => s.id);
        expect(got).toContain("nat-dash");
        expect(got).not.toContain("nat-canvas");
        expect(got).not.toContain("custom-a"); // custom off unless enabled
    });
    it("respects disabled builtins and enabled custom", () => {
        const got = resolveSkills(lib, { disabledSkillIds: ["nat-dash"], enabledSkillIds: ["custom-a"] }, "dashboard").map((s) => s.id);
        expect(got).not.toContain("nat-dash");
        expect(got).toContain("custom-a");
    });
});

// ── tools (registry) ─────────────────────────────────────────────────────────
function ctx(over: Partial<ToolContext> = {}): ToolContext {
    return {
        fetchPage: async () => ({ ok: true }),
        testEndpoint: async () => ({ ok: true }),
        connections: [],
        resolveConnection: () => undefined,
        canvasSend: async () => ({ ok: true }),
        listWidgets: () => [],
        addWidget: () => {},
        removeWidget: () => {},
        widgetSize: () => ({ w: 6, h: 6 }),
        getContext: () => "",
        setContext: () => {},
        apiCalls: [],
        getSkill: () => undefined,
        getWidget: () => undefined,
        updateWidget: () => {},
        ...over,
    };
}

describe("dispatch + validation", () => {
    it("rejects an unknown op", async () => {
        const r = await dispatch({ kind: "nope" }, "dashboard", ctx());
        expect(r.ok).toBe(false);
    });
    it("blocks cross-surface ops (canvas op on dashboard)", async () => {
        const r = await dispatch({ kind: "replace", html: "x" }, "dashboard", ctx());
        expect(r.ok).toBe(false);
    });
    it("validates required args (injectConnection without sourceId)", async () => {
        const r = await dispatch({ kind: "injectConnection", type: "list" }, "dashboard", ctx());
        expect(r.ok).toBe(false);
        expect(String(r.error)).toMatch(/sourceId/);
    });
    it("hard-refuses injectJson under api injection mode", async () => {
        const r = await dispatch({ kind: "injectJson", type: "kpi", settings: {} }, "dashboard", ctx({ injectMode: "api" }));
        expect(r.ok).toBe(false);
        expect(String(r.error)).toMatch(/injectConnection/);
    });
    it("callApi failure guides back to real endpoints (no path guessing)", async () => {
        const conn = { id: "c1", name: "X", type: "rest", baseUrl: "https://x", endpoints: [{ method: "GET", path: "/api/v2/internal-links/pages" }, { method: "GET", path: "/api/v2/feed" }] };
        const r = await dispatch({ kind: "callApi", sourceId: "c1", path: "/submissions" }, "dashboard", ctx({
            resolveConnection: () => conn as never,
            testEndpoint: async () => ({ ok: false, status: 404, error: "status 404" }),
        }));
        expect(r.ok).toBe(false);
        expect(r.hint).toBeTruthy();
        expect(r.resourceAreas ?? r.didYouMean).toBeTruthy();
    });
    it("allows injectJson in auto mode", async () => {
        const added: unknown[] = [];
        const r = await dispatch({ kind: "injectJson", type: "kpi", settings: { value: 1 } }, "dashboard", ctx({ addWidget: (w) => added.push(w) }));
        expect(r.ok).toBe(true);
        expect(added).toHaveLength(1);
    });
    it("allows a STATIC widget via injectJson even under api mode", async () => {
        const added: unknown[] = [];
        const r = await dispatch({ kind: "injectJson", type: "markdown", settings: { content: "hi" } }, "dashboard", ctx({ injectMode: "api", addWidget: (w) => added.push(w) }));
        expect(r.ok).toBe(true);
        expect(added).toHaveLength(1);
    });
    it("updateWidget merges settings and patches layout", async () => {
        let patched: { id?: string; patch?: { title?: string; layout?: { w?: number } } } = {};
        const cur = { id: "w1", type: "kpi", title: "old", layout: { x: 0, y: 0, w: 3, h: 2 }, settings: { value: 1 } };
        const r = await dispatch({ kind: "updateWidget", id: "w1", title: "new", w: 6, settings: { delta: 2 } }, "dashboard", ctx({
            getWidget: () => cur as never,
            updateWidget: (id, patch) => (patched = { id, patch: patch as never }),
        }));
        expect(r.ok).toBe(true);
        expect(patched.id).toBe("w1");
        expect(patched.patch?.title).toBe("new");
        expect(patched.patch?.layout?.w).toBe(6);
    });
});

describe("runAgent safeguards", () => {
    it("halts after consecutive all-failed rounds instead of burning all rounds", async () => {
        let calls = 0;
        const said: string[] = [];
        await runAgent({
            initial: [{ role: "user", content: "fetch stuff" }],
            surface: "dashboard",
            system: "sys",
            jsonMode: true,
            maxFailStreak: 2,
            brain: async () => {
                calls++;
                return { ok: true, content: '{"say":"trying","ops":[{"kind":"fetch","url":"https://x"}]}' };
            },
            ctx: ctx({ fetchPage: async () => ({ ok: false, error: "boom" }) }),
            say: (t) => said.push(t),
        });
        expect(calls).toBeLessThanOrEqual(2); // bailed early, not 8 rounds
        expect(said.join(" ")).toMatch(/repeated tool errors/);
    });
});

describe("isMutating + tool catalog split", () => {
    it("knows mutating vs read ops", () => {
        expect(isMutating("injectJson", "dashboard")).toBe(true);
        expect(isMutating("listWidgets", "dashboard")).toBe(false);
        expect(isMutating("listWidgets", "canvas")).toBe(false); // wrong surface
    });
    it("keeps essential tools inline and editing tools in the on-demand index", () => {
        const always = catalogFor("dashboard");
        const index = toolIndexFor("dashboard");
        expect(always).toMatch(/injectJson/);
        expect(index).toMatch(/updateWidget/);
        expect(always).not.toMatch(/updateWidget/);
    });
});
