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
 * - BILLBOARD_TV_TOKEN (optional): Secret token for TV mode access control
 * 
 * Response Schema:
 * {
 *   serviceTracking: {
 *     completed: number,
 *     scheduled: number,
 *     deferred: number,
 *     completedRevenue: number,
 *     pipelineRevenue: number
 *   },
 *   deliveryTickets: {
 *     totalTickets: number,
 *     totalGallons: number,
 *     revenue: number
 *   },
 *   weekCompare: {
 *     thisWeekTotalRevenue: number,
 *     lastWeekTotalRevenue: number,
 *     percentChange: number
 *   },
 *   lastUpdated: string (ISO timestamp)
 * }
 */

// Import Supabase client for server-side queries
const { createClient } = require('@supabase/supabase-js');

// TODO: If you want to use src/lib/serviceHelpers.js helpers server-side:
// 1. Refactor helpers to work in Node.js (remove browser-specific code)
// 2. Import them here: const { fetchServiceJobs } = require('../src/lib/serviceHelpers');
// 3. Use them in the fetch functions below
// For now, we query Supabase directly in this serverless function

// In-memory cache with 15-second TTL
let cache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 15000; // 15 seconds

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
 * Fetch service tracking summary for a date range from Supabase
 * 
 * Uses service_jobs table with columns:
 * - status: normalized status (completed, scheduled, etc.)
 * - job_amount: revenue amount
 * - job_date: date of the job
 * 
 * TODO: If your table/column names differ:
 * - Update table name from 'service_jobs' to your table name
 * - Update column names in the select/filter clauses
 * - Update status value mappings if needed
 * 
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  // Initialize Supabase client with service role key (server-side only)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Format dates as ISO strings for Supabase query
  const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const endDateStr = endDate.toISOString().split('T')[0];
  
  // Query service_jobs table
  // TODO: If column names differ, update these field names
  const { data, error } = await supabase
    .from('service_jobs')
    .select('status, job_amount, job_date')
    .gte('job_date', startDateStr)
    .lte('job_date', endDateStr);
  
  if (error) {
    console.error('[Billboard] Error fetching service jobs:', error);
    throw new Error(`Failed to fetch service jobs: ${error.message}`);
  }
  
  // Aggregate data by status
  const summary = {
    completed: 0,
    scheduled: 0,
    deferred: 0,
    completedRevenue: 0,
    pipelineRevenue: 0,
  };
  
  (data || []).forEach(job => {
    const amount = parseFloat(job.job_amount) || 0;
    const status = (job.status || '').toLowerCase();
    
    // TODO: If your status values differ, update these mappings
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
      // Count as scheduled for pipeline
      summary.scheduled += 1;
      summary.pipelineRevenue += amount;
    }
  });
  
  return summary;
}

/**
 * Fetch delivery tickets summary for a date range from Supabase
 * 
 * Uses delivery_tickets table with columns:
 * - qty: gallons delivered (maps to totalGallons)
 * - amount: revenue (maps to revenue)
 * - date: created_at date field
 * 
 * TODO: If your table/column names differ:
 * - The schema shows 'qty' for gallons and 'amount' for revenue
 * - The schema shows 'date' field (not 'created_at') for filtering
 * - Update these field names if your schema differs
 * 
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Delivery tickets metrics
 */
async function fetchDeliveryTicketsSummary(startDate, endDate) {
  // Initialize Supabase client with service role key (server-side only)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Format dates as ISO strings for Supabase query
  const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const endDateStr = endDate.toISOString().split('T')[0];
  
  // Query delivery_tickets table
  // TODO: Update field names if your schema differs
  // Note: The schema uses 'date' (not 'created_at') and 'qty' (not 'gallons')
  const { data, error } = await supabase
    .from('delivery_tickets')
    .select('qty, amount, date')
    .gte('date', startDateStr)
    .lte('date', endDateStr);
  
  if (error) {
    console.error('[Billboard] Error fetching delivery tickets:', error);
    throw new Error(`Failed to fetch delivery tickets: ${error.message}`);
  }
  
  // Aggregate data
  let totalTickets = 0;
  let totalGallons = 0;
  let revenue = 0;
  
  (data || []).forEach(ticket => {
    totalTickets += 1;
    totalGallons += parseFloat(ticket.qty) || 0; // TODO: qty maps to gallons
    revenue += parseFloat(ticket.amount) || 0;    // TODO: amount maps to revenue
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

  // This Week: Monday - Sunday
  const thisWeekStart = getWeekStart(now);
  const thisWeekEnd = getWeekEnd(now);

  // Last Week: Previous Monday - Sunday
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  // Fetch data in parallel
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

  // Calculate total revenue for This Week and Last Week
  const thisWeekTotalRevenue = thisWeekService.completedRevenue + thisWeekDelivery.revenue;
  const lastWeekTotalRevenue = lastWeekService.completedRevenue + lastWeekDelivery.revenue;

  // Calculate percent change (handle division by zero per requirement)
  let percentChange = 0;
  if (lastWeekTotalRevenue === 0) {
    // If last week was 0, set to 100% if this week > 0, else 0%
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
 * @param {string} token - Token from query params
 * @returns {boolean} - Whether token is valid
 */
function verifyToken(token) {
  const requiredToken = process.env.BILLBOARD_TV_TOKEN;
  
  // If no token is configured, allow all access
  if (!requiredToken) {
    return true;
  }
  
  // If token is configured, require it to match
  return token === requiredToken;
}

/**
 * Vercel Serverless Handler
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
module.exports = async (req, res) => {
  // Set CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
  }

  try {
    // Optional: Check token for TV mode access
    // When ?tv=1 is present, token is required if BILLBOARD_TV_TOKEN is set
    const { tv, token } = req.query;
    const isTVMode = tv === '1';
    
    if (isTVMode && !verifyToken(token)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid access token',
      });
    }

    // Check cache validity
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Billboard] Returning cached data');
      return res.status(200).json(cache);
    }

    // Fetch fresh data
    console.log('[Billboard] Fetching fresh data');
    const data = await aggregateBillboardData();

    // Update cache
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
