import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: match your GitHub repo name here
export default defineConfig({
  base: "/KPI-Dashboard/",
  plugins: [react()],
});
