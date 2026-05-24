import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    // Pinned to 5183 so it coexists with the original MIP app on 5173.
    server: { port: 5183, strictPort: true },
    preview: { port: 5183, strictPort: true },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
