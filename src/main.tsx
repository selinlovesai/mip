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
import "react-grid-layout/css/styles.css";
import "@/styles/globals.css";

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
