import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must be your repo name with leading/trailing slashes
// e.g. https://<user>.github.io/KPI-Dashboard => "/KPI-Dashboard/"
export default defineConfig({
  plugins: [react()],
  base: "/KPI-Dashboard/",
});
