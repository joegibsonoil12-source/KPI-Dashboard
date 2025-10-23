// src/pages/api/services.js
// Server-side endpoint for fetching service jobs
// NOTE: This requires serverless function deployment (Vercel/Netlify)
// For static hosting, the client fetches directly from Supabase

import { createClient } from "@supabase/supabase-js";

/**
 * Create server-side Supabase client
 */
function createServerClient() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

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
 * GET /api/services
 * 
 * Fetches service jobs from Supabase
 * Query params:
 *  - status: filter by status (e.g., 'deferred', 'completed', etc.)
 *  - limit: max number of records (default 100)
 * 
 * Response: { services: Array, deferredCount: number }
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { status, limit = 100 } = req.query;

  try {
    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from("service_jobs")
      .select("*")
      .order("job_date", { ascending: false })
      .limit(parseInt(limit));

    // Apply status filter if provided
    if (status) {
      query = query.eq("status", status);
    }

    // Fetch services
    const { data: services, error: fetchError } = await query;

    if (fetchError) {
      console.error("Fetch services error:", fetchError);
      return res.status(500).json({
        error: `Failed to fetch services: ${fetchError.message}`,
      });
    }

    // Get deferred count
    const { count: deferredCount, error: countError } = await supabase
      .from("service_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "deferred");

    if (countError) {
      console.error("Count error:", countError);
      // Don't fail the whole request
    }

    return res.status(200).json({
      services: services || [],
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
