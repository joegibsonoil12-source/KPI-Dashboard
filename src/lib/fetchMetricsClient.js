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
    scheduledJobs: 18,
    scheduledRevenue: 45000.00,
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
    scheduledJobs: 18,
    scheduledRevenue: 45000.00,
    lastWeekScheduledJobs: 15,
    lastWeekScheduledRevenue: 38000.00,
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
      // Track scheduled jobs separately as requested
      summary.scheduledJobs += 1;
      summary.scheduledRevenue += amount;
    } else if (status === 'assigned' || status === 'confirmed') {
      // Include 'assigned' and 'confirmed' as scheduled per requirements
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

  console.debug('[fetchMetricsClient] Service summary:', {
    startDate: startDateStr,
    endDate: endDateStr,
    scheduledJobs: summary.scheduledJobs,
    scheduledRevenue: summary.scheduledRevenue,
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
 * Preference: use aggregate views (service_jobs_daily and delivery_tickets_daily) if available.
 * Falls back to per-table aggregation if views are missing or error.
 *
 * @returns {Promise<Object>} - { data, error }
 */
export async function getBillboardSummary() {
  try {
    // If Supabase is not configured, return mock data
    if (!supabase) {
      console.warn('[fetchMetricsClient] Supabase not configured, using mock data');
      return { data: MOCK_BILLBOARD_DATA, error: null };
    }

    // compute week start (Monday) and end (Sunday) as YYYY-MM-DD
    const now = new Date();
    const thisWeekStartDate = getWeekStart(now);
    const thisWeekEndDate = getWeekEnd(now);
    const thisWeekStart = thisWeekStartDate.toISOString().split('T')[0];
    const thisWeekEnd = thisWeekEndDate.toISOString().split('T')[0];

    // Try the aggregate views first
    try {
      const [
        { data: svcRows = [], error: svcErr } = {},
        { data: delRows = [], error: delErr } = {},
      ] = await Promise.all([
        supabase
          .from('service_jobs_daily')
          .select('day, job_count, revenue')
          .gte('day', thisWeekStart)
          .lte('day', thisWeekEnd),
        supabase
          .from('delivery_tickets_daily')
          .select('day, ticket_count, total_gallons, revenue')
          .gte('day', thisWeekStart)
          .lte('day', thisWeekEnd),
      ]);

      if (!svcErr && !delErr) {
        // aggregate the week totals from the view rows
        const thisWeekService = (svcRows || []).reduce(
          (acc, r) => {
            acc.completed = (acc.completed || 0) + (Number(r.job_count) || 0);
            acc.completedRevenue = (acc.completedRevenue || 0) + (Number(r.revenue) || 0);
            return acc;
          },
          { completed: 0, completedRevenue: 0 }
        );

        const thisWeekDelivery = (delRows || []).reduce(
          (acc, r) => {
            acc.totalTickets = (acc.totalTickets || 0) + (Number(r.ticket_count) || 0);
            acc.totalGallons = (acc.totalGallons || 0) + (Number(r.total_gallons) || 0);
            acc.revenue = (acc.revenue || 0) + (Number(r.revenue) || 0);
            return acc;
          },
          { totalTickets: 0, totalGallons: 0, revenue: 0 }
        );

        // last week range
        const lastWeekStart = new Date(thisWeekStartDate);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekEndDate);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
        const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
        const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];

        const [
          { data: svcLastRows = [] } = {},
          { data: delLastRows = [] } = {},
        ] = await Promise.all([
          supabase
            .from('service_jobs_daily')
            .select('day, job_count, revenue')
            .gte('day', lastWeekStartStr)
            .lte('day', lastWeekEndStr),
          supabase
            .from('delivery_tickets_daily')
            .select('day, ticket_count, total_gallons, revenue')
            .gte('day', lastWeekStartStr)
            .lte('day', lastWeekEndStr),
        ]);

        const lastWeekService = (svcLastRows || []).reduce(
          (acc, r) => {
            acc.completed = (acc.completed || 0) + (Number(r.job_count) || 0);
            acc.completedRevenue = (acc.completedRevenue || 0) + (Number(r.revenue) || 0);
            return acc;
          },
          { completed: 0, completedRevenue: 0 }
        );

        const lastWeekDelivery = (delLastRows || []).reduce(
          (acc, r) => {
            acc.totalTickets = (acc.totalTickets || 0) + (Number(r.ticket_count) || 0);
            acc.totalGallons = (acc.totalGallons || 0) + (Number(r.total_gallons) || 0);
            acc.revenue = (acc.revenue || 0) + (Number(r.revenue) || 0);
            return acc;
          },
          { totalTickets: 0, totalGallons: 0, revenue: 0 }
        );

        const thisWeekTotalRevenue = (thisWeekService.completedRevenue || 0) + (thisWeekDelivery.revenue || 0);
        const lastWeekTotalRevenue = (lastWeekService.completedRevenue || 0) + (lastWeekDelivery.revenue || 0);

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
            scheduledJobs: thisWeekService.scheduledJobs || 0,
            scheduledRevenue: thisWeekService.scheduledRevenue || 0,
            lastWeekScheduledJobs: lastWeekService.scheduledJobs || 0,
            lastWeekScheduledRevenue: lastWeekService.scheduledRevenue || 0,
          },
          lastUpdated: new Date().toISOString(),
          debug: { usedView: true, viewRange: { start: thisWeekStart, end: thisWeekEnd } },
        };

        console.debug('[fetchMetricsClient] Billboard summary (view path):', {
          scheduledJobs: data.weekCompare.scheduledJobs,
          scheduledRevenue: data.weekCompare.scheduledRevenue,
        });

        return { data, error: null };
      }

      // If view query errors happened, fall back to per-table aggregator
      console.warn('[fetchMetricsClient] One or both view queries returned errors, falling back to table-level summary', { svcErr, delErr });
    } catch (err) {
      // Views may not exist in DB; fall back
      console.warn('[fetchMetricsClient] Error querying aggregate views, falling back to base table summaries', err);
    }

    // Fallback to the existing per-table aggregators
    const nowDate = new Date();
    const thisStart = getWeekStart(nowDate);
    const thisEnd = getWeekEnd(nowDate);

    const lastStart = new Date(thisStart);
    lastStart.setDate(lastStart.getDate() - 7);
    const lastEnd = new Date(thisEnd);
    lastEnd.setDate(lastEnd.getDate() - 7);

    const [
      thisWeekService,
      lastWeekService,
      thisWeekDelivery,
      lastWeekDelivery,
    ] = await Promise.all([
      fetchServiceTrackingSummary(thisStart, thisEnd),
      fetchServiceTrackingSummary(lastStart, lastEnd),
      fetchDeliveryTicketsSummary(thisStart, thisEnd),
      fetchDeliveryTicketsSummary(lastStart, lastEnd),
    ]);

    const thisWeekTotalRevenue = (thisWeekService.completedRevenue || 0) + (thisWeekDelivery.revenue || 0);
    const lastWeekTotalRevenue = (lastWeekService.completedRevenue || 0) + (lastWeekDelivery.revenue || 0);

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
        scheduledJobs: thisWeekService.scheduledJobs || 0,
        scheduledRevenue: thisWeekService.scheduledRevenue || 0,
        lastWeekScheduledJobs: lastWeekService.scheduledJobs || 0,
        lastWeekScheduledRevenue: lastWeekService.scheduledRevenue || 0,
      },
      lastUpdated: new Date().toISOString(),
      debug: { usedView: false, reason: 'fallback to per-table aggregators' },
    };

    console.debug('[fetchMetricsClient] Billboard summary (fallback path):', {
      scheduledJobs: data.weekCompare.scheduledJobs,
      scheduledRevenue: data.weekCompare.scheduledRevenue,
    });

    return { data, error: null };
  } catch (error) {
    console.error('[fetchMetricsClient] Error in getBillboardSummary:', error);
    return { data: MOCK_BILLBOARD_DATA, error: null };
  }
}

