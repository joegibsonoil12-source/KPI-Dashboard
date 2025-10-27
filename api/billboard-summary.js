/**
 * Vercel Serverless Function: Billboard Summary API
 *
 * GET /api/billboard-summary
 *
 * Aggregates Service Tracking and Delivery Tickets metrics
 * Returns JSON with This Week vs Last Week comparison
 *
 * Features:
 * - 15-second in-memory cache (serverless edge cache)
 * - Optional token-based access control for TV mode
 * - Same response schema as Express route
 *
 * Environment Variables:
 * - BILLBOARD_TV_TOKEN or VERCEL_BILLBOARD_TV_TOKEN (optional): Secret token for TV mode access control
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-only)
 *
 * Response Schema:
 * {
 *   serviceTracking: { ... },
 *   deliveryTickets: { ... },
 *   weekCompare: { thisWeekTotalRevenue, lastWeekTotalRevenue, percentChange },
 *   lastUpdated: string (ISO timestamp)
 * }
 */

// Import Supabase client for server-side queries
const { createClient } = require('@supabase/supabase-js');

// In-memory cache with 15-second TTL
let cache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 15000; // 15 seconds

// Schema detection cache: stores the working table/column configuration
// Once detected, these are reused for subsequent requests to avoid re-probing
let detectedServiceCandidate = null;
let detectedDeliveryCandidate = null;

/**
 * Create Supabase client with service role key
 * @returns {Object} - Supabase client instance
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get start of week (Monday) for a given date
 * @param {Date} date - Reference date
 * @returns {Date} - Start of week (Monday at 00:00:00)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get end of week (Sunday) for a given date
 * @param {Date} date - Reference date
 * @returns {Date} - End of week (Sunday at 23:59:59.999)
 */
