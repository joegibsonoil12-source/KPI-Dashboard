/**
 * Billboard Summary API Route
 * 
 * GET /api/billboard-summary
 * 
 * Aggregates Service Tracking and Delivery Tickets metrics
 * Returns JSON with This Week vs Last Week comparison
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

const express = require('express');
const router = express.Router();

// TODO: Import your service functions here
// Example imports (paths may vary based on your repository structure):
// const { getServiceTrackingSummary } = require('../../services/serviceTracking');
// const { getDeliveryTicketsSummary } = require('../../services/deliveryTickets');

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
 * Fetch service tracking summary for a date range
 * 
 * TODO: Replace this mock implementation with real service calls
 * Import and use your existing service tracking functions
 * 
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  // TODO: Replace with actual database query
  // Example:
  // const result = await getServiceTrackingSummary({ 
  //   startDate: startDate.toISOString(),
  //   endDate: endDate.toISOString()
  // });
  // return result;
  
  // Mock data for now (replace this entire block)
  return {
    completed: 42,
    scheduled: 18,
    deferred: 3,
    completedRevenue: 125000.00,
    pipelineRevenue: 45000.00,
  };
}

/**
 * Fetch delivery tickets summary for a date range
 * 
 * TODO: Replace this mock implementation with real service calls
 * Import and use your existing delivery tickets functions
 * 
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Delivery tickets metrics
 */
async function fetchDeliveryTicketsSummary(startDate, endDate) {
  // TODO: Replace with actual database query
  // Example:
  // const result = await getDeliveryTicketsSummary({
  //   startDate: startDate.toISOString(),
  //   endDate: endDate.toISOString()
  // });
  // return result;
  
  // Mock data for now (replace this entire block)
  return {
    totalTickets: 156,
    totalGallons: 45230.5,
    revenue: 89450.75,
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
 * GET /api/billboard-summary
 * Returns aggregated billboard metrics with caching
 */
router.get('/', async (req, res) => {
  try {
    // Check cache validity
    const now = Date.now();
    if (cache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL_MS) {
      console.log('[Billboard] Returning cached data');
      return res.json(cache);
    }

    // Fetch fresh data
    console.log('[Billboard] Fetching fresh data');
    const data = await aggregateBillboardData();

    // Update cache
    cache = data;
    cacheTimestamp = now;

    return res.json(data);
  } catch (error) {
    console.error('[Billboard] Error fetching summary:', error);
    return res.status(500).json({
      error: 'Failed to fetch billboard summary',
      message: error.message,
    });
  }
});

module.exports = router;
