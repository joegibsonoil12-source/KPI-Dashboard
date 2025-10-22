// Helper to call the Supabase RPC that marks a customer's service rows completed
// (Place this file in your frontend codebase and import where needed)

import { createClient } from "@supabase/supabase-js";

/**
 * Environment variables (frontend):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * If you call this from server-side code or an Edge Function, use the service_role key
 * stored in a secure env var instead of the anon key.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Do not crash - but log so you can diagnose missing env vars
  // In production you might throw here to fail fast
  // eslint-disable-next-line no-console
  console.warn("Supabase URL or Key missing. markCustomerCompleted won't work until env vars are set.");
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "");

/**
 * Call the RPC that marks all service rows for a customer as completed (and sets defer = 0).
 * Important: the RPC parameter name in the DB is "customer_key" so we must pass an object
 * with that key to supabase.rpc.
 *
 * Returns the updated_count (number of rows updated) on success.
 *
 * Usage:
 *   const updated = await markCustomerCompleted('Acme Co');
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
    // Refresh UI / re-fetch your dashboard data after this in the caller
    return result;
  } catch (err) {
    // surface to user; caller can choose how to display errors
    // eslint-disable-next-line no-alert
    alert("Failed to mark completed: " + (err?.message || err));
    throw err;
  }
}
