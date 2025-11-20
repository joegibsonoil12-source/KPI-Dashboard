/**
 * netlify/functions/billboard-summary.js
 *
 * Resilient billboard aggregator:
 * - Uses service role if available (SUPABASE_SERVICE_ROLE_KEY), otherwise anon (best-effort)
 * - Always returns consistent JSON schema with safe defaults
 * - Aggregates service_jobs, delivery_tickets, cstore_gallons, dashboard_kpis
 */

const { createClient } = require('@supabase/supabase-js');

let cache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 15000;

function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0,0,0,0);
  return weekStart;
}
function getWeekEnd(date) {
  const s = getWeekStart(date);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}

function createSupabaseClient(preferService = true) {
  const url = process.env.SUPABASE_URL;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.SUPABASE_ANON_KEY;

  if (!url) throw new Error('Missing SUPABASE_URL');

  if (preferService && svc) return createClient(url, svc);
  if (svc) return createClient(url, svc);
  if (anon) {
    console.warn('[Billboard] Using anon key (best-effort).');
    return createClient(url, anon);
  }
  throw new Error('No Supabase key available (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)');
}

function emptyPayload() {
  return {
    serviceTracking: { completed:0, scheduled:0, deferred:0, completedRevenue:0, pipelineRevenue:0, scheduledJobs:0, scheduledRevenue:0 },
    deliveryTickets: { totalTickets:0, totalGallons:0, revenue:0 },
    weekCompare: { thisWeekTotalRevenue:0, lastWeekTotalRevenue:0, percentChange:0, scheduledJobs:0, scheduledRevenue:0, lastWeekScheduledJobs:0, lastWeekScheduledRevenue:0 },
    cStoreGallons: [],
    dashboardSquares: {},
    dashboardKpis: { current_tanks:0, customers_lost:0, customers_gained:0, tanks_set:0 },
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchServiceTrackingSummary(supabase, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('service_jobs')
      .select('status, job_amount, job_date')
      .gte('job_date', startDate.toISOString().slice(0,10))
      .lte('job_date', endDate.toISOString().slice(0,10));

    if (error) {
      console.error('[Billboard] service_jobs error', error);
      return { completed:0, scheduled:0, deferred:0, completedRevenue:0, pipelineRevenue:0, scheduledJobs:0, scheduledRevenue:0 };
    }

    const summary = { completed:0, scheduled:0, deferred:0, completedRevenue:0, pipelineRevenue:0, scheduledJobs:0, scheduledRevenue:0 };
    (data || []).forEach(r => {
      const amount = Number(r.job_amount) || 0;
      const status = (r.status || '').toLowerCase();
      if (status === 'completed') {
        summary.completed += 1; summary.completedRevenue += amount;
      } else if (['scheduled','assigned','confirmed','in_progress'].includes(status)) {
        summary.scheduled += 1; summary.pipelineRevenue += amount; summary.scheduledJobs += 1; summary.scheduledRevenue += amount;
      } else if (status === 'deferred') {
        summary.deferred += 1; summary.pipelineRevenue += amount;
      } else {
        summary.pipelineRevenue += amount;
      }
    });

    return summary;
  } catch (e) {
    console.error('[Billboard] fetchServiceTrackingSummary unexpected', e);
    return { completed:0, scheduled:0, deferred:0, completedRevenue:0, pipelineRevenue:0, scheduledJobs:0, scheduledRevenue:0 };
  }
}

async function fetchDeliveryTicketsSummary(supabase, startDate, endDate) {
  try {
    const { data, error } = await supabase
      .from('delivery_tickets')
      .select('qty, gallons_delivered, amount, date')
      .gte('date', startDate.toISOString().slice(0,10))
      .lte('date', endDate.toISOString().slice(0,10));

    if (error) { console.error('[Billboard] delivery_tickets error', error); return { totalTickets:0, totalGallons:0, revenue:0 }; }

    let totalTickets = 0, totalGallons = 0, revenue = 0;
    (data || []).forEach(t => {
      totalTickets += 1;
      totalGallons += Number(t.gallons_delivered != null ? t.gallons_delivered : t.qty || 0) || 0;
      revenue += Number(t.amount || 0) || 0;
    });
    return { totalTickets, totalGallons, revenue };
  } catch (e) {
    console.error('[Billboard] fetchDeliveryTicketsSummary unexpected', e);
    return { totalTickets:0, totalGallons:0, revenue:0 };
  }
}

async function fetchCStore(supabase) {
  try {
    const { data, error } = await supabase.from('cstore_gallons').select('store_id, week_ending, total_gallons');
    if (error) { console.error('[Billboard] cstore_gallons error', error); return []; }
    return (data || []).map(r => ({ storeId: r.store_id, weekEnding: r.week_ending, totalGallons: Number(r.total_gallons || 0) }));
  } catch (e) {
    console.error('[Billboard] fetchCStore unexpected', e);
    return [];
  }
}

async function fetchDashboardKpis(supabase) {
  try {
    const { data, error } = await supabase.from('dashboard_kpis').select('*').limit(1).single();
    if (error) { console.warn('[Billboard] dashboard_kpis warning', error); return { current_tanks:0, customers_lost:0, customers_gained:0, tanks_set:0 }; }
    return data || { current_tanks:0, customers_lost:0, customers_gained:0, tanks_set:0 };
  } catch (e) {
    console.warn('[Billboard] fetchDashboardKpis unexpected', e);
    return { current_tanks:0, customers_lost:0, customers_gained:0, tanks_set:0 };
  }
}

async function aggregateBillboardData() {
  try {
    const now = new Date();
    const thisWeekStart = getWeekStart(now);
    const thisWeekEnd = getWeekEnd(now);
    const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd); lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const supabase = createSupabaseClient(true);

    const [thisWeekService, lastWeekService, thisWeekDelivery, lastWeekDelivery, cStore, kpis] = await Promise.all([
      fetchServiceTrackingSummary(supabase, thisWeekStart, thisWeekEnd),
      fetchServiceTrackingSummary(supabase, lastWeekStart, lastWeekEnd),
      fetchDeliveryTicketsSummary(supabase, thisWeekStart, thisWeekEnd),
      fetchDeliveryTicketsSummary(supabase, lastWeekStart, lastWeekEnd),
      fetchCStore(supabase),
      fetchDashboardKpis(supabase),
    ]);

    const thisWeekTotalRevenue = (thisWeekService.completedRevenue || 0) + (thisWeekDelivery.revenue || 0);
    const lastWeekTotalRevenue = (lastWeekService.completedRevenue || 0) + (lastWeekDelivery.revenue || 0);
    const percentChange = lastWeekTotalRevenue === 0 ? (thisWeekTotalRevenue > 0 ? 100 : 0) : ((thisWeekTotalRevenue - lastWeekTotalRevenue)/lastWeekTotalRevenue)*100;

    const dashboardSquares = {
      totalGallonsAllStores: (cStore || []).reduce((s,r)=>s+(Number(r.totalGallons)||0),0),
      weeklyServiceRevenue: Number(thisWeekService.completedRevenue||0),
    };

    return {
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
      cStoreGallons: cStore,
      dashboardSquares,
      dashboardKpis: kpis,
      lastUpdated: new Date().toISOString()
    };
  } catch(e) {
    console.error('[Billboard] aggregate error', e);
    return emptyPayload();
  }
}

exports.handler = async function(event, context) {
  try {
    if (cache && cacheTimestamp && (Date.now()-cacheTimestamp) < CACHE_TTL_MS) {
      return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify(cache) };
    }
    const payload = await aggregateBillboardData();
    cache = payload; cacheTimestamp = Date.now();
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) };
  } catch(err) {
    console.error('[Billboard] handler fatal', err);
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify(emptyPayload()) };
  }
};
