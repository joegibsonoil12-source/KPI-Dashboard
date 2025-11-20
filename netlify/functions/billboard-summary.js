/**
 * Netlify Serverless Function: Billboard Summary API (resilient)
 *
 * GET /.netlify/functions/billboard-summary
 *
 * Improvements:
 * - If SUPABASE_SERVICE_ROLE_KEY is missing, fall back to SUPABASE_ANON_KEY (best-effort).
 * - Catch query errors and return best-effort payload with safe defaults instead of throwing 400.
 * - Keep the same response schema always so frontend doesn't break.
 */

const { createClient } = require('@supabase/supabase-js');

// Simple in-memory cache (15s)
let cache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 15000;

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}
function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Create Supabase client.
 * - If requireService=true and service key missing -> throw.
 * - If requireService=false and service key missing -> fall back to anon key (if present).
 */
function createSupabaseClient(requireService = true) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }

  if (requireService) {
    if (!supabaseServiceKey) {
      // If service role is required but missing, fall back to anon only if available but log.
      if (supabaseAnonKey) {
        console.warn('[Billboard] SUPABASE_SERVICE_ROLE_KEY missing; falling back to anon key (limited access)');
        return createClient(supabaseUrl, supabaseAnonKey);
      }
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (and no anon key available)');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
  } else {
    // Not strictly requiring service key: prefer service if present, otherwise anon if present
    if (supabaseServiceKey) return createClient(supabaseUrl, supabaseServiceKey);
    if (supabaseAnonKey) {
      console.warn('[Billboard] SUPABASE_SERVICE_ROLE_KEY missing; using anon key (best-effort)');
      return createClient(supabaseUrl, supabaseAnonKey);
    }
    throw new Error('No Supabase key available (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY required)');
  }
}

/**
 * Helper: safe zero-filled payload that the frontend expects.
 */
function emptyBillboardPayload() {
  return {
    serviceTracking: {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0,
    },
    deliveryTickets: {
      totalTickets: 0,
      totalGallons: 0,
      revenue: 0,
    },
    weekCompare: {
      thisWeekTotalRevenue: 0,
      lastWeekTotalRevenue: 0,
      percentChange: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0,
      lastWeekScheduledJobs: 0,
      lastWeekScheduledRevenue: 0,
    },
    cStoreGallons: [],
    dashboardSquares: {},
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchServiceTrackingSummary(startDate, endDate) {
  // Use a best-effort client (do not require service key)
  const supabase = createSupabaseClient(false);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('service_jobs')
      .select('status, job_amount, job_date')
      .gte('job_date', startDateStr)
      .lte('job_date', endDateStr);

    if (error) {
      console.error('[Billboard] Error fetching service jobs:', error);
      // return safe zeros for service summary
      return {
        completed: 0,
        scheduled: 0,
        deferred: 0,
        completedRevenue: 0,
        pipelineRevenue: 0,
        scheduledJobs: 0,
        scheduledRevenue: 0,
      };
    }

    const summary = {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0,
    };

    (data || []).forEach(job => {
      const amount = parseFloat(job.job_amount) || 0;
      const status = (job.status || '').toLowerCase();
      if (status === 'completed') {
        summary.completed += 1;
        summary.completedRevenue += amount;
      } else if (status === 'scheduled') {
        summary.scheduled += 1;
        summary.pipelineRevenue += amount;
        summary.scheduledJobs += 1;
        summary.scheduledRevenue += amount;
      } else if (status === 'assigned' || status === 'confirmed') {
        summary.scheduled += 1;
        summary.pipelineRevenue += amount;
        summary.scheduledJobs += 1;
        summary.scheduledRevenue += amount;
      } else if (status === 'deferred') {
        summary.deferred += 1;
        summary.pipelineRevenue += amount;
      } else if (status === 'unscheduled' || status === 'in_progress') {
        summary.scheduled += 1;
        summary.pipelineRevenue += amount;
      }
    });

    return summary;
  } catch (e) {
    console.error('[Billboard] Unexpected error fetching service tracking:', e);
    return {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0,
    };
  }
}

async function fetchDeliveryTicketsSummary(startDate, endDate) {
  const supabase = createSupabaseClient(false);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('delivery_tickets')
      .select('qty, amount, date')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (error) {
      console.error('[Billboard] Error fetching delivery tickets:', error);
      return { totalTickets: 0, totalGallons: 0, revenue: 0 };
    }

    let totalTickets = 0;
    let totalGallons = 0;
    let revenue = 0;
    (data || []).forEach(ticket => {
      totalTickets += 1;
      totalGallons += parseFloat(ticket.qty) || 0;
      revenue += parseFloat(ticket.amount) || 0;
    });

    return { totalTickets, totalGallons, revenue };
  } catch (e) {
    console.error('[Billboard] Unexpected error fetching delivery tickets:', e);
    return { totalTickets: 0, totalGallons: 0, revenue: 0 };
  }
}

