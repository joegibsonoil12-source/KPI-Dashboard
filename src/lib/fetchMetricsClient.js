/**
 * Fetch Metrics Client
 * 
 * Client-side functions for fetching metrics from Supabase
 * Features:
 * - getBillboardSummary(): Fetches current week vs last week comparison
 * - getMetricsTimeseries(): Fetches time series data with flexible granularity and compare modes
 * 
 * Uses the Supabase anon key client-side
 * Falls back to mock data if Supabase is not configured
 */

import { supabase } from './supabaseClient';

/**
 * Mock data for fallback when Supabase is unavailable
 */
const MOCK_BILLBOARD_DATA = {
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
 * Get start of week (Monday) for a given date
 * @param {Date} date - Reference date
 * @returns {Date} - Start of week (Monday at 00:00:00)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Service tracking metrics
 */
async function fetchServiceTrackingSummary(startDate, endDate) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('service_jobs')
    .select('status, job_amount, job_date')
    .gte('job_date', startDateStr)
    .lte('job_date', endDateStr);

  if (error) {
    console.error('[fetchMetricsClient] Error fetching service jobs:', error);
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
 * Fetch delivery tickets summary for a date range
 * @param {Date} startDate - Filter start
 * @param {Date} endDate - Filter end
 * @returns {Promise<Object>} - Delivery tickets metrics
 */
async function fetchDeliveryTicketsSummary(startDate, endDate) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('delivery_tickets')
    .select('qty, amount, date')
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  if (error) {
    console.error('[fetchMetricsClient] Error fetching delivery tickets:', error);
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
 * Get billboard summary (this week vs last week)
 * @returns {Promise<Object>} - { data, error }
 */
export async function getBillboardSummary() {
  try {
    // If Supabase is not configured, return mock data
    if (!supabase) {
      console.warn('[fetchMetricsClient] Supabase not configured, using mock data');
      return { data: MOCK_BILLBOARD_DATA, error: null };
    }

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

    const data = {
      serviceTracking: thisWeekService,
      deliveryTickets: thisWeekDelivery,
      weekCompare: {
        thisWeekTotalRevenue,
        lastWeekTotalRevenue,
        percentChange: parseFloat(percentChange.toFixed(1)),
      },
      lastUpdated: new Date().toISOString(),
    };

    return { data, error: null };
  } catch (error) {
    console.error('[fetchMetricsClient] Error in getBillboardSummary:', error);
    // Fall back to mock data on error
    return { data: MOCK_BILLBOARD_DATA, error: null };
  }
}

/**
 * Get metrics time series data
 * 
 * @param {Object} options - Query options
 * @param {string} options.source - Data source: 'service' or 'delivery'
 * @param {Date} options.start - Start date for the primary period
 * @param {Date} options.end - End date for the primary period
 * @param {string} options.granularity - 'day', 'week', or 'month'
 * @param {string} [options.compare] - Compare mode: 'previous' or 'custom'
 * @param {Date} [options.compareStart] - Start date for comparison (if compare='custom')
 * @param {Date} [options.compareEnd] - End date for comparison (if compare='custom')
 * 
 * @returns {Promise<Object>} - { primary, comparison, error }
 */
export async function getMetricsTimeseries(options) {
  try {
    if (!supabase) {
      console.warn('[fetchMetricsClient] Supabase not configured, cannot fetch timeseries');
      return { primary: [], comparison: null, error: 'Supabase not configured' };
    }

    const { source, start, end, granularity, compare, compareStart, compareEnd } = options;

    // Validate inputs
    if (!source || !start || !end || !granularity) {
      throw new Error('Missing required parameters: source, start, end, granularity');
    }

    // Determine the view name based on source and granularity
    const viewMap = {
      service: {
        day: 'service_jobs_daily',
        week: 'service_jobs_weekly',
        month: 'service_jobs_monthly',
      },
      delivery: {
        day: 'delivery_tickets_daily',
        week: 'delivery_tickets_weekly',
        month: 'delivery_tickets_monthly',
      },
    };

    const viewName = viewMap[source]?.[granularity];
    if (!viewName) {
      throw new Error(`Invalid source (${source}) or granularity (${granularity})`);
    }

    // Determine date column name based on granularity
    const dateColumnMap = {
      day: 'date',
      week: 'week_start',
      month: 'month_start',
    };
    const dateColumn = dateColumnMap[granularity];

    // Fetch primary period data
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const { data: primaryData, error: primaryError } = await supabase
      .from(viewName)
      .select('*')
      .gte(dateColumn, startStr)
      .lte(dateColumn, endStr)
      .order(dateColumn, { ascending: true });

    if (primaryError) {
      console.error('[fetchMetricsClient] Error fetching primary data:', primaryError);
      throw new Error(`Failed to fetch ${source} data: ${primaryError.message}`);
    }

    // Fetch comparison data if requested
    let comparisonData = null;
    if (compare) {
      let compStartStr, compEndStr;

      if (compare === 'previous') {
        // Calculate previous period based on the duration of the primary period
        const duration = end - start;
        const compStart = new Date(start.getTime() - duration);
        const compEnd = new Date(start.getTime() - 1); // Day before start

        compStartStr = compStart.toISOString().split('T')[0];
        compEndStr = compEnd.toISOString().split('T')[0];
      } else if (compare === 'custom' && compareStart && compareEnd) {
        compStartStr = compareStart.toISOString().split('T')[0];
        compEndStr = compareEnd.toISOString().split('T')[0];
      } else {
        console.warn('[fetchMetricsClient] Invalid compare mode or missing compareStart/compareEnd');
      }

      if (compStartStr && compEndStr) {
        const { data: compData, error: compError } = await supabase
          .from(viewName)
          .select('*')
          .gte(dateColumn, compStartStr)
          .lte(dateColumn, compEndStr)
          .order(dateColumn, { ascending: true });

        if (compError) {
          console.warn('[fetchMetricsClient] Error fetching comparison data:', compError);
        } else {
          comparisonData = compData;
        }
      }
    }

    return {
      primary: primaryData || [],
      comparison: comparisonData,
      error: null,
    };
  } catch (error) {
    console.error('[fetchMetricsClient] Error in getMetricsTimeseries:', error);
    return {
      primary: [],
      comparison: null,
      error: error.message,
    };
  }
}

export default { getBillboardSummary, getMetricsTimeseries };
