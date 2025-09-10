import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Set these in your local .env and in GitHub Actions > Secrets."
  );
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});
