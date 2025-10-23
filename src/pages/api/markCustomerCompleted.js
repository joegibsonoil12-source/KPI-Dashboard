// src/pages/api/markCustomerCompleted.js
// Server-side endpoint for marking a service as completed
// NOTE: This requires serverless function deployment (Vercel/Netlify)
// For static hosting, the client calls Supabase RPC directly

import { createClient } from "@supabase/supabase-js";

/**
 * Create server-side Supabase client with service role key
 * This bypasses RLS and should only be used server-side
 */
function createServerClient() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY; // Fallback to anon key if service role not available

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /api/markCustomerCompleted
 * 
 * Request body: { serviceId: string }
 * Response: { updatedService: object, deferredCount: number }
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { serviceId } = req.body;

  // Validate input
  if (!serviceId || typeof serviceId !== "string") {
    return res.status(400).json({ error: "Invalid serviceId" });
  }

  try {
    // Create server Supabase client
    const supabase = createServerClient();

    // Call the Supabase RPC to mark service as completed
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "mark_customer_completed",
      { service_id: serviceId }
    );

    if (rpcError) {
      console.error("RPC error:", rpcError);
      return res.status(500).json({
        error: `Failed to mark service completed: ${rpcError.message}`,
      });
    }

    // Fetch the updated service
    const { data: updatedService, error: fetchError } = await supabase
      .from("service_jobs")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (fetchError) {
      console.error("Fetch error:", fetchError);
      return res.status(500).json({
        error: `Failed to fetch updated service: ${fetchError.message}`,
      });
    }

    // Count deferred services
    const { count: deferredCount, error: countError } = await supabase
      .from("service_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "deferred");

    if (countError) {
      console.error("Count error:", countError);
      // Don't fail the whole operation
    }

    return res.status(200).json({
      updatedService,
      deferredCount: deferredCount || 0,
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
