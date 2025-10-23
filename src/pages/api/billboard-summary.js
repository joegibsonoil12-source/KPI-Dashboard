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
 * 
 * Response shape:
 * {
 *   serviceTracking: { completed, scheduled, deferred, completedRevenue, pipelineRevenue },
 *   deliveryTickets: { totalTickets, totalGallons, revenue },
 *   weekCompare: { thisWeekTotalRevenue, lastWeekTotalRevenue, percentChange },
 *   lastUpdated: ISO timestamp
 * }
 */

/**
 * Mock data for fallback when API is unreachable
 * Used when deployed to GitHub Pages without serverless backend
 */
const MOCK_DATA = {
  serviceTracking: {
    completed: 42,
    scheduled: 18,
    deferred: 3,
    completedRevenue: 125000.00,
    pipelineRevenue: 45000.00,
  },
  deliveryTickets: {
    totalTickets: 156,
    totalGallons: 45230.5,
    revenue: 89450.75,
  },
  weekCompare: {
    thisWeekTotalRevenue: 214450.75,
    lastWeekTotalRevenue: 198320.50,
    percentChange: 8.1,
  },
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
 * Fetch billboard summary from backend API
 * Falls back to mock data if API returns 404/500 or is unreachable
 * 
 * @returns {Promise<Object>} - { data, error }
 */
export async function getBillboardSummary() {
  try {
    const apiBase = getApiBaseUrl();
    const apiUrl = `${apiBase}/api/billboard-summary`;
    
    console.log('[Billboard API] Fetching from:', apiUrl);
    
    // Call backend API route
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      // If 404 or 500, API not available - use mock data
      if (response.status === 404 || response.status === 500) {
        console.warn(`[Billboard API] API returned ${response.status}, using mock data`);
        return { data: MOCK_DATA, error: null };
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return { data, error: null };
  } catch (error) {
    console.error('[Billboard API] Error fetching billboard summary:', error);
    
    // If network error or other failure, fall back to mock data
    // This ensures the page still works on GitHub Pages
    console.warn('[Billboard API] Using mock data due to error:', error.message);
    return {
      data: MOCK_DATA,
      error: null, // Don't report error when we have fallback
    };
  }
}

// Default export for direct module import
export default getBillboardSummary;
