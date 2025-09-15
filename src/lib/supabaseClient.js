// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Prefer environment variables (local dev), fallback to hardcoded values (GitHub Pages)
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://iskajkwulaaakhoalzdu.supabase.co";

const anon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza2Fqa3d1bGFhYWtoYW9semR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTExMjEsImV4cCI6MjA3MzAyNzEyMX0.8pq0sVGGofg2vGmrOdbvqbVX-mFcdQInZ3T5pc70Qb4";

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
