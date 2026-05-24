/**
 * Settings state — connected apps and data-source connections, persisted to
 * localStorage. App "connections" store only which apps are connected + the
 * method used (credentials are NOT persisted in this client-only demo; wiring
 * real secret storage is a backend follow-up).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthMethod } from "./apps-catalog";

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
};

function load(): SettingsState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as SettingsState) };
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
    profile: UserProfile;
    setProfile: (patch: Partial<UserProfile>) => void;
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

    const setProfile = useCallback((patch: Partial<UserProfile>) => {
        setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
    }, []);

    const value = useMemo<SettingsValue>(
        () => ({ connections: state.connections, apps: state.apps, isAppConnected, connectApp, disconnectApp, addConnection, ensureConnection, updateConnection, removeConnection, getConnection, aiConnections, assistant: state.assistant, setAssistant, profile: state.profile, setProfile }),
        [state, isAppConnected, connectApp, disconnectApp, addConnection, ensureConnection, updateConnection, removeConnection, getConnection, aiConnections, setAssistant, setProfile],
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
    return ctx;
}
