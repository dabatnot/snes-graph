import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 } },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: { target: ["es2022", "chrome105", "safari15"] },
});
