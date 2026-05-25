/**
 * Settings state — connected apps and data-source connections, persisted to
 * localStorage. App "connections" store only which apps are connected + the
 * method used (credentials are NOT persisted in this client-only demo; wiring
 * real secret storage is a backend follow-up).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthMethod } from "./apps-catalog";
import { NATIVE_SKILLS, type Skill } from "@/mip/agent/skills";
import { DEFAULT_WIDGET_SIZES, WIDGET_TYPES, type WidgetType } from "@/mip/schema";
import { WIDGET_CATALOG } from "@/mip/shell/widget-catalog";

export type { Skill } from "@/mip/agent/skills";

/** Per-type widget default: a display name + a free-form JSON config that holds
 *  the default grid size (w, h) and any seed settings/fields. */
export interface WidgetTypeConfig {
    name: string;
    config: Record<string, unknown>;
}

const CATALOG_BY_TYPE = new Map(WIDGET_CATALOG.map((c) => [c.type, c]));
const prettyType = (t: string) => t.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** Seed per-type config from the catalog (label + example settings) + default size. */
export const DEFAULT_WIDGET_CONFIGS: Record<WidgetType, WidgetTypeConfig> = Object.fromEntries(
    WIDGET_TYPES.map((t) => {
        const cat = CATALOG_BY_TYPE.get(t);
        const size = DEFAULT_WIDGET_SIZES[t];
        const config: Record<string, unknown> = { w: size.w, h: size.h };
        if (cat?.settings) config.settings = cat.settings;
        if (cat?.fields) config.fields = cat.fields;
        return [t, { name: cat?.label ?? prettyType(t), config }];
    }),
) as Record<WidgetType, WidgetTypeConfig>;

export type DataSourceType = "mock" | "rest" | "json" | "csv";

export type AuthType = "none" | "bearer" | "basic" | "apiKeyHeader" | "apiKeyQuery" | "digest" | "custom";

export interface ConnectionAuth {
    type: AuthType;
    token?: string; // bearer
    username?: string; // basic/digest
    password?: string; // basic/digest
    keyName?: string; // apiKey header/query name (or custom header name)
    keyValue?: string; // apiKey value (or custom header value)
}

export interface ConnectionHeader {
    key: string;
    value: string;
}

export interface ConnectionEndpoint {
    id: string;
    label: string;
    method: string; // GET/POST/PUT/PATCH/DELETE
    path: string;
    mapPath?: string; // default JSON path, e.g. $.data
    description?: string;
    body?: string;
}

export interface Connection {
    id: string;
    name: string;
    type: DataSourceType;
    baseUrl?: string;
    auth?: ConnectionAuth;
    headers?: ConnectionHeader[];
    endpoints?: ConnectionEndpoint[];
    /** When true, this connection is selectable as the assistant's AI model. */
    isAiModel?: boolean;
    aiProvider?: string; // "openai" | "anthropic" | provider id
    aiModel?: string; // model name
    /** REST base URL / JSON or CSV inline payload, depending on type (legacy). */
    detail?: string;
}

export interface AppConnection {
    appId: string;
    method: AuthMethod;
    connectedAt: string;
}

export interface AssistantConfig {
    connectionId?: string;
    model?: string;
    systemPrompt?: string;
    /** Connection ids the assistant is allowed to call as tools (live requests). */
    callableConnectionIds?: string[];
}

export interface UserProfile {
    name: string;
    email: string;
}

interface SettingsState {
    connections: Connection[];
    apps: AppConnection[];
    assistant: AssistantConfig;
    profile: UserProfile;
    /** Skills library — built-in (native) + user-authored. */
    skills: Skill[];
    /** Whether the editable sample skills have been seeded (once). */
    skillsSeeded?: boolean;
    /** Default grid size per widget type (customizable in Settings → Widgets). */
    widgetDefaults: Record<WidgetType, WidgetTypeConfig>;
    /** User acknowledged the risks of the freeform AI canvas (arbitrary code). */
    canvasConsented?: boolean;
}

/** Editable example skills, seeded once so users have something to inspect and
 *  tweak. NOT built-in — they can be edited or deleted freely. */
