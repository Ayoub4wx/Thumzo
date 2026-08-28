import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, splitVendorChunkPlugin } from "vite";

const NODE_MODULES_PATTERN = /[\\/]node_modules[\\/]/;

export default defineConfig({
  plugins: [react(), tailwindcss(), splitVendorChunkPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!NODE_MODULES_PATTERN.test(id)) {
            return undefined;
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("motion")) {
            return "motion";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          if (id.includes("@whop")) {
            return "whop";
          }

          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "react-vendor";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Keep this in place so editor work does not flicker during agent edits.
    hmr: process.env.DISABLE_HMR !== "true",
  },
});
