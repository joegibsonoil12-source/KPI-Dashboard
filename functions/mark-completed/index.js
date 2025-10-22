// Supabase Edge Function: mark-completed
// =====================================================
// This function accepts a customer name via JSON body and calls the
// mark_customer_completed RPC function using the service_role key.
//
// Required environment variable:
// - SUPABASE_SERVICE_ROLE_KEY: The Supabase service role key for elevated permissions
//
// Request body: { "customer": "Customer Name" }
// Response: { "success": true, "updatedCount": N } or error JSON
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Deno.serve is the standard way to define an Edge Function handler
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const { customer } = body;

    // Validate input
    if (!customer || typeof customer !== 'string' || customer.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing "customer" field in request body' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get Supabase URL and service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Call the RPC function
    const { data, error } = await supabase.rpc('mark_customer_completed', {
      customer_key: customer.trim(),
    });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: 'Database operation failed', details: error.message }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Extract updated count from RPC result
    // The RPC returns TABLE(updated_count INT), so data is an array like [{ updated_count: N }]
    const updatedCount = Array.isArray(data) && data.length > 0 
      ? Number(data[0].updated_count || 0) 
      : 0;

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        updatedCount,
        customer: customer.trim(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: err.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
