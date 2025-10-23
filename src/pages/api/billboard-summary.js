/**
 * Billboard Summary API
 * 
 * Fetches aggregated metrics from the backend API
 * The backend handles database queries, caching, and aggregation
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
 * Fetch billboard summary from backend API
 * @returns {Promise<Object>} - { data, error }
 */
export async function getBillboardSummary() {
  try {
    // Call backend API route
    const response = await fetch('/api/billboard-summary');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching billboard summary:', error);
    return {
      data: null,
      error: error.message || 'Failed to fetch billboard summary',
    };
  }
}

// Default export for direct module import
export default getBillboardSummary;
