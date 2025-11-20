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

// PostgreSQL error code for "no rows returned" - acceptable for optional data
const POSTGRES_NO_ROWS_ERROR = 'PGRST116';

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
 * Empty data for when schema is incomplete (e.g., missing is_estimate column)
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
  dashboardSquares: {
    totalGallonsAllStores: 0,
    weeklyServiceRevenue: 0,
  },
  dashboardKpis: {
    current_tanks: 0,
    customers_lost: 0,
    customers_gained: 0,
    tanks_set: 0,
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
 * Helper function to check if a status should be counted as scheduled
 * Includes: scheduled, assigned, confirmed, in_progress
 * @param {string} status - Job status (case-insensitive)
 * @returns {boolean} - True if status represents a scheduled job
 */
function isScheduledStatus(status) {
  const statusLower = String(status || '').toLowerCase();
  return statusLower === 'scheduled' || 
         statusLower === 'assigned' || 
         statusLower === 'confirmed' || 
         statusLower === 'in_progress';
}

/**
 * Helper function to extract gallons from a delivery ticket record
 * Prefers gallons_delivered field, falls back to qty if not available
 * @param {Object} record - Delivery ticket record
 * @returns {number} - Gallons value
 */
function getGallonsFromTicket(record) {
  // Prefer gallons_delivered if present, otherwise use qty
  if (record.gallons_delivered != null) {
    return Number(record.gallons_delivered) || 0;
  }
  return Number(record.qty) || 0;
}

/**
 * Get billboard summary (this week vs last week)
 * 
 * This function tries the serverless aggregator first, then falls back to direct aggregation
 * from service_jobs, delivery_tickets, cstore_gallons, and dashboard_kpis.
 * 
 * @returns {Promise<Object>} - { data, error } where data contains the billboard payload
 */
export async function getBillboardSummary() {
  // Prefer serverless aggregator (resilient, has service role)
  try {
    const resp = await fetch('/.netlify/functions/billboard-summary', { cache: 'no-store' });
    if (resp && resp.ok) {
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const payload = await resp.json();
        if (payload && (payload.serviceTracking || payload.deliveryTickets || payload.cStoreGallons)) {
          return { data: payload, error: null };
        } else {
          console.warn('[fetchMetricsClient] serverless payload missing expected keys, falling back', payload);
        }
      } else {
        console.warn('[fetchMetricsClient] serverless returned non-json:', ct);
      }
    } else {
      console.warn('[fetchMetricsClient] serverless aggregator error status:', resp && resp.status);
    }
  } catch (e) {
    console.warn('[fetchMetricsClient] serverless aggregator not reachable, falling back to direct aggregation:', e);
  }

  // Fallback: direct aggregation using Supabase client (browser). This builds the same payload shape.
  try {
    if (!supabase) {
      console.warn('[fetchMetricsClient] no supabase client configured - returning empty data');
      return { data: EMPTY_DATA, error: null };
    }

    // Use this week's Monday-Sunday range (keeps previous semantics)
    const now = new Date();
    const thisWeekStart = getWeekStart(now);
    const thisWeekEnd = getWeekEnd(now);

    // Helper to format date to YYYY-MM-DD
    const fmt = d => d.toISOString().slice(0, 10);

    // 1) Service jobs: pull status and job_amount for the week window, aggregate client-side
    let serviceRows = [];
    try {
      const { data, error } = await supabase
        .from('service_jobs')
        .select('status, job_amount, job_date')
        .gte('job_date', fmt(thisWeekStart))
        .lte('job_date', fmt(thisWeekEnd));

      if (error) {
        console.warn('[fetchMetricsClient] service_jobs query error (fallback):', error);
      } else {
        serviceRows = data || [];
      }
    } catch (e) {
      console.warn('[fetchMetricsClient] service_jobs fetch unexpected error:', e);
    }

    const serviceSummary = {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0
    };

    (serviceRows || []).forEach(r => {
      const amount = Number(r.job_amount || 0) || 0;
      const status = String(r.status || '').toLowerCase();
      if (status === 'completed') {
        serviceSummary.completed += 1;
        serviceSummary.completedRevenue += amount;
      } else if (isScheduledStatus(status)) {
        serviceSummary.scheduled += 1;
        serviceSummary.pipelineRevenue += amount;
        serviceSummary.scheduledJobs += 1;
        serviceSummary.scheduledRevenue += amount;
      } else if (status === 'deferred') {
        serviceSummary.deferred += 1;
        serviceSummary.pipelineRevenue += amount;
      } else {
        // treat unknown statuses as pipeline
        serviceSummary.pipelineRevenue += amount;
      }
    });

    // 2) Delivery tickets: pull tickets for the week and aggregate
    let deliveryRows = [];
    try {
      const { data, error } = await supabase
        .from('delivery_tickets')
        .select('qty, gallons_delivered, amount, date')
        .gte('date', fmt(thisWeekStart))
        .lte('date', fmt(thisWeekEnd));

      if (error) {
        console.warn('[fetchMetricsClient] delivery_tickets query error (fallback):', error);
      } else {
        deliveryRows = data || [];
      }
    } catch (e) {
      console.warn('[fetchMetricsClient] delivery_tickets fetch unexpected error:', e);
    }

    let deliverySummary = { totalTickets: 0, totalGallons: 0, revenue: 0 };
    (deliveryRows || []).forEach(r => {
      deliverySummary.totalTickets += 1;
      deliverySummary.totalGallons += getGallonsFromTicket(r);
      deliverySummary.revenue += Number(r.amount || 0) || 0;
    });

    // 3) C-Store totals (sum total_gallons across cstore_gallons)
    let cStoreList = [];
    try {
      const { data, error } = await supabase
        .from('cstore_gallons')
        .select('store_id, week_ending, total_gallons');
      if (error) {
        console.warn('[fetchMetricsClient] cstore_gallons query error (fallback):', error);
      } else {
        cStoreList = (data || []).map(r => ({ storeId: r.store_id, weekEnding: r.week_ending, totalGallons: Number(r.total_gallons || 0) }));
      }
    } catch (e) {
      console.warn('[fetchMetricsClient] cstore_gallons fetch unexpected error:', e);
    }

    // 4) Dashboard KPIs row (if present)
    let dashboardKpis = { current_tanks: 0, customers_lost: 0, customers_gained: 0, tanks_set: 0 };
    try {
      const { data, error } = await supabase.from('dashboard_kpis').select('*').limit(1);
      if (!error && data && data.length > 0) {
        dashboardKpis = data[0];
      } else if (error && error.code !== POSTGRES_NO_ROWS_ERROR) {
        // POSTGRES_NO_ROWS_ERROR = no rows returned, which is acceptable for optional data
        console.warn('[fetchMetricsClient] dashboard_kpis fetch warning:', error);
      }
    } catch (e) { console.warn('[fetchMetricsClient] dashboard_kpis fetch error:', e); }

    // compute weekCompare summary
    // compute last week by shifting date range
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    // last week summaries - use custom queries to handle gallons_delivered field
    let lastWeekService = { completed: 0, completedRevenue: 0, scheduledJobs: 0, scheduledRevenue: 0 };
    let lastWeekDelivery = { totalTickets: 0, totalGallons: 0, revenue: 0 };
    try {
      // Service jobs for last week
      const { data: sdata } = await supabase
        .from('service_jobs')
        .select('status, job_amount, job_date')
        .gte('job_date', fmt(lastWeekStart))
        .lte('job_date', fmt(lastWeekEnd));
      
      (sdata || []).forEach(r => {
        const amount = Number(r.job_amount || 0) || 0;
        const status = String(r.status || '').toLowerCase();
        // Use same status logic as current week for consistency
        if (status === 'completed') {
          lastWeekService.completed += 1;
          lastWeekService.completedRevenue += amount;
        } else if (isScheduledStatus(status)) {
          lastWeekService.scheduledJobs += 1;
          lastWeekService.scheduledRevenue += amount;
        }
        // Note: we don't track deferred/pipeline for lastWeek as it's only used for weekCompare
      });

      // Delivery tickets for last week
      const { data: ddata } = await supabase
        .from('delivery_tickets')
        .select('qty, gallons_delivered, amount, date')
        .gte('date', fmt(lastWeekStart))
        .lte('date', fmt(lastWeekEnd));
      
      (ddata || []).forEach(r => {
        lastWeekDelivery.totalTickets += 1;
        lastWeekDelivery.totalGallons += getGallonsFromTicket(r);
        lastWeekDelivery.revenue += Number(r.amount || 0) || 0;
      });
    } catch (e) {
      console.warn('[fetchMetricsClient] lastWeek aggregation error:', e);
    }

    const thisWeekTotalRevenue = (serviceSummary.completedRevenue || 0) + (deliverySummary.revenue || 0);
    const lastWeekTotalRevenue = (lastWeekService.completedRevenue || 0) + (lastWeekDelivery.revenue || 0);
    let percentChange = 0;
    if (lastWeekTotalRevenue === 0) percentChange = thisWeekTotalRevenue > 0 ? 100 : 0;
    else percentChange = ((thisWeekTotalRevenue - lastWeekTotalRevenue) / lastWeekTotalRevenue) * 100;

    // Compose final payload for UI
    const payload = {
      serviceTracking: serviceSummary,
      deliveryTickets: deliverySummary,
      weekCompare: {
        thisWeekTotalRevenue,
        lastWeekTotalRevenue,
        percentChange: parseFloat(percentChange.toFixed(1)),
        scheduledJobs: serviceSummary.scheduledJobs || 0,
        scheduledRevenue: serviceSummary.scheduledRevenue || 0,
        lastWeekScheduledJobs: lastWeekService.scheduledJobs || 0,
        lastWeekScheduledRevenue: lastWeekService.scheduledRevenue || 0,
      },
      cStoreGallons: cStoreList,
      dashboardSquares: {
        totalGallonsAllStores: (cStoreList || []).reduce((s, r) => s + (Number(r.totalGallons) || 0), 0),
        weeklyServiceRevenue: Number(serviceSummary.completedRevenue || 0),
      },
      dashboardKpis,
      lastUpdated: new Date().toISOString()
    };

    return { data: payload, error: null };
  } catch (err) {
    console.error('[fetchMetricsClient] direct aggregation failed:', err);
    return { data: EMPTY_DATA, error: null };
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