async function fetchCStoreGallonsSummary() {
  const supabase = createSupabaseClient(false);
  try {
    const { data, error } = await supabase
      .from('cstore_gallons')
      .select('store_id, week_ending, total_gallons')
      .order('store_id', { ascending: true });

    if (error) {
      console.error('[Billboard] Error fetching c-store gallons:', error);
      return [];
    }

    return (data || []).map(row => ({
      storeId: row.store_id,
      weekEnding: row.week_ending,
      totalGallons: Number(row.total_gallons) || 0,
    }));
  } catch (e) {
    console.error('[Billboard] Unexpected error fetching c-store gallons:', e);
    return [];
  }
}

/**
 * Aggregate billboard data from all sources in a fault-tolerant way
 */
async function aggregateBillboardData() {
  try {
    const now = new Date();
    const thisWeekStart = getWeekStart(now);
    const thisWeekEnd = getWeekEnd(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // Run in parallel, but each fetch is fault tolerant itself
    const [
      thisWeekService,
      lastWeekService,
      thisWeekDelivery,
      lastWeekDelivery,
      cStoreGallons,
    ] = await Promise.all([
      fetchServiceTrackingSummary(thisWeekStart, thisWeekEnd),
      fetchServiceTrackingSummary(lastWeekStart, lastWeekEnd),
      fetchDeliveryTicketsSummary(thisWeekStart, thisWeekEnd),
      fetchDeliveryTicketsSummary(lastWeekStart, lastWeekEnd),
      fetchCStoreGallonsSummary(),
    ]);

    const thisWeekTotalRevenue = (thisWeekService?.completedRevenue || 0) + (thisWeekDelivery?.revenue || 0);
    const lastWeekTotalRevenue = (lastWeekService?.completedRevenue || 0) + (lastWeekDelivery?.revenue || 0);

    let percentChange = 0;
    if (lastWeekTotalRevenue === 0) {
      percentChange = thisWeekTotalRevenue > 0 ? 100 : 0;
    } else {
      percentChange = ((thisWeekTotalRevenue - lastWeekTotalRevenue) / lastWeekTotalRevenue) * 100;
    }

    const dashboardSquares = {
      totalGallonsAllStores: (cStoreGallons || []).reduce((s, r) => s + (Number(r.totalGallons) || 0), 0),
      weeklyServiceRevenue: Number(thisWeekService?.completedRevenue || 0),
    };

    return {
      serviceTracking: thisWeekService || {
        completed: 0, scheduled: 0, deferred: 0, completedRevenue: 0, pipelineRevenue: 0, scheduledJobs: 0, scheduledRevenue: 0,
      },
      deliveryTickets: thisWeekDelivery || { totalTickets: 0, totalGallons: 0, revenue: 0 },
      weekCompare: {
        thisWeekTotalRevenue,
        lastWeekTotalRevenue,
        percentChange: parseFloat(percentChange.toFixed(1)),
        scheduledJobs: thisWeekService?.scheduledJobs || 0,
        scheduledRevenue: thisWeekService?.scheduledRevenue || 0,
        lastWeekScheduledJobs: lastWeekService?.scheduledJobs || 0,
        lastWeekScheduledRevenue: lastWeekService?.scheduledRevenue || 0,
      },
      cStoreGallons: cStoreGallons || [],
      dashboardSquares,
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    // As a last resort, return an empty payload rather than throwing HTTP 400
    console.error('[Billboard] aggregateBillboardData unexpected error:', e);
    return emptyBillboardPayload();
  }
}

/**
 * Netlify handler
 */
exports.handler = async function(event, context) {
  // Simple token gating for TV mode (optional)
  const tvToken = process.env.BILLBOARD_TV_TOKEN;
  if (tvToken && event.queryStringParameters && event.queryStringParameters.tv_token) {
    if (event.queryStringParameters.tv_token !== tvToken) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Invalid TV token' }) };
    }
  }

  try {
    // Serve from short in-memory cache if available
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache),
      };
    }

    const payload = await aggregateBillboardData();

    // Update cache and return
    cache = payload;
    cacheTimestamp = Date.now();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    };
  } catch (err) {
    // Catch all — return safe fallback rather than 400
    console.error('[Billboard] handler fatal error:', err);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emptyBillboardPayload()),
    };
  }
};
