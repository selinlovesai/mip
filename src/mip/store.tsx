/**
 * Dashboard state + persistence. A small React-context store holding pages and
 * their widgets, the active page, and edit mode — persisted to localStorage so
 * drag/resize/add survive reloads. Mirrors the original app's data model
 * (pages -> widgets, each widget carrying its own grid `layout`).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Layout } from "react-grid-layout/core";
import type { MipWidget, MipWidgetLayout } from "@/mip/schema";
import { seedPages } from "./seed";

export interface DashboardPage {
    id: string;
    title: string;
    cols: number;
    rowHeight: number;
    widgets: MipWidget[];
}

interface DashboardState {
    pages: DashboardPage[];
    activePageId: string;
}

const STORAGE_KEY = "mip-tailwind-dashboard-v3";

function load(): DashboardState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as DashboardState;
    } catch {
        /* ignore corrupt state */
    }
    const pages = seedPages();
    return { pages, activePageId: pages[0]!.id };
}

interface StoreValue {
    state: DashboardState;
    activePage: DashboardPage;
    editMode: boolean;
    setEditMode: (next: boolean) => void;
    setActivePage: (id: string) => void;
    addPage: (title: string) => void;
    addWidget: (widget: MipWidget) => void;
    updateWidget: (widgetId: string, patch: Partial<MipWidget>) => void;
    removeWidget: (widgetId: string) => void;
    applyLayout: (layout: Layout) => void;
}

const DashboardContext = createContext<StoreValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DashboardState>(load);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            /* quota / private mode — non-fatal */
        }
    }, [state]);

    const activePage = useMemo(() => state.pages.find((page) => page.id === state.activePageId) ?? state.pages[0]!, [state]);

    const setActivePage = useCallback((id: string) => setState((s) => ({ ...s, activePageId: id })), []);

    const updateActivePage = useCallback(
        (mutate: (page: DashboardPage) => DashboardPage) => {
            setState((s) => ({ ...s, pages: s.pages.map((page) => (page.id === s.activePageId ? mutate(page) : page)) }));
        },
        [],
    );

    const addPage = useCallback((title: string) => {
        const id = `page-${Date.now()}`;
        setState((s) => ({ pages: [...s.pages, { id, title, cols: 12, rowHeight: 140, widgets: [] }], activePageId: id }));
    }, []);

    const addWidget = useCallback(
        (widget: MipWidget) => {
            updateActivePage((page) => {
                const maxY = page.widgets.reduce((max, w) => Math.max(max, w.layout.y + w.layout.h), 0);
                return { ...page, widgets: [...page.widgets, { ...widget, layout: { ...widget.layout, x: 0, y: maxY } }] };
            });
        },
        [updateActivePage],
    );

    const updateWidget = useCallback(
        (widgetId: string, patch: Partial<MipWidget>) =>
            updateActivePage((page) => ({ ...page, widgets: page.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)) })),
        [updateActivePage],
    );

    const removeWidget = useCallback(
        (widgetId: string) => updateActivePage((page) => ({ ...page, widgets: page.widgets.filter((w) => w.id !== widgetId) })),
        [updateActivePage],
    );

    const applyLayout = useCallback(
        (layout: Layout) => {
            const byId = new Map(layout.map((item) => [item.i, item]));
            updateActivePage((page) => ({
                ...page,
                widgets: page.widgets.map((widget) => {
                    const item = byId.get(widget.id);
                    if (!item) return widget;
                    const nextLayout: MipWidgetLayout = { ...widget.layout, x: item.x, y: item.y, w: item.w, h: item.h };
                    return { ...widget, layout: nextLayout };
                }),
            }));
        },
        [updateActivePage],
    );

    const value = useMemo<StoreValue>(
        () => ({ state, activePage, editMode, setEditMode, setActivePage, addPage, addWidget, updateWidget, removeWidget, applyLayout }),
        [state, activePage, editMode, setActivePage, addPage, addWidget, updateWidget, removeWidget, applyLayout],
    );

    return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): StoreValue {
    const ctx = useContext(DashboardContext);
    if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>");
    return ctx;
}