function getWeekEnd(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Helper function to find a working table/column configuration from a list of candidates.
 * Tries each candidate by performing a safe .select().limit(1) query.
 * Returns the first candidate that succeeds along with a sample row.
 *
 * @param {Object} supabase - Supabase client instance
 * @param {Array} candidates - Array of candidate objects: { table, select, mapping }
 *   - table: table name to query
 *   - select: column selection string (e.g., 'id, status, amount')
 *   - mapping: object mapping standardized field names to actual column names
 *              e.g., { status: 'status', amount: 'job_amount', date: 'job_date' }
 * @returns {Promise<Object|null>} - { candidate, sampleRow } or null if none succeed
 */
async function findWorkingQuery(supabase, candidates) {
  for (const candidate of candidates) {
    try {
      const { data, error } = await supabase
        .from(candidate.table)
        .select(candidate.select)
        .limit(1);

      if (!error && Array.isArray(data)) {
        console.log(`[Billboard Schema Detection] Found working table: ${candidate.table}`);
        return { candidate, sampleRow: data[0] || null };
      }
    } catch (err) {
      // Silently continue to next candidate
    }
  }
  return null;
}

/**
 * Fetch service tracking summary for a date range from Supabase
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  const supabase = createSupabaseClient();

  // Define candidate table/column configurations
  // Add more candidates here if your database uses different naming conventions
  const serviceCandidates = [
    // Standard naming: service_jobs
    {
      table: 'service_jobs',
      select: 'status, job_amount, job_date',
      mapping: {
        status: 'status',
        amount: 'job_amount',
        date: 'job_date'
      }
    },
    // Alternative: service_tracking
    {
      table: 'service_tracking',
      select: 'status, job_amount, job_date',
      mapping: {
        status: 'status',
        amount: 'job_amount',
        date: 'job_date'
      }
    },
    // Alternative: different column names (amount, date)
    {
      table: 'service_jobs',
      select: 'status, amount, date',
      mapping: {
        status: 'status',
        amount: 'amount',
        date: 'date'
      }
    },
    // Alternative: jobs table
    {
      table: 'jobs',
      select: 'status, amount, date',
      mapping: {
        status: 'status',
        amount: 'amount',
        date: 'date'
      }
    },
  ];

  // Detect working configuration if not already cached
  if (!detectedServiceCandidate) {
    console.log('[Billboard] Detecting service tracking table schema...');
    const result = await findWorkingQuery(supabase, serviceCandidates);
    if (!result) {
      throw new Error('Unable to detect service tracking table. Tried: ' + 
        serviceCandidates.map(c => c.table).join(', '));
    }
    detectedServiceCandidate = result.candidate;
    console.log(`[Billboard] Using service tracking table: ${detectedServiceCandidate.table}`);
  }

  const candidate = detectedServiceCandidate;
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from(candidate.table)
    .select(candidate.select)
    .gte(candidate.mapping.date, startDateStr)
    .lte(candidate.mapping.date, endDateStr);

  if (error) {
    console.error('[Billboard] Error fetching service jobs:', error);
    throw new Error(`Failed to fetch service jobs: ${error.message}`);
  }

  const summary = {
    completed: 0,
    scheduled: 0,
    deferred: 0,
    completedRevenue: 0,
    pipelineRevenue: 0,
  };

  (data || []).forEach(job => {
    const amount = parseFloat(job[candidate.mapping.amount]) || 0;
    const status = (job[candidate.mapping.status] || '').toLowerCase();

    if (status === 'completed') {
      summary.completed += 1;
      summary.completedRevenue += amount;
    } else if (status === 'scheduled') {
      summary.scheduled += 1;
      summary.pipelineRevenue += amount;
    } else if (status === 'deferred') {
      summary.deferred += 1;
      summary.pipelineRevenue += amount;
    } else if (status === 'unscheduled' || status === 'in_progress') {
      summary.scheduled += 1;
      summary.pipelineRevenue += amount;
    }
  });

  return summary;
}

/**
 * Fetch delivery tickets summary for a date range from Supabase
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Delivery tickets metrics
 */
async function fetchDeliveryTicketsSummary(startDate, endDate) {
  const supabase = createSupabaseClient();

  // Define candidate table/column configurations
  // Add more candidates here if your database uses different naming conventions
  const deliveryCandidates = [
    // Standard naming: delivery_tickets with qty, amount, date
    {
      table: 'delivery_tickets',
      select: 'qty, amount, date',
      mapping: {
        qty: 'qty',
        amount: 'amount',
        date: 'date'
      }
    },
    // Alternative: quantity instead of qty
    {
      table: 'delivery_tickets',
      select: 'quantity, amount, date',
      mapping: {
        qty: 'quantity',
        amount: 'amount',
        date: 'date'
      }
    },
    // Alternative: deliveries table
    {
      table: 'deliveries',
      select: 'qty, amount, date',
      mapping: {
        qty: 'qty',
        amount: 'amount',
        date: 'date'
      }
    },
    // Alternative: delivery_date instead of date
    {
      table: 'delivery_tickets',
      select: 'qty, amount, delivery_date',
      mapping: {
        qty: 'qty',
        amount: 'amount',
        date: 'delivery_date'
      }
    },
  ];

  // Detect working configuration if not already cached
  if (!detectedDeliveryCandidate) {
    console.log('[Billboard] Detecting delivery tickets table schema...');
    const result = await findWorkingQuery(supabase, deliveryCandidates);
    if (!result) {
      throw new Error('Unable to detect delivery tickets table. Tried: ' + 
        deliveryCandidates.map(c => c.table).join(', '));
    }
    detectedDeliveryCandidate = result.candidate;
    console.log(`[Billboard] Using delivery tickets table: ${detectedDeliveryCandidate.table}`);
  }

  const candidate = detectedDeliveryCandidate;
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from(candidate.table)
    .select(candidate.select)
    .gte(candidate.mapping.date, startDateStr)
    .lte(candidate.mapping.date, endDateStr);

  if (error) {
    console.error('[Billboard] Error fetching delivery tickets:', error);
    throw new Error(`Failed to fetch delivery tickets: ${error.message}`);
  }

  let totalTickets = 0;
  let totalGallons = 0;
  let revenue = 0;

  (data || []).forEach(ticket => {
    totalTickets += 1;
    totalGallons += parseFloat(ticket[candidate.mapping.qty]) || 0;
    revenue += parseFloat(ticket[candidate.mapping.amount]) || 0;
  });

  return {
    totalTickets,
    totalGallons,
    revenue,
  };
}

/**
 * Aggregate billboard data from all sources
 * @returns {Promise<Object>} - Complete billboard summary
 */
async function aggregateBillboardData() {
  const now = new Date();

  const thisWeekStart = getWeekStart(now);
  const thisWeekEnd = getWeekEnd(now);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  const [
    thisWeekService,
    lastWeekService,
    thisWeekDelivery,
    lastWeekDelivery,
  ] = await Promise.all([
    fetchServiceTrackingSummary(thisWeekStart, thisWeekEnd),
    fetchServiceTrackingSummary(lastWeekStart, lastWeekEnd),
    fetchDeliveryTicketsSummary(thisWeekStart, thisWeekEnd),
    fetchDeliveryTicketsSummary(lastWeekStart, lastWeekEnd),
  ]);

  const thisWeekTotalRevenue = thisWeekService.completedRevenue + thisWeekDelivery.revenue;
  const lastWeekTotalRevenue = lastWeekService.completedRevenue + lastWeekDelivery.revenue;

  let percentChange = 0;
  if (lastWeekTotalRevenue === 0) {
    percentChange = thisWeekTotalRevenue > 0 ? 100 : 0;
  } else {
    percentChange = ((thisWeekTotalRevenue - lastWeekTotalRevenue) / lastWeekTotalRevenue) * 100;
  }

  return {
    serviceTracking: thisWeekService,
    deliveryTickets: thisWeekDelivery,
    weekCompare: {
      thisWeekTotalRevenue,
      lastWeekTotalRevenue,
      percentChange: parseFloat(percentChange.toFixed(1)),
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Verify token for TV mode access control
 * Accepts token from:
 *  - x-tv-token header
 *  - Authorization: Bearer <token>
 *  - ?token= query param
 * Checks env var BILLBOARD_TV_TOKEN or VERCEL_BILLBOARD_TV_TOKEN
 * If no token configured, TV mode access is allowed.
 */
function verifyToken(providedToken) {
  const requiredToken =
    (process.env.BILLBOARD_TV_TOKEN || process.env.VERCEL_BILLBOARD_TV_TOKEN || '').toString();

  // No token configured => allow all access
  if (!requiredToken) return true;

  return providedToken === requiredToken;
}

/**
 * Extract token from request (header or query)
 */
function extractTokenFromRequest(req) {
  // Header keys in Node on Vercel are lowercase
  const headerToken = (req.headers && (req.headers['x-tv-token'] || req.headers['x-tv-token'.toLowerCase()])) || null;
  const authHeader = (req.headers && (req.headers['authorization'] || req.headers['Authorization'])) || null;

  if (headerToken) return headerToken.toString();

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1].toString();
    }
    // Fallback to raw auth header if not Bearer
    return authHeader.toString();
  }

  // Query param fallback
  if (req.query && req.query.token) return req.query.token.toString();

  return '';
}

/**
 * Vercel Serverless Handler
 */
module.exports = async (req, res) => {
  // Set CORS headers for cross-origin requests, allow token headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tv-token, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
  }

  try {
    const { tv } = req.query;
    const isTVMode = tv === '1';

    // Extract provided token from request
    const provided = extractTokenFromRequest(req);

    // If tv mode requested, enforce token if configured
    if (isTVMode) {
      if (!verifyToken(provided)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid access token',
        });
      }
    }

    // Serve from cache if fresh
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Billboard] Returning cached data');
      return res.status(200).json(cache);
    }

    // Otherwise fetch fresh
    console.log('[Billboard] Fetching fresh data');
    const data = await aggregateBillboardData();

    cache = data;
    cacheTimestamp = now;

    return res.status(200).json(data);
  } catch (error) {
    console.error('[Billboard] Error fetching summary:', error);
    return res.status(500).json({
      error: 'Failed to fetch billboard summary',
      message: error.message,
    });
  }
};
