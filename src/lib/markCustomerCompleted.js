// Helper to call the Supabase RPC that marks a customer's service rows completed
// Place this file in your frontend codebase (e.g., src/lib/markCustomerCompleted.js) and import where needed.
//
// Environment variables (frontend):
// - NEXT_PUBLIC_SUPABASE_URL
// - NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// If you call this from server-side code or an Edge Function, use the service_role key
// stored in a secure env var instead of the anon key.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Log a warning so missing env vars are obvious during development.
  // In production you may choose to throw instead.
  // eslint-disable-next-line no-console
  console.warn("Supabase URL or Key missing. markCustomerCompleted won't work until env vars are set.");
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "");

/**
 * Call the RPC that marks all service rows for a customer as completed (and sets defer = 0).
 * The SQL function signature used in the repo is:
 *   mark_customer_completed(customer_key text)
 *
 * Note: supabase.rpc expects parameters passed as an object keyed by argument name.
 *
 * Returns: { updatedCount, raw } where updatedCount is number of rows updated.
 */
export async function markCustomerCompleted(customerKey) {
  if (!customerKey) throw new Error("customerKey required");

  try {
    // RPC parameters must be passed as an object whose keys match the function args
    const { data, error } = await supabase.rpc("mark_customer_completed", { customer_key: customerKey });

    if (error) {
      // forward supabase error to caller
      // eslint-disable-next-line no-console
      console.error("mark_customer_completed RPC error:", error);
      throw error;
    }

    // The SQL function returns TABLE(updated_count int) so data is usually an array like [{ updated_count: N }]
    const updatedCount = Array.isArray(data) && data.length > 0 ? Number(data[0].updated_count || 0) : 0;
    return { updatedCount, raw: data };
  } catch (err) {
    // bubble up or wrap with friendly message
    // eslint-disable-next-line no-console
    console.error("markCustomerCompleted exception:", err);
    throw err;
  }
}

/**
 * Convenience wrapper called from UI handlers if you want a ready-to-use function.
 * It alerts on failure and returns the number of updated rows on success.
 */
export async function onMarkComplete(customerKey) {
  try {
    const result = await markCustomerCompleted(customerKey);
    // Caller should re-fetch metrics (e.g. await loadMetrics()) to refresh UI after this returns.
    return result;
  } catch (err) {
    // surface to user; caller can choose how to display errors
    // eslint-disable-next-line no-alert
    alert("Failed to mark completed: " + (err?.message || err));
    throw err;
  }
}
