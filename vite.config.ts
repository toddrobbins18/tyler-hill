import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  /**
   * date-fns + locale subpaths can produce split pre-bundle chunks; if those chunk files
   * go missing (stale .vite cache, interrupted dev server), the app 404s and shows a blank page.
   * Serving date-fns without pre-bundling avoids broken chunk URLs in dev.
   */
  optimizeDeps: {
    exclude: ["date-fns"],
  },
}));
