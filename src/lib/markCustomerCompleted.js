// https://github.com/joegibsonoil12-source/KPI-Dashboard/blob/main/src/lib/markCustomerCompleted.js
import { createClient } from "@supabase/supabase-js";

/**
 * Frontend env (client):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * If you run server/Edge functions, use SUPABASE_SERVICE_ROLE_KEY there instead.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
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

  const { data, error } = await supabase.rpc("mark_customer_completed", { customer_key: customerKey });
  if (error) {
    console.error("mark_customer_completed RPC error:", error);
    throw error;
  }
  const updatedCount = Array.isArray(data) && data.length > 0 ? Number(data[0].updated_count || 0) : 0;
  return { updatedCount, raw: data };
}

/**
 * UI-friendly wrapper that alerts on error (optional).
 */
export async function onMarkComplete(customerKey) {
  try {
    const result = await markCustomerCompleted(customerKey);
    return result;
  } catch (err) {
    // eslint-disable-next-line no-alert
    alert("Failed to mark completed: " + (err?.message || err));
    throw err;
  }
}
