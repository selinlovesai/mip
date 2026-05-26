/**
 * Dashboard state + persistence. A small React-context store holding pages and
 * their widgets, the active page, and edit mode — persisted to localStorage so
 * drag/resize/add survive reloads. Mirrors the original app's data model
 * (pages -> widgets, each widget carrying its own grid `layout`).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Layout } from "react-grid-layout/core";
import type { MipWidget, MipWidgetLayout } from "@/mip/schema";
import type { PageAgentConfig } from "@/mip/agent/config";
import { dbAvailable, dbDelete, dbList, dbPut } from "@/mip/api";
import { seedPages } from "./seed";

/** Per-page access level granted to a role (mirrors mip `pagePermissions`). */
export type PageAccessLevel = "edit" | "view" | "none";

/** A typed input variable for a dynamic (parameterized) page. */
export interface PageVariable {
    id: string;
    name: string;
    source: "query" | "path" | "body";
    required: boolean;
}

export interface DashboardPage {
    id: string;
    title: string;
    cols: number;
    rowHeight: number;
    widgets: MipWidget[];
    /** "dashboard" = widget grid · "canvas" = freeform AI surface (no widgets). */
    kind?: "dashboard" | "canvas";
    /** For canvas pages: the AI-authored HTML document rendered in a sandboxed iframe. */
    html?: string;
    /** --- per-page Dashboard Settings (topbar gear) --- */
    description?: string;
    /** "dashboard" = sidebar + topbar shell · "fullpage" = standalone */
    layoutMode?: "dashboard" | "fullpage";
    /** added to the assistant's system prompt while this page is open */
    systemPrompt?: string;
    /** per-dashboard agent config: model + skills + callable connections (global default fills gaps) */
    agent?: PageAgentConfig;
    /** role id -> access level (Access Control tab) */
    permissions?: Record<string, PageAccessLevel>;
    /** whether the AI assistant may access/see this page */
    aiAccess?: boolean;
    /** input variables for dynamic pages */
    variables?: PageVariable[];
}

interface DashboardState {
    pages: DashboardPage[];
    activePageId: string;
}

const STORAGE_KEY = "mip-tailwind-dashboard-v3";

/** Halve old 140px-row pages to the new ~70px scale, doubling widget heights so
 *  they keep their visual size. Idempotent: only pages with rowHeight > 100. */
function migrateRowHeight(state: DashboardState): DashboardState {
    return {
        ...state,
        pages: state.pages.map((p) =>
            p.rowHeight > 100
                ? { ...p, rowHeight: Math.round(p.rowHeight / 2), widgets: p.widgets.map((w) => ({ ...w, layout: { ...w.layout, h: w.layout.h * 2 } })) }
                : p,
        ),
    };
}

/** First-fit placement: find the top-left free slot for a w×h widget in a
 *  `cols`-wide grid, scanning rows top→bottom and columns left→right. Lets new
 *  widgets fill gaps instead of always stacking at the bottom. */
function findGridSlot(widgets: MipWidget[], w: number, h: number, cols: number): { x: number; y: number } {
    const ww = Math.min(Math.max(1, w), cols);
    const overlaps = (x: number, y: number) =>
        widgets.some((g) => {
            const { x: gx, y: gy, w: gw, h: gh } = g.layout;
            return x < gx + gw && x + ww > gx && y < gy + gh && y + h > gy;
        });
    for (let y = 0; ; y++) {
        for (let x = 0; x + ww <= cols; x++) {
            if (!overlaps(x, y)) return { x, y };
        }
    }
}

function load(): DashboardState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return migrateRowHeight(JSON.parse(raw) as DashboardState);
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
    /** "layout" = multi-column grid · "feed" = single-column responsive stack */
    viewMode: "layout" | "feed";
    setViewMode: (next: "layout" | "feed") => void;
    setActivePage: (id: string) => void;
    addPage: (title: string) => void;
    /** Create a freeform AI canvas page (no widgets) and activate it. */
    addCanvas: (title: string) => void;
    /** Replace a canvas page's HTML document. */
    setCanvasHtml: (id: string, html: string) => void;
    /** Create a new page seeded with the given widgets (template import) and activate it. */
    importTemplate: (title: string, widgets: MipWidget[]) => void;
    renamePage: (id: string, title: string) => void;
    /** Change a page's id. Returns false if the new id is empty or collides with another page. */
    renamePageId: (oldId: string, newId: string) => boolean;
    /** True if `candidateId` is free (optionally excluding a page id, e.g. itself). */
    isPageIdAvailable: (candidateId: string, exceptId?: string) => boolean;
    updatePageSettings: (id: string, patch: Partial<DashboardPage>) => void;
    deletePage: (id: string) => void;
    duplicatePage: (id: string) => void;
    addWidget: (widget: MipWidget, pageId?: string) => void;
    updateWidget: (widgetId: string, patch: Partial<MipWidget>, pageId?: string) => void;
    removeWidget: (widgetId: string, pageId?: string) => void;
    applyLayout: (layout: Layout) => void;
    /** Live read of a page by id (not a stale render closure). */
    getPage: (id: string) => DashboardPage | undefined;
}