const SAMPLE_SKILLS: Skill[] = [
    {
        id: "sample-concise",
        name: "Concise answers",
        description: "Lead with the answer; short, scannable, no filler.",
        builtin: false,
        surfaces: ["dashboard", "canvas"],
        content: [
            "## Style: concise",
            "Lead with the direct answer in the first sentence. Prefer short paragraphs and bullet points over prose.",
            "Cut filler ('it's worth noting', 'as you can see'). No restating the question. Surface numbers and names early.",
        ].join("\n"),
    },
    {
        id: "sample-finance",
        name: "Finance & metrics context",
        description: "House definitions for revenue metrics and formatting.",
        builtin: false,
        surfaces: ["dashboard"],
        content: [
            "## Domain: finance & metrics",
            "Currency is EUR (€) unless stated; format large numbers with thousands separators and at most 1 decimal (e.g. €1.2M).",
            "Metric definitions: MRR = monthly recurring revenue; ARR = MRR × 12; Churn = customers lost ÷ customers at period start.",
            "When building revenue widgets, label periods clearly (month/quarter) and prefer line/area charts for trends, KPIs for headline totals.",
        ].join("\n"),
    },
    {
        id: "sample-brand-voice",
        name: "Brand voice",
        description: "Tone: friendly, confident, plain-spoken.",
        builtin: false,
        surfaces: ["dashboard", "canvas"],
        content: [
            "## Voice: brand tone",
            "Be friendly, confident, and plain-spoken. Address the reader as 'you'. Avoid jargon and hype words ('revolutionary', 'synergy').",
            "Use sentence case for headings. Keep CTAs action-oriented ('Start now', 'See your data').",
        ].join("\n"),
    },
];

/** Merge stored skills with the latest native skills (native content stays
 *  fresh across app updates; custom skills are preserved). Seeds the sample
 *  skills once (tracked by `seeded`) so deletions of them stick afterward. */
function mergeSkills(stored: Skill[] | undefined, seeded: boolean | undefined): Skill[] {
    const custom = (stored ?? []).filter((s) => !s.builtin);
    const result = [...NATIVE_SKILLS, ...custom];
    if (!seeded) {
        const have = new Set(result.map((s) => s.id));
        result.push(...SAMPLE_SKILLS.filter((s) => !have.has(s.id)));
    }
    return result;
}

const STORAGE_KEY = "mip-settings-v1";

const DEFAULT_STATE: SettingsState = {
    connections: [
        { id: "mock", name: "Sample data", type: "mock" },
        // Keyless public APIs — power the Crypto template's live widgets.
        { id: "binance", name: "Binance", type: "rest", baseUrl: "https://api.binance.com" },
        { id: "coingecko", name: "CoinGecko", type: "rest", baseUrl: "https://api.coingecko.com" },
    ],
    apps: [],
    assistant: {},
    profile: { name: "Super Admin", email: "superadmin@protocol.dev" },
    skills: [...NATIVE_SKILLS, ...SAMPLE_SKILLS],
    skillsSeeded: true,
    widgetDefaults: DEFAULT_WIDGET_CONFIGS,
};

function load(): SettingsState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as SettingsState;
            return {
                ...DEFAULT_STATE,
                ...parsed,
                skills: mergeSkills(parsed.skills, parsed.skillsSeeded),
                skillsSeeded: true,
                widgetDefaults: { ...DEFAULT_WIDGET_CONFIGS, ...(parsed.widgetDefaults ?? {}) },
            };
        }
    } catch {
        /* ignore */
    }
    return DEFAULT_STATE;
}

