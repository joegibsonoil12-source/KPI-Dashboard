// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://iskajkwulaaakhoalzdu.supabase.co";   // ✅ matches your project

const anon =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza2Fqa3d1bGFhYWtoYW9semR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTExMjEsImV4cCI6MjA3MzAyNzEyMX0.8pq0sVGGofg2vGmrOdbvqbVX-mFcdQInZ3T5pc70Qb4";   // ✅ anon key from Supabase API settings

// Check if we're in development mode without proper Supabase setup
export const isDevelopmentMode = import.meta.env.DEV && (
  !import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL === "your-supabase-url" ||
  import.meta.env.VITE_SUPABASE_BYPASS_AUTH === "true"
);

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
