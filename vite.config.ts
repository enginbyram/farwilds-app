import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// "base: './'" makes the built site work from any folder (or straight from your homelab).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    // Keep the spreadsheet reader in its own file so the app code stays small.
    rollupOptions: { output: { manualChunks: { xlsx: ["xlsx"], react: ["react", "react-dom"] } } },
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
