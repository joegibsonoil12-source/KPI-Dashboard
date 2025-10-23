import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your repo name for GitHub Pages
// If your repo is "KPI-Dashboard", leave as-is.
// If you rename the repo, update the base accordingly.
export default defineConfig({
  plugins: [react()],
  base: "/KPI-Dashboard/",
  build: {
    outDir: "dist",
    sourcemap: true
  },
  server: {
    proxy: {
      // Proxy API requests to backend server during development
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
});
