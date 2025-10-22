import { createClient } from "@supabase/supabase-js";

// Frontend usage: use anon key (NOT service_role). For admin/server operations use service_role key on server/Edge Fn.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Call the RPC that marks all service rows for a customer as completed (and sets defer = 0).
 * Usage: await markCustomerCompleted('Acme Co')
 */
export async function markCustomerCompleted(customerKey) {
  if (!customerKey) throw new Error("customerKey required");
  const { data, error } = await supabase.rpc("mark_customer_completed", customerKey);
  if (error) {
    console.error("RPC error:", error);
    throw error;
  }
  return data; // e.g. [{ updated_count: N }]
}

// Example invocation from UI code:
export async function onMarkComplete(customerKey) {
  try {
    const result = await markCustomerCompleted(customerKey);
    console.log("Updated rows:", result);
    // Refresh dashboard data after this (re-run your queries)
  } catch (err) {
    // surface to user
    alert("Failed to mark completed: " + (err?.message || err));
  }
}
