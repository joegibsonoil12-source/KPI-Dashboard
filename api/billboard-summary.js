// api/billboard-summary.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

function safeNum(v, decimals = 0) {
  const n = Number(v);
  if (!isFinite(n)) return decimals === 0 ? 0 : Number(0).toFixed(decimals);
  return decimals === 0 ? Math.round(n) : Number(n).toFixed(decimals);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceRole) {
    return res.status(200).json({
      deliveryTickets: { totalTickets: 0, totalGallons: 0, revenue: 0 },
      serviceTracking: { completed: 0, completedRevenue: 0, pipelineRevenue: 0 },
      weekCompare: { percentChange: 0 }
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false } });

    const deliverySql = `
      SELECT
        COUNT(*)::int as totalTickets,
        COALESCE(SUM(gallons),0) as totalGallons,
        COALESCE(SUM(amount),0) as revenue
      FROM delivery_tickets
      WHERE DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE)
    `;

    const { data: deliveryData, error: dErr } = await supabase.rpc('sql', { q: deliverySql }).catch(e => ({ data: null, error: e }));

    let delivery = { totalTickets: 0, totalGallons: 0, revenue: 0 };
    if (!dErr && deliveryData && deliveryData.length) {
      const row = deliveryData[0];
      delivery.totalTickets = Number(row.totaltickets || 0);
      delivery.totalGallons = Number(row.totalgallons || 0);
      delivery.revenue = Number(row.revenue || 0);
    }

    const serviceSql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END),0) as completedRevenue,
        COALESCE(SUM(CASE WHEN status = 'pipeline' THEN amount ELSE 0 END),0) as pipelineRevenue
      FROM service_tickets
      WHERE DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE)
    `;

    const { data: serviceData, error: sErr } = await supabase.rpc('sql', { q: serviceSql }).catch(e => ({ data: null, error: e }));
    let service = { completed: 0, completedRevenue: 0, pipelineRevenue: 0 };
    if (!sErr && serviceData && serviceData.length) {
      const row = serviceData[0];
      service.completed = Number(row.completed || 0);
      service.completedRevenue = Number(row.completedrevenue || 0);
      service.pipelineRevenue = Number(row.pipelinerrevenue || row.pipelinedrevenue || 0);
    }

    const weekSql = `
      SELECT
        COALESCE(SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE) THEN amount ELSE 0 END),0) as this_week,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('week', created_at) = DATE_TRUNC('week', CURRENT_DATE - interval '7 days') THEN amount ELSE 0 END),0) as last_week
      FROM (
        SELECT amount, created_at FROM delivery_tickets
        UNION ALL
        SELECT amount, created_at FROM service_tickets
      ) as unioned
    `;

    const { data: weekData, error: wErr } = await supabase.rpc('sql', { q: weekSql }).catch(e => ({ data: null, error: e }));
    let weekCompare = { percentChange: 0 };
    if (!wErr && weekData && weekData.length) {
      const r = weekData[0];
      const thisWeek = Number(r.this_week || 0);
      const lastWeek = Number(r.last_week || 0);
      const pct = lastWeek === 0 ? (thisWeek === 0 ? 0 : 100) : ((thisWeek - lastWeek) / lastWeek) * 100;
      weekCompare.percentChange = Number(pct.toFixed(1));
    }

    const response = {
      deliveryTickets: {
        totalTickets: safeNum(delivery.totalTickets || 0, 0),
        totalGallons: typeof delivery.totalGallons === 'number' ? Number(delivery.totalGallons.toFixed ? delivery.totalGallons.toFixed(1) : Number(delivery.totalGallons).toFixed(1)) : Number(safeNum(delivery.totalGallons || 0, 1)),
        revenue: typeof delivery.revenue === 'number' ? Number(delivery.revenue.toFixed ? delivery.revenue.toFixed(2) : Number(delivery.revenue).toFixed(2)) : Number(safeNum(delivery.revenue || 0, 2))
      },
      serviceTracking: {
        completed: safeNum(service.completed || 0, 0),
        completedRevenue: typeof service.completedRevenue === 'number' ? Number(service.completedRevenue.toFixed ? service.completedRevenue.toFixed(2) : Number(service.completedRevenue).toFixed(2)) : Number(safeNum(service.completedRevenue || 0, 2)),
        pipelineRevenue: typeof service.pipelineRevenue === 'number' ? Number(service.pipelineRevenue.toFixed ? service.pipelineRevenue.toFixed(2) : Number(service.pipelineRevenue).toFixed(2)) : Number(safeNum(service.pipelineRevenue || 0, 2))
      },
      weekCompare: { percentChange: Number(weekCompare.percentChange || 0) }
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('billboard-summary error', err);
    return res.status(200).json({
      deliveryTickets: { totalTickets: 0, totalGallons: 0, revenue: 0 },
      serviceTracking: { completed: 0, completedRevenue: 0, pipelineRevenue: 0 },
      weekCompare: { percentChange: 0 }
    });
  }
}
