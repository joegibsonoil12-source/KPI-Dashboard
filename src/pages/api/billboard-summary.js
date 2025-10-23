/**
 * Billboard Summary API
 * 
 * Aggregates metrics from service_jobs and delivery_tickets tables
 * Returns a JSON response with This Week vs Last Week comparison
 * 
 * Query params:
 * - refresh: Override refresh interval (for testing)
 * 
 * Response shape:
 * {
 *   serviceTracking: { completed, scheduled, deferred, completedRevenue, pipelineRevenue },
 *   deliveryTickets: { totalTickets, totalGallons, revenue },
 *   weekCompare: { thisWeekTotalRevenue, lastWeekTotalRevenue, percentChange },
 *   lastUpdated: ISO timestamp
 * }
 */

import { supabase } from '../../lib/supabaseClient';

// In-memory cache for 15 seconds to avoid DB hammering
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
 * Fetch service tracking summary
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  try {
    // Fetch service jobs within date range
    const { data: jobs, error } = await supabase
      .from('service_jobs')
      .select('*')
      .gte('job_date', startDate.toISOString())
      .lte('job_date', endDate.toISOString());

    if (error) {
      console.error('Error fetching service jobs:', error);
      // Return empty metrics on error
      return {
        completed: 0,
        scheduled: 0,
        deferred: 0,
        completedRevenue: 0,
        pipelineRevenue: 0,
      };
    }

    const jobsList = jobs || [];

    // Compute metrics
    const completed = jobsList.filter(j => j.status === 'completed').length;
    const scheduled = jobsList.filter(j => j.status === 'scheduled').length;
    const deferred = jobsList.filter(j => j.status === 'deferred').length;

    const completedRevenue = jobsList
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + (parseFloat(j.job_amount) || 0), 0);

    const pipelineRevenue = jobsList
      .filter(j => j.status === 'scheduled' || j.status === 'in_progress')
      .reduce((sum, j) => sum + (parseFloat(j.job_amount) || 0), 0);

    return {
      completed,
      scheduled,
      deferred,
      completedRevenue,
      pipelineRevenue,
    };
  } catch (err) {
    console.error('Exception in fetchServiceTrackingSummary:', err);
    return {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
    };
  }
}

/**
 * Fetch delivery tickets summary
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Delivery tickets metrics
 */
async function fetchDeliveryTicketsSummary(startDate, endDate) {
  try {
    // Fetch delivery tickets within date range
    const { data: tickets, error } = await supabase
      .from('delivery_tickets')
      .select('*')
      .gte('delivery_date', startDate.toISOString())
      .lte('delivery_date', endDate.toISOString());

    if (error) {
      console.error('Error fetching delivery tickets:', error);
      return {
        totalTickets: 0,
        totalGallons: 0,
        revenue: 0,
      };
    }

    const ticketsList = tickets || [];

    // Compute metrics
    const totalTickets = ticketsList.length;
    const totalGallons = ticketsList.reduce((sum, t) => {
      return sum + (parseFloat(t.gallons_delivered) || parseFloat(t.qty) || 0);
    }, 0);
    const revenue = ticketsList.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    return {
      totalTickets,
      totalGallons,
      revenue,
    };
  } catch (err) {
    console.error('Exception in fetchDeliveryTicketsSummary:', err);
    return {
      totalTickets: 0,
      totalGallons: 0,
      revenue: 0,
    };
  }
}

/**
 * Aggregate billboard data
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

  // Calculate percent change (handle division by zero)
  let percentChange = 0;
  if (lastWeekTotalRevenue === 0) {
    // If last week was 0 and this week > 0, consider it 100% increase
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
 * API handler function
 * Note: This is a client-side API route pattern used by Vite/React apps
 * It will be called by the frontend via fetch()
 */
export async function getBillboardSummary() {
  try {
    // Check cache validity
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('Returning cached billboard data');
      return { data: cache, error: null };
    }

    // Fetch fresh data
    console.log('Fetching fresh billboard data');
    const data = await aggregateBillboardData();

    // Update cache
    cache = data;
    cacheTimestamp = now;

    return { data, error: null };
  } catch (error) {
    console.error('Error in getBillboardSummary:', error);
    return {
      data: null,
      error: error.message || 'Failed to fetch billboard summary',
    };
  }
}

// Default export for direct module import
export default getBillboardSummary;
