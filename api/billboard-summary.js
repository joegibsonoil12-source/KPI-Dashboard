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
 * - Same response schema as Netlify function
 * 
 * Environment Variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for elevated permissions
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

import { createClient } from '@supabase/supabase-js';

// In-memory cache with 15-second TTL
let cache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 15000; // 15 seconds

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
 * Fetch service tracking summary for a date range from Supabase
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  const supabase = createSupabaseClient();
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('service_jobs')
    .select('status, job_amount, job_date')
    .gte('job_date', startDateStr)
    .lte('job_date', endDateStr);
  
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
    const amount = parseFloat(job.job_amount) || 0;
    const status = (job.status || '').toLowerCase();
    
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
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('delivery_tickets')
    .select('qty, amount, date')
    .gte('date', startDateStr)
    .lte('date', endDateStr);
  
  if (error) {
    console.error('[Billboard] Error fetching delivery tickets:', error);
    throw new Error(`Failed to fetch delivery tickets: ${error.message}`);
  }
  
  let totalTickets = 0;
  let totalGallons = 0;
  let revenue = 0;
  
  (data || []).forEach(ticket => {
    totalTickets += 1;
    totalGallons += parseFloat(ticket.qty) || 0;
    revenue += parseFloat(ticket.amount) || 0;
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
 * @param {string} token - Token from query params
 * @returns {boolean} - Whether token is valid
 */
function verifyToken(token) {
  const requiredToken = process.env.BILLBOARD_TV_TOKEN;
  
  if (!requiredToken) {
    return true;
  }
  
  return token === requiredToken;
}

/**
 * Vercel Serverless Handler
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
    return;
  }

  try {
    // Optional: Check token for TV mode access
    const tv = req.query.tv;
    const token = req.query.token;
    const isTVMode = tv === '1';
    
    if (isTVMode && !verifyToken(token)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid access token',
      });
      return;
    }

    // Check cache validity
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Billboard] Returning cached data');
      res.status(200).json(cache);
      return;
    }

    // Fetch fresh data
    console.log('[Billboard] Fetching fresh data');
    const data = await aggregateBillboardData();

    // Update cache
    cache = data;
    cacheTimestamp = now;

    res.status(200).json(data);
  } catch (error) {
    console.error('[Billboard] Error fetching summary:', error);
    res.status(500).json({
      error: 'Failed to fetch billboard summary',
      message: error.message,
    });
  }
}
