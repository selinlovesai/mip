import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AppShell } from "@/mip/shell/app-shell";
import { DashboardScreen } from "@/pages/dashboard-screen";
import { GalleryScreen } from "@/pages/gallery-screen";
import { HomeScreen } from "@/pages/home-screen";
import { NotFound } from "@/pages/not-found";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { applyDbTokens } from "@/mip/shell/db-tokens";
import "react-grid-layout/css/styles.css";
import "@/styles/globals.css";

// Overlay DB-backed design tokens on top of the bundled theme.css (no-op when
// the backend DB is off). Fire-and-forget so it never blocks first paint.
void applyDbTokens();

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <RouteProvider>
                    <Routes>
                        <Route path="/" element={<AppShell />} />
                        <Route path="/start" element={<HomeScreen />} />
                        <Route path="/dashboard" element={<DashboardScreen />} />
                        <Route path="/gallery" element={<GalleryScreen />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
