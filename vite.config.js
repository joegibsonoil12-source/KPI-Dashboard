import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use the VERCEL environment variable (Vercel sets VERCEL=1 during builds) to
// choose the correct base:
// - On Vercel we want base: '/' so assets load from the domain root.
// - For GitHub Pages keep the repo-based path '/KPI-Dashboard/'.
const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  plugins: [react()],
  base: isVercel ? '/' : '/KPI-Dashboard/',
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