/**
 * Aggregate data from base table when view is not available
 * Matches the new simplified view structure with status filtering
 * @param {string} source - 'service' or 'delivery'
 * @param {string} granularity - 'day', 'week', or 'month'
 * @param {string} startStr - Start date string (YYYY-MM-DD)
 * @param {string} endStr - End date string (YYYY-MM-DD)
 * @returns {Promise<Object>} - { data, error }
 */
async function aggregateFromBaseTable(source, granularity, startStr, endStr) {
  try {
    const baseTable = source === 'service' ? 'service_jobs' : 'delivery_tickets';
    const dateField = source === 'service' ? 'job_date' : 'date';
    
    // Fetch raw data from base table
    const { data: rawData, error } = await supabase
      .from(baseTable)
      .select('*')
      .gte(dateField, startStr)
      .lte(dateField, endStr);

    if (error) {
      throw new Error(`Failed to fetch from ${baseTable}: ${error.message}`);
    }

    // Helper: derive Y-M-D string (YYYY-MM-DD) from various date representations
    function toYMD(value) {
      if (!value) return null;
      if (typeof value === 'string') {
        // prefer the YYYY-MM-DD portion if it's present
        return value.split('T')[0];
      }
      if (value instanceof Date) {
        // Use the date's year/month/day as local components but normalize via UTC construction
        const y = value.getFullYear();
        const m = value.getMonth() + 1;
        const d = value.getDate();
        // build a UTC date representing that Y-M-D, then format to YYYY-MM-DD
        return new Date(Date.UTC(y, m - 1, d)).toISOString().split('T')[0];
      }
      // fallback string conversion
      return String(value).split('T')[0];
    }

    // Helper: compute week_start (Monday) in YYYY-MM-DD based on a YMD string
    function computeWeekStartFromYMD(ymd) {
      const [yStr, mStr, dStr] = ymd.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const d = parseInt(dStr, 10);
      // create UTC date at midnight for consistency
      const utcDate = new Date(Date.UTC(y, m - 1, d));
      const day = utcDate.getUTCDay(); // 0 (Sun) .. 6 (Sat)
      // compute monday
      const diff = d - day + (day === 0 ? -6 : 1);
      const weekStartUtc = new Date(Date.UTC(y, m - 1, diff));
      return weekStartUtc.toISOString().split('T')[0];
    }

    // Helper: compute month_start (YYYY-MM-01)
    function computeMonthStartFromYMD(ymd) {
      const [yStr, mStr] = ymd.split('-');
      return `${yStr}-${mStr}-01`;
    }

    // Group and aggregate data based on granularity and source
    const aggregated = {};

    (rawData || []).forEach(row => {
      const dateValue = row[dateField];
      if (!dateValue) return;

      // derive canonical YYYY-MM-DD day string without timezone math
      const dayYMD = toYMD(dateValue);
      if (!dayYMD) return;

      let truncatedDate;
      if (granularity === 'day') {
        truncatedDate = dayYMD;
      } else if (granularity === 'week') {
        truncatedDate = computeWeekStartFromYMD(dayYMD);
      } else {
        // month
        truncatedDate = computeMonthStartFromYMD(dayYMD);
      }

      if (!aggregated[truncatedDate]) {
        if (source === 'service') {
          aggregated[truncatedDate] = {
            job_count: 0,
            revenue: 0,
          };
        } else {
          aggregated[truncatedDate] = {
            ticket_count: 0,
            total_gallons: 0,
            revenue: 0,
          };
        }
      }

      if (source === 'service') {
        const status = (row.status || '').toLowerCase();
        // Only include completed jobs, exclude canceled
        if (!status.includes('cancel') && status.includes('completed')) {
          const amount = parseFloat(row.job_amount) || 0;
          aggregated[truncatedDate].job_count += 1;
          aggregated[truncatedDate].revenue += amount;
        }
      } else {
        const status = (row.status || '').toLowerCase();
        // Exclude void and canceled tickets
        if (!status.includes('void') && !status.includes('cancel')) {
          aggregated[truncatedDate].ticket_count += 1;
          aggregated[truncatedDate].total_gallons += parseFloat(row.qty) || 0;
          aggregated[truncatedDate].revenue += parseFloat(row.amount) || 0;
        }
      }
    });

    // Convert to array with proper date column naming
    const dateColumnMap = {
      day: 'day',
      week: 'week_start',
      month: 'month_start',
    };
    const dateColumn = dateColumnMap[granularity];

    const result = Object.entries(aggregated).map(([date, metrics]) => ({
      [dateColumn]: date,
      ...metrics,
    })).sort((a, b) => a[dateColumn].localeCompare(b[dateColumn]));

    return { data: result, error: null };
  } catch (error) {
    console.error('[fetchMetricsClient] Error in aggregateFromBaseTable:', error);
    return { data: null, error: error.message };
  }
}