const DashboardContext = createContext<StoreValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DashboardState>(load);
    const [editMode, setEditMode] = useState(false);
    const [viewMode, setViewMode] = useState<"layout" | "feed">("layout");

    // Always-current snapshot, so async callers (the agent loop) can read live
    // page state instead of a stale render closure.
    const stateRef = useRef(state);
    stateRef.current = state;
    /** Live read of any page by id (not the captured render value). */
    const getPage = useCallback((id: string) => stateRef.current.pages.find((p) => p.id === id), []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            /* quota / private mode — non-fatal */
        }
    }, [state]);

    // --- DB write-through (directive #1): localStorage is a cache; when the
    // backend DB is up it's the source of truth. Each page is a `dashboards`
    // record keyed by page id. We hydrate from the DB on mount, then sync only
    // the pages that actually changed (debounced), deleting removed ones.
    const dbEnabled = useRef(false);
    const syncedPages = useRef(new Map<string, string>()); // page id -> last-synced JSON
    // Did this device already have a local working set at startup? If so, LOCAL
    // is authoritative — we push it up to the DB and NEVER replace it with DB
    // contents (so a freshly-seeded DB can't clobber the user's dashboards).
    const hadLocal = useRef(typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) != null);

    useEffect(() => {
        let alive = true;
        void (async () => {
            if (!(await dbAvailable())) return; // DB off → stay on localStorage cache
            dbEnabled.current = true;
            const records = await dbList<DashboardPage>("dashboards");
            if (!alive) return;
            // Seed the synced map so unchanged DB pages aren't re-pushed.
            for (const r of records) syncedPages.current.set(r.id, JSON.stringify(r.data));
            // Adopt DB pages ONLY on a fresh device (no local pages). When the
            // user already has local pages they win and are uploaded by the sync
            // effect below — hydration must not delete or overwrite them.
            if (!hadLocal.current && records.length) {
                const pages = migrateRowHeight({ pages: records.map((r) => r.data), activePageId: "" }).pages;
                setState((s) => ({ pages, activePageId: pages.some((p) => p.id === s.activePageId) ? s.activePageId : pages[0]!.id }));
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    // Ids that have been present in LOCAL state during this session. We only
    // delete a DB record when an id we actually had locally is later removed —
    // never a DB-only page from another device (which would cross-delete it).
    const localKnownIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!dbEnabled.current) return;
        const t = setTimeout(() => {
            const present = new Set<string>();
            for (const page of state.pages) {
                present.add(page.id);
                const json = JSON.stringify(page);
                if (syncedPages.current.get(page.id) !== json) {
                    syncedPages.current.set(page.id, json);
                    void dbPut("dashboards", page.id, page);
                }
            }
            // Delete only ids we previously held locally and that are now gone.
            for (const id of localKnownIds.current) {
                if (!present.has(id)) {
                    syncedPages.current.delete(id);
                    void dbDelete("dashboards", id);
                }
            }
            localKnownIds.current = present;
        }, 600);
        return () => clearTimeout(t);
    }, [state.pages]);

    const activePage = useMemo(() => state.pages.find((page) => page.id === state.activePageId) ?? state.pages[0]!, [state]);

    const setActivePage = useCallback((id: string) => setState((s) => ({ ...s, activePageId: id })), []);

    const updateActivePage = useCallback(
        (mutate: (page: DashboardPage) => DashboardPage) => {
            setState((s) => ({ ...s, pages: s.pages.map((page) => (page.id === s.activePageId ? mutate(page) : page)) }));
        },
        [],
    );

    /** Mutate a SPECIFIC page (falls back to the active page). Lets async callers
     *  pin their target page so switching dashboards mid-run can't cross-write. */
    const updatePageById = useCallback(
        (pageId: string | undefined, mutate: (page: DashboardPage) => DashboardPage) => {
            setState((s) => {
                const target = pageId ?? s.activePageId;
                return { ...s, pages: s.pages.map((page) => (page.id === target ? mutate(page) : page)) };
            });
        },
        [],
    );

    const addPage = useCallback((title: string) => {
        const id = `page-${Date.now()}`;
        setState((s) => ({ pages: [...s.pages, { id, title, cols: 12, rowHeight: 70, widgets: [] }], activePageId: id }));
    }, []);

    const importTemplate = useCallback((title: string, widgets: MipWidget[]) => {
        const id = `page-${Date.now()}`;
        setState((s) => ({ pages: [...s.pages, { id, title, cols: 12, rowHeight: 70, widgets }], activePageId: id }));
    }, []);

    const addCanvas = useCallback((title: string) => {
        const id = `canvas-${Date.now()}`;
        setState((s) => ({ pages: [...s.pages, { id, title: title.trim() || "Canvas", cols: 12, rowHeight: 70, widgets: [], kind: "canvas", html: "" }], activePageId: id }));
    }, []);

    const setCanvasHtml = useCallback((id: string, html: string) => {
        setState((s) => ({ ...s, pages: s.pages.map((page) => (page.id === id ? { ...page, html } : page)) }));
    }, []);

    const renamePage = useCallback((id: string, title: string) => {
        const next = title.trim();
        if (!next) return;
        setState((s) => ({ ...s, pages: s.pages.map((page) => (page.id === id ? { ...page, title: next } : page)) }));
    }, []);

    const updatePageSettings = useCallback((id: string, patch: Partial<DashboardPage>) => {
        setState((s) => ({ ...s, pages: s.pages.map((page) => (page.id === id ? { ...page, ...patch } : page)) }));
    }, []);

    const isPageIdAvailable = useCallback(
        (candidateId: string, exceptId?: string) => {
            const next = candidateId.trim();
            if (!next) return false;
            return !state.pages.some((page) => page.id === next && page.id !== exceptId);
        },
        [state.pages],
    );

    const renamePageId = useCallback((oldId: string, newId: string) => {
        const next = newId.trim();
        let ok = false;
        setState((s) => {
            if (!next || s.pages.some((page) => page.id === next && page.id !== oldId)) return s;
            ok = true;
            return {
                pages: s.pages.map((page) => (page.id === oldId ? { ...page, id: next } : page)),
                activePageId: s.activePageId === oldId ? next : s.activePageId,
            };
        });
        return ok;
    }, []);

    const deletePage = useCallback((id: string) => {
        setState((s) => {
            if (s.pages.length <= 1) return s; // keep at least one page
            const pages = s.pages.filter((page) => page.id !== id);
            const activePageId = s.activePageId === id ? pages[0]!.id : s.activePageId;
            return { pages, activePageId };
        });
    }, []);

    const duplicatePage = useCallback((id: string) => {
        setState((s) => {
            const source = s.pages.find((page) => page.id === id);
            if (!source) return s;
            const newId = `page-${Date.now()}`;
            const clone: DashboardPage = { ...source, id: newId, title: `${source.title} (copy)`, widgets: source.widgets.map((w) => ({ ...w })) };
            const index = s.pages.findIndex((page) => page.id === id);
            const pages = [...s.pages.slice(0, index + 1), clone, ...s.pages.slice(index + 1)];
            return { pages, activePageId: newId };
        });
    }, []);

    const addWidget = useCallback(
        (widget: MipWidget, pageId?: string) => {
            updatePageById(pageId, (page) => {
                const { x, y } = findGridSlot(page.widgets, widget.layout.w, widget.layout.h, page.cols);
                const w = Math.min(widget.layout.w, page.cols);
                return { ...page, widgets: [...page.widgets, { ...widget, layout: { ...widget.layout, w, x, y } }] };
            });
        },
        [updatePageById],
    );

    const updateWidget = useCallback(
        (widgetId: string, patch: Partial<MipWidget>, pageId?: string) =>
            updatePageById(pageId, (page) => ({ ...page, widgets: page.widgets.map((w) => (w.id === widgetId ? { ...w, ...patch } : w)) })),
        [updatePageById],
    );

    const removeWidget = useCallback(
        (widgetId: string, pageId?: string) => updatePageById(pageId, (page) => ({ ...page, widgets: page.widgets.filter((w) => w.id !== widgetId) })),
        [updatePageById],
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
        () => ({ state, activePage, editMode, setEditMode, viewMode, setViewMode, setActivePage, addPage, addCanvas, setCanvasHtml, importTemplate, renamePage, renamePageId, isPageIdAvailable, updatePageSettings, deletePage, duplicatePage, addWidget, updateWidget, removeWidget, applyLayout, getPage }),
        [state, activePage, editMode, viewMode, setActivePage, addPage, addCanvas, setCanvasHtml, importTemplate, renamePage, renamePageId, isPageIdAvailable, updatePageSettings, deletePage, duplicatePage, addWidget, updateWidget, removeWidget, applyLayout, getPage],
    );

    return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): StoreValue {
    const ctx = useContext(DashboardContext);
    if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>");
    return ctx;
}
