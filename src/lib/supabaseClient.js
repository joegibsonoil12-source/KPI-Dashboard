// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// Support both Vite (import.meta.env) and Next/CRA (process.env) environments.
// Priority order:
// 1. Runtime window.__ENV (for GitHub Pages / static hosting with runtime config injection)
// 2. Vite import.meta.env
// 3. process.env (Next.js / CRA)
// 4. localStorage fallback

const url =
  // Priority 1: Runtime window.__ENV
  (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_URL) ||
  // Priority 2: Vite (import.meta.env)
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  // Priority 3: Next.js / Create React App / other envs
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL)) ||
  // Priority 4: Server env fallback (useful in some server-side contexts)
  (typeof process !== 'undefined' && process.env.SUPABASE_URL) ||
  "";

// Client anon/public key (safe for browser only if RLS/policies are configured)
const anon =
  // Priority 1: Runtime window.__ENV
  (typeof window !== 'undefined' && window.__ENV?.VITE_SUPABASE_ANON_KEY) ||
  // Priority 2: Vite import.meta.env
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  // Priority 3: Next.js / CRA / other envs
  (typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)) ||
  // Priority 4: Server env fallback
  (typeof process !== 'undefined' && process.env.SUPABASE_ANON_KEY) ||
  "";

// localStorage fallback for static hosting (GitHub Pages, Netlify, etc.)
// This allows users to configure credentials via the SupabaseSettings UI component
// when env vars are not available at build/runtime
const urlLS = typeof window !== 'undefined' ? (localStorage.getItem('SUPABASE_URL') || '') : '';
const anonLS = typeof window !== 'undefined' ? (localStorage.getItem('SUPABASE_ANON_KEY') || '') : '';

// Final values: runtime/env vars take precedence, fall back to localStorage
const urlFinal = url || urlLS;
const anonFinal = anon || anonLS;

if (!urlFinal || !anonFinal) {
  // Keep message terse so it isn't noisy in production, but helpful in dev
  // (If you run in CI you'll normally set these at build time.)
  // DO NOT commit service role keys to source. Use environment variables or secrets.
  /* eslint-disable no-console */
  console.warn(
    '[supabaseClient] Missing Supabase URL or anon key. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or NEXT_PUBLIC_/REACT_APP_ equivalents) via environment variables, or configure via Supabase Settings panel.'
  );
  /* eslint-enable no-console */
}

export const supabase = createClient(urlFinal, anonFinal, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// Export factory function for creating client instances (keeps existing API)
export function createSupabaseClient(supabaseUrl = urlFinal, supabaseKey = anonFinal) {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

// Default export for convenience (preserves previous default)
export default supabase;
