// src/pages/api/deliveries.js
// Server-side endpoint for fetching delivery tickets
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
 * GET /api/deliveries
 * 
 * Fetches delivery tickets from Supabase
 * Query params:
 *  - limit: max number of records (default 100)
 * 
 * Response: { deliveries: Array }
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { limit = 100 } = req.query;

  try {
    const supabase = createServerClient();

    // Fetch deliveries
    const { data: deliveries, error: fetchError } = await supabase
      .from("delivery_tickets")
      .select("*")
      .order("delivery_date", { ascending: false })
      .limit(parseInt(limit));

    if (fetchError) {
      console.error("Fetch deliveries error:", fetchError);
      return res.status(500).json({
        error: `Failed to fetch deliveries: ${fetchError.message}`,
      });
    }

    return res.status(200).json({
      deliveries: deliveries || [],
    });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
