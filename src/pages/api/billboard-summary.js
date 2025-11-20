/**
 * Billboard Summary API
 * 
 * Fetches aggregated metrics from the backend API
 * The backend handles database queries, caching, and aggregation
 * 
 * Features:
 * - Configurable API base URL via VITE_BILLBOARD_API_BASE env variable
 * - Falls back to mock data if API is unreachable (for GitHub Pages)
 * - Supports both local dev and serverless deployment
 * - Includes scheduled jobs count and revenue in serviceTracking and weekCompare
 * 
 * Response shape:
 * {
 *   serviceTracking: { 
 *     completed, scheduled, deferred, completedRevenue, pipelineRevenue,
 *     scheduledJobs, scheduledRevenue 
 *   },
 *   deliveryTickets: { totalTickets, totalGallons, revenue },
 *   weekCompare: { 
 *     thisWeekTotalRevenue, lastWeekTotalRevenue, percentChange,
 *     scheduledJobs, scheduledRevenue, lastWeekScheduledJobs, lastWeekScheduledRevenue
 *   },
 *   lastUpdated: ISO timestamp
 * }
 */

/**
 * Empty data structure with zeros for fallback
 * Used when API is unreachable or returns invalid data
 * This ensures the UI always shows numbers (zeros) instead of blanks
 */
const EMPTY_DATA = {
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

/**
 * Get the API base URL from environment or default to relative path
 * 
 * Priority:
 * 1. VITE_BILLBOARD_API_BASE env var (if set) - for external API deployments
 * 2. Empty string (relative path) - works for local dev and same-origin deployments
 * 
 * @returns {string} - API base URL
 */
function getApiBaseUrl() {
  // Use environment variable if set (e.g., for GitHub Pages + external API)
  const envBase = import.meta.env.VITE_BILLBOARD_API_BASE;
  if (envBase) {
    return envBase.replace(/\/$/, ''); // Remove trailing slash if present
  }
  
  // Default to empty string for relative path (works for Vercel/Netlify and local dev)
  return '';
}

/**
 * Ensure numeric fields have proper fallback values
 * @param {*} value - Value to check
 * @returns {number} - Number or 0
 */
function ensureNumber(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Number(value);
}

/**
 * Normalize API response to ensure all fields are present with proper types
 * @param {Object} data - Raw API response
 * @returns {Object} - Normalized data with all required fields
 */
function normalizeApiResponse(data) {
  if (!data || typeof data !== 'object') {
    return EMPTY_DATA;
  }
  
  return {
    serviceTracking: {
      completed: ensureNumber(data.serviceTracking?.completed),
      scheduled: ensureNumber(data.serviceTracking?.scheduled),
      deferred: ensureNumber(data.serviceTracking?.deferred),
      completedRevenue: ensureNumber(data.serviceTracking?.completedRevenue),
      pipelineRevenue: ensureNumber(data.serviceTracking?.pipelineRevenue),
      scheduledJobs: ensureNumber(data.serviceTracking?.scheduledJobs),
      scheduledRevenue: ensureNumber(data.serviceTracking?.scheduledRevenue),
    },
    deliveryTickets: {
      totalTickets: ensureNumber(data.deliveryTickets?.totalTickets),
      totalGallons: ensureNumber(data.deliveryTickets?.totalGallons),
      revenue: ensureNumber(data.deliveryTickets?.revenue),
    },
    weekCompare: {
      thisWeekTotalRevenue: ensureNumber(data.weekCompare?.thisWeekTotalRevenue),
      lastWeekTotalRevenue: ensureNumber(data.weekCompare?.lastWeekTotalRevenue),
      percentChange: ensureNumber(data.weekCompare?.percentChange),
      scheduledJobs: ensureNumber(data.weekCompare?.scheduledJobs),
      scheduledRevenue: ensureNumber(data.weekCompare?.scheduledRevenue),
      lastWeekScheduledJobs: ensureNumber(data.weekCompare?.lastWeekScheduledJobs),
      lastWeekScheduledRevenue: ensureNumber(data.weekCompare?.lastWeekScheduledRevenue),
    },
    cStoreGallons: Array.isArray(data.cStoreGallons) ? data.cStoreGallons : [],
    dashboardSquares: data.dashboardSquares || {},
    lastUpdated: data.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Fetch billboard summary from backend API
 * Falls back to empty data (zeros) if API returns 404/500 or is unreachable
 * Ensures all numeric fields are present with zero fallback
 * 
 * @returns {Promise<Object>} - { data, error }
 */
export async function getBillboardSummary() {
  try {
    const apiBase = getApiBaseUrl();
    const apiUrl = `${apiBase}/api/billboard-summary`;
    
    console.log('[Billboard API] Fetching from:', apiUrl);
    
    // Call backend API route with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      cache: 'no-store', // Disable caching to always get fresh data
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // If 404 or 500, API not available - use empty data with zeros
      if (response.status === 404 || response.status === 500) {
        console.warn(`[Billboard API] API returned ${response.status}, using empty data`);
        return { data: EMPTY_DATA, error: `API returned ${response.status}` };
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse JSON response
    let rawData;
    try {
      rawData = await response.json();
    } catch (parseError) {
      console.error('[Billboard API] JSON parse error:', parseError);
      return { data: EMPTY_DATA, error: 'Failed to parse API response' };
    }
    
    // Normalize data to ensure all fields are present with proper types
    const normalizedData = normalizeApiResponse(rawData);
    
    return { data: normalizedData, error: null };
  } catch (error) {
    console.error('[Billboard API] Error fetching billboard summary:', error);
    
    // If network error or other failure, fall back to empty data
    // Show zeros instead of old mock data to avoid confusion
    const errorMessage = error.name === 'AbortError' 
      ? 'Request timeout' 
      : error.message || 'Network error';
    
    console.warn('[Billboard API] Using empty data due to error:', errorMessage);
    return {
      data: EMPTY_DATA,
      error: errorMessage,
    };
  }
}

// Default export for direct module import
export default getBillboardSummary;
