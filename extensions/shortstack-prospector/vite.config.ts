import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest.config";
import { resolve } from "node:path";

// Vite + CRX MV3 plugin handles content scripts, background SW, popup,
// and HMR for the extension. Output goes to ./dist which is what users
// load via chrome://extensions → Load unpacked.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      // Ensures content script never bundles React or any heavy SDKs.
      // The content script is intentionally lightweight DOM-only code.
      output: {
        chunkFileNames: "assets/chunk-[hash].js",
      },
    },
  },
});
