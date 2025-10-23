import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use VERCEL env var to select base at build time.
// On Vercel builds process.env.VERCEL is '1', so we set base to '/' there.
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
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
});
Set Vite base to '/' for Vercel deploys