interface SettingsValue {
    connections: Connection[];
    apps: AppConnection[];
    isAppConnected: (appId: string) => boolean;
    connectApp: (appId: string, method: AuthMethod) => void;
    disconnectApp: (appId: string) => void;
    addConnection: (conn: Omit<Connection, "id">) => string;
    /** Add a connection with a fixed id if one with that id doesn't already exist. */
    ensureConnection: (conn: Connection) => void;
    updateConnection: (id: string, patch: Partial<Connection>) => void;
    removeConnection: (id: string) => void;
    getConnection: (id: string) => Connection | undefined;
    /** Connections flagged as AI models — selectable by the assistant. */
    aiConnections: Connection[];
    assistant: AssistantConfig;
    setAssistant: (patch: Partial<AssistantConfig>) => void;
    /** Skills library (native + custom). */
    skills: Skill[];
    addSkill: (skill: Omit<Skill, "id" | "builtin">) => string;
    updateSkill: (id: string, patch: Partial<Skill>) => void;
    removeSkill: (id: string) => void;
    /** Default grid size per widget type. */
    widgetDefaults: Record<WidgetType, WidgetTypeConfig>;
    setWidgetDefault: (type: WidgetType, cfg: WidgetTypeConfig) => void;
    resetWidgetDefaults: () => void;
    profile: UserProfile;
    setProfile: (patch: Partial<UserProfile>) => void;
    canvasConsented: boolean;
    setCanvasConsented: (v: boolean) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SettingsState>(load);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            /* ignore */
        }
    }, [state]);

    const isAppConnected = useCallback((appId: string) => state.apps.some((a) => a.appId === appId), [state.apps]);

    const connectApp = useCallback((appId: string, method: AuthMethod) => {
        setState((s) => ({ ...s, apps: [...s.apps.filter((a) => a.appId !== appId), { appId, method, connectedAt: new Date().toISOString() }] }));
    }, []);

    const disconnectApp = useCallback((appId: string) => {
        setState((s) => ({ ...s, apps: s.apps.filter((a) => a.appId !== appId) }));
    }, []);

    const addConnection = useCallback((conn: Omit<Connection, "id">) => {
        const id = `conn-${Date.now()}`;
        setState((s) => ({ ...s, connections: [...s.connections, { ...conn, id }] }));
        return id;
    }, []);

    const ensureConnection = useCallback((conn: Connection) => {
        setState((s) => (s.connections.some((c) => c.id === conn.id) ? s : { ...s, connections: [...s.connections, conn] }));
    }, []);

    const updateConnection = useCallback((id: string, patch: Partial<Connection>) => {
        setState((s) => ({ ...s, connections: s.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
    }, []);

    const removeConnection = useCallback((id: string) => {
        setState((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== id) }));
    }, []);

    const getConnection = useCallback((id: string) => state.connections.find((c) => c.id === id), [state.connections]);

    const aiConnections = useMemo(() => state.connections.filter((c) => c.isAiModel), [state.connections]);

    const setAssistant = useCallback((patch: Partial<AssistantConfig>) => {
        setState((s) => ({ ...s, assistant: { ...s.assistant, ...patch } }));
    }, []);

    const addSkill = useCallback((skill: Omit<Skill, "id" | "builtin">) => {
        const id = `skill-${Date.now()}`;
        setState((s) => ({ ...s, skills: [...s.skills, { ...skill, id }] }));
        return id;
    }, []);

    const updateSkill = useCallback((id: string, patch: Partial<Skill>) => {
        setState((s) => ({ ...s, skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch, id: sk.id } : sk)) }));
    }, []);

    const removeSkill = useCallback((id: string) => {
        // Native skills can't be deleted (only toggled off per dashboard).
        setState((s) => ({ ...s, skills: s.skills.filter((sk) => sk.id !== id || sk.builtin) }));
    }, []);

    const setWidgetDefault = useCallback((type: WidgetType, cfg: WidgetTypeConfig) => {
        setState((s) => ({ ...s, widgetDefaults: { ...s.widgetDefaults, [type]: cfg } }));
    }, []);

    const resetWidgetDefaults = useCallback(() => {
        setState((s) => ({ ...s, widgetDefaults: DEFAULT_WIDGET_CONFIGS }));
    }, []);

    const setProfile = useCallback((patch: Partial<UserProfile>) => {
        setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
    }, []);

    const setCanvasConsented = useCallback((v: boolean) => setState((s) => ({ ...s, canvasConsented: v })), []);

    const value = useMemo<SettingsValue>(
        () => ({ connections: state.connections, apps: state.apps, isAppConnected, connectApp, disconnectApp, addConnection, ensureConnection, updateConnection, removeConnection, getConnection, aiConnections, assistant: state.assistant, setAssistant, skills: state.skills, addSkill, updateSkill, removeSkill, widgetDefaults: state.widgetDefaults, setWidgetDefault, resetWidgetDefaults, profile: state.profile, setProfile, canvasConsented: !!state.canvasConsented, setCanvasConsented }),
        [state, isAppConnected, connectApp, disconnectApp, addConnection, ensureConnection, updateConnection, removeConnection, getConnection, aiConnections, setAssistant, addSkill, updateSkill, removeSkill, setWidgetDefault, resetWidgetDefaults, setProfile, setCanvasConsented],
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
    return ctx;
}