/**
 * Fetch data from view with fallback to base table aggregation
 * @param {string} viewName - Name of the view to query
 * @param {string} dateColumn - Date column name in the view
 * @param {string} startStr - Start date string
 * @param {string} endStr - End date string
 * @param {string} source - 'service' or 'delivery'
 * @param {string} granularity - 'day', 'week', or 'month'
 * @returns {Promise<Object>} - { data, error, debug, totals }
 */
async function fetchWithFallback(viewName, dateColumn, startStr, endStr, source, granularity) {
  // Try querying the view first
  const { data: viewData, error: viewError } = await supabase
    .from(viewName)
    .select('*')
    .gte(dateColumn, startStr)
    .lte(dateColumn, endStr)
    .order(dateColumn, { ascending: true });

  // Check if the error is due to missing view
  const isMissingView = viewError && (
    viewError.message?.includes('does not exist') ||
    viewError.message?.includes('relation') ||
    viewError.message?.includes('schema cache') ||
    viewError.code === '42P01' // Postgres error code for undefined table
  );

  if (viewError && !isMissingView) {
    // Unexpected error, not a missing view
    console.error('[fetchMetricsClient] Unexpected error querying view:', viewError);
    return { 
      data: null, 
      error: viewError.message,
      debug: { usedFallback: false, viewName, error: viewError.message },
      totals: null
    };
  }

  // Calculate totals from data
  const calculateTotals = (data) => {
    if (!data || data.length === 0) return null;
    
    const totals = {
      recordCount: data.length,
    };

    if (source === 'service') {
      totals.totalJobs = data.reduce((sum, row) => sum + (parseFloat(row.job_count) || 0), 0);
      totals.totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
    } else {
      totals.totalTickets = data.reduce((sum, row) => sum + (parseFloat(row.ticket_count) || 0), 0);
      totals.totalGallons = data.reduce((sum, row) => sum + (parseFloat(row.total_gallons) || 0), 0);
      totals.totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
    }

    return totals;
  };

  if (isMissingView) {
    // View is missing, use fallback
    console.warn(`[fetchMetricsClient] View '${viewName}' not found, falling back to base table aggregation`);
    const fallbackResult = await aggregateFromBaseTable(source, granularity, startStr, endStr);
    
    const totals = calculateTotals(fallbackResult.data);
    
    return {
      data: fallbackResult.data,
      error: fallbackResult.error,
      totals,
      debug: {
        usedFallback: true,
        viewName,
        reason: 'View not found in database schema',
        suggestion: 'Run migrations/001_create_metrics_views.sql in Supabase SQL Editor',
        totals
      }
    };
  }

  // View query succeeded
  const totals = calculateTotals(viewData);
  
  return {
    data: viewData || [],
    error: null,
    totals,
    debug: { usedFallback: false, viewName, totals }
  };
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
 * @returns {Promise<Object>} - { primary, comparison, error, debug, totals }
 */
export async function getMetricsTimeseries(options) {
  try {
    if (!supabase) {
      console.warn('[fetchMetricsClient] Supabase not configured, cannot fetch timeseries');
      return { 
        primary: [], 
        comparison: null, 
        error: 'Supabase not configured',
        debug: { usedFallback: false, error: 'No Supabase client' },
        totals: null
      };
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
      day: 'day',
      week: 'week_start',
      month: 'month_start',
    };
    const dateColumn = dateColumnMap[granularity];

    // Fetch primary period data with fallback
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const primaryResult = await fetchWithFallback(viewName, dateColumn, startStr, endStr, source, granularity);
    
    if (primaryResult.error) {
      console.error('[fetchMetricsClient] Error fetching primary data:', primaryResult.error);
      throw new Error(`Failed to fetch ${source} data: ${primaryResult.error}`);
    }

    // Fetch comparison data if requested
    let comparisonData = null;
    let comparisonDebug = null;
    let comparisonTotals = null;
    
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
        const comparisonResult = await fetchWithFallback(viewName, dateColumn, compStartStr, compEndStr, source, granularity);
        
        if (comparisonResult.error) {
          console.warn('[fetchMetricsClient] Error fetching comparison data:', comparisonResult.error);
        } else {
          comparisonData = comparisonResult.data;
          comparisonDebug = comparisonResult.debug;
          comparisonTotals = comparisonResult.totals;
        }
      }
    }

    return {
      primary: primaryResult.data || [],
      comparison: comparisonData,
      error: null,
      totals: {
        primary: primaryResult.totals,
        comparison: comparisonTotals,
      },
      debug: {
        primary: primaryResult.debug,
        comparison: comparisonDebug,
      },
    };
  } catch (error) {
    console.error('[fetchMetricsClient] Error in getMetricsTimeseries:', error);
    return {
      primary: [],
      comparison: null,
      error: error.message,
      totals: null,
      debug: { error: error.message },
    };
  }
}

export default { getBillboardSummary, getMetricsTimeseries };
