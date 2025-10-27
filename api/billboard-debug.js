/**
 * Simple server-side debug endpoint for Supabase connectivity and table existence.
 * Add to repository at api/billboard-debug.js and deploy to Vercel.
 *
 * Response (JSON):
 * {
 *   ok: boolean,
 *   env: { hasSupabaseUrl: boolean, hasServiceRoleKey: boolean },
 *   tables: { service_jobs: boolean|null, delivery_tickets: boolean|null },
 *   errors: [ ... ]
 * }
 *
 * NOTE: This endpoint runs server-side and DOES NOT expose any secret values.
 */

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const errors = [];

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const result = {
    ok: false,
    env: {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceKey,
    },
    tables: {
      service_jobs: null,
      delivery_tickets: null,
    },
    errors: [],
  };

  if (!supabaseUrl || !serviceKey) {
    result.errors.push('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server env.');
    return res.status(500).json(result);
  }

  // Create server-side client
  let supabase;
  try {
    supabase = createClient(supabaseUrl, serviceKey);
  } catch (err) {
    result.errors.push('Failed to create Supabase client: ' + err.message);
    return res.status(500).json(result);
  }

  // Safe checks: use to_regclass via SQL to test table existence (works even if table doesn't exist)
  try {
    const { data: tj } = await supabase.rpc('sql', { /* no-op */ }).catch(()=>null);
    // Not all projects allow RPC 'sql' - fallback to simple query below using from().select().limit(1)
  } catch (e) {
    // ignore - we'll use direct queries
  }

  try {
    // Check service_jobs
    const { data: sjData, error: sjErr } = await supabase
      .from('service_jobs')
      .select('id')
      .limit(1);

    if (sjErr) {
      // If relation doesn't exist supabase-js typically returns error.message
      result.tables.service_jobs = false;
      result.errors.push(`service_jobs check error: ${sjErr.message}`);
    } else {
      result.tables.service_jobs = Array.isArray(sjData);
    }
  } catch (err) {
    result.tables.service_jobs = false;
    result.errors.push('service_jobs exception: ' + err.message);
  }

  try {
    // Check delivery_tickets
    const { data: dtData, error: dtErr } = await supabase
      .from('delivery_tickets')
      .select('id')
      .limit(1);

    if (dtErr) {
      result.tables.delivery_tickets = false;
      result.errors.push(`delivery_tickets check error: ${dtErr.message}`);
    } else {
      result.tables.delivery_tickets = Array.isArray(dtData);
    }
  } catch (err) {
    result.tables.delivery_tickets = false;
    result.errors.push('delivery_tickets exception: ' + err.message);
  }

  // Final status
  result.ok = result.env.hasSupabaseUrl && result.env.hasServiceRoleKey &&
              result.tables.service_jobs !== false && result.tables.delivery_tickets !== false;

  // If both tables are false and errors exist, return 500 so we can see logs
  const status = result.ok ? 200 : 500;
  return res.status(status).json(result);
};
