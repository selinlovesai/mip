/**
 * Settings state — connected apps and data-source connections, persisted to
 * localStorage. App "connections" store only which apps are connected + the
 * method used (credentials are NOT persisted in this client-only demo; wiring
 * real secret storage is a backend follow-up).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthMethod } from "./apps-catalog";

export type DataSourceType = "mock" | "rest" | "json" | "csv";

export interface Connection {
    id: string;
    name: string;
    type: DataSourceType;
    /** REST base URL / JSON or CSV inline payload, depending on type. */
    detail?: string;
}

export interface AppConnection {
    appId: string;
    method: AuthMethod;
    connectedAt: string;
}

interface SettingsState {
    connections: Connection[];
    apps: AppConnection[];
}

const STORAGE_KEY = "mip-settings-v1";

const DEFAULT_STATE: SettingsState = {
    connections: [{ id: "mock", name: "Sample data", type: "mock" }],
    apps: [],
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
    addConnection: (conn: Omit<Connection, "id">) => void;
    removeConnection: (id: string) => void;
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
        setState((s) => ({ ...s, connections: [...s.connections, { ...conn, id: `conn-${Date.now()}` }] }));
    }, []);

    const removeConnection = useCallback((id: string) => {
        setState((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== id) }));
    }, []);

    const value = useMemo<SettingsValue>(
        () => ({ connections: state.connections, apps: state.apps, isAppConnected, connectApp, disconnectApp, addConnection, removeConnection }),
        [state, isAppConnected, connectApp, disconnectApp, addConnection, removeConnection],
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
    return ctx;
}
