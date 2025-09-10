// src/lib/supabaseClient.js
// ------------------------------------------------------------
// TEMP FIX: use CDN import so the build does not need the npm
// package right now. When Actions is installing packages
// correctly, switch this line back to:
//   import { createClient } from '@supabase/supabase-js'
//
// CDN import (works in Vite builds and on GitHub Pages):
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Read env vars (make sure they’re defined in Vite and on Pages)
const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// Helpful error if env is missing
if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'The app will load but any Supabase calls will fail until these are set.'
  )
}

/**
 * Singleton Supabase client.
 * Note: persistSession + autoRefreshToken are enabled so users
 * stay signed in across page reloads.
 */
export const supabase = createClient(url ?? '', anon ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/* -------------------- Convenience helpers -------------------- */

/** Get current session (or null) */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

/** Sign in with magic link (email) */
export async function signInWithEmail(email) {
  return supabase.auth.signInWithOtp({ email })
}

/** Sign out current user */
export async function signOut() {
  return supabase.auth.signOut()
}

/**
 * Example: ensure user is signed in (returns user or null)
 * You can use this in components before doing calls that
 * require an authenticated session.
 */
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}
