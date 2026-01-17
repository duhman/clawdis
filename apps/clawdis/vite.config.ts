import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Externalize native Node modules that can't be bundled for browser
  build: {
    rollupOptions: {
      external: [
        "@lancedb/lancedb",
        "@lancedb/lancedb-darwin-arm64",
        "@lancedb/lancedb-darwin-x64",
        "@lancedb/lancedb-linux-arm64-gnu",
        "@lancedb/lancedb-linux-x64-gnu",
        "@lancedb/lancedb-win32-x64-msvc",
      ],
    },
  },

  // Optimize deps - exclude native modules
  optimizeDeps: {
    exclude: ["@lancedb/lancedb"],
  },
}));
