// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Support both Vite (import.meta.env) and Next.js (process.env) environments
const url =
  (typeof window !== 'undefined' ? 
    (import.meta?.env?.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) :
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ) || "https://iskajkwulaaakhoalzdu.supabase.co";   // ✅ matches your project

const anon =
  (typeof window !== 'undefined' ? 
    (import.meta?.env?.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) :
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impza2Fqa3d1bGFhYWtoYW9semR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NTExMjEsImV4cCI6MjA3MzAyNzEyMX0.8pq0sVGGofg2vGmrOdbvqbVX-mFcdQInZ3T5pc70Qb4";   // ✅ anon key from Supabase API settings

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Export factory function for creating client instances
export function createSupabaseClient(supabaseUrl = url, supabaseKey = anon) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
