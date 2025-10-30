// src/lib/markCustomerCompleted.js
import { supabase } from "./supabaseClient";

/**
 * Client-side helper to mark a service as completed
 * 
 * In a full server setup, this would POST to /api/markCustomerCompleted
 * Since this is a static Vite SPA, we directly call the Supabase RPC
 * 
 * After successful completion, triggers a billboard refresh by dispatching
 * a custom event that Billboard components can listen to.
 * 
 * @param {string} serviceId - The UUID of the service to mark as completed
 * @returns {Promise<{updatedService: object, deferredCount: number}>}
 */
export async function markCustomerCompleted(serviceId) {
  // Validate input
  if (!serviceId || typeof serviceId !== "string") {
    throw new Error("Invalid serviceId: must be a non-empty string");
  }

  try {
    // Call Supabase RPC to mark service as completed
    // The RPC should update the service status and return the updated service
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "mark_customer_completed",
      { service_id: serviceId }
    );

    if (rpcError) {
      throw new Error(`RPC error: ${rpcError.message}`);
    }

    // Fetch the updated service
    const { data: updatedService, error: fetchError } = await supabase
      .from("service_jobs")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch updated service: ${fetchError.message}`);
    }

    // Count deferred services
    const { count: deferredCount, error: countError } = await supabase
      .from("service_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "deferred");

    if (countError) {
      console.error("Failed to get deferred count:", countError);
      // Don't fail the whole operation if count fails
    }

    // Trigger immediate billboard refresh
    // Dispatch a custom event that Billboard components can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billboard-refresh', {
        detail: { source: 'markCustomerCompleted', serviceId }
      }));
      console.log('[markCustomerCompleted] Triggered billboard refresh event');
    }

    return {
      updatedService,
      deferredCount: deferredCount || 0,
    };
  } catch (err) {
    console.error("markCustomerCompleted error:", err);
    throw new Error(
      err.message || "Failed to mark customer as completed"
    );
  }
}
