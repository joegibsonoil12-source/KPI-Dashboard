import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import TimeSeriesChart from "../charts/TimeSeriesChart";
import DonutChart from "../charts/DonutChart";
import BarBreakdown from "../charts/BarBreakdown";
import DashboardControls from "../DashboardControls";
import CompanyHealthCard from "../CompanyHealthCard";
import { fetchDashboardKpis, upsertDashboardKpis } from '../../lib/dashboardKpis';
import { DASHBOARD_SQUARES } from '../../config/dashboardSquares';
import { getBillboardSummary } from '../../lib/fetchMetricsClient';

// Helper to detect empty/placeholder billboard payloads
function isEmptyBillboard(payload) {
  if (!payload) return true;
  
  // Quick heuristic: if key numeric metrics are all zero and cStore/dashboardKpis are empty, consider it empty
  const numericChecks = [
    Number(payload.serviceTracking?.completed || 0),
    Number(payload.serviceTracking?.completedRevenue || 0),
    Number(payload.deliveryTickets?.totalTickets || 0),
    Number(payload.deliveryTickets?.totalGallons || 0),
    Number(payload.deliveryTickets?.revenue || 0),
  ];
  
  const allZero = numericChecks.every(val => val === 0);
  const noCStoreData = !payload.cStoreGallons || payload.cStoreGallons.length === 0;
  const noKpiData = !payload.dashboardKpis || 
    (payload.dashboardKpis.current_tanks === 0 && 
     payload.dashboardKpis.customers_lost === 0 && 
     payload.dashboardKpis.customers_gained === 0 && 
     payload.dashboardKpis.tanks_set === 0);
  
  return allZero && noCStoreData && noKpiData;
}

function Card({ title, value, sub, right, style, children, trend = null, trendColor = "#16A34A" }) {
  return (
    <div style={{ 
      background: "white", 
      border: "1px solid #E5E7EB", 
      borderRadius: 12, 
      padding: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      transition: "box-shadow 0.2s",
      ...style 
    }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      {value !== undefined && (
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: "#111827" }}>{value}</div>
      )}
      {trend && (
        <div style={{ fontSize: 11, color: trendColor, marginTop: 4, fontWeight: 500 }}>
          {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
      {sub && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Section({ title, actions, children }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <div style={{ marginLeft: "auto" }}>{actions}</div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Sparkline({ data = [], height = 60, stroke = "#111827", fill = "rgba(17,24,39,0.08)" }) {
  const w = Math.max(100, Math.max(2, data.length) * 14);
  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const range = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * (w - 10) + 5;
    const y = height - ((v - min) / range) * (height - 10) - 5;
    return [x, y];
  });
  const path = pts.map(([x, y], i) => (i ? `L ${x} ${y}` : `M ${x} ${y}`)).join(" ");
  const area = pts.length ? `M ${pts[0][0]} ${height - 5} L ${pts.map(([x,y])=>`${x} ${y}`).join(" L ")} L ${pts[pts.length-1][0]} ${height - 5} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }}>
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function StackedBars({ categories = [], series = [], height = 160 }) {
  const barW = 24, gap = 14, w = Math.max(80, categories.length * (barW + gap) + 10);
  const totals = categories.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
  const max = Math.max(1, ...totals);
  const scaleY = (v) => (v / max) * (height - 20);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }}>
      {categories.map((cat, i) => {
        const x = 5 + i * (barW + gap);
        let y = height - 10;
        return (
          <g key={cat}>
            {series.map((s) => {
              const v = s.values[i] || 0;
              const h = scaleY(v);
              y -= h;
              return <rect key={s.name} x={x} y={y} width={barW} height={h} fill={s.color} rx="3" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}
function HBars({ rows = [] }) {
  const max = Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <div style={{ fontSize: 12, color: "#6B7280" }}>{r.label}</div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280" }}>${Math.round(r.value||0).toLocaleString()}</div>
          </div>
          <div style={{ height: 10, background: "#F3F4F6", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.round(((r.value||0)/max)*100)}%`, height: "100%", background: "#111827" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function toISO(d) { return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }

// KPI Editor Modal Component
function KpiEditor({ initial = {}, onClose = () => {}, onSave = null }) {
  const [vals, setVals] = useState({
    current_tanks: initial.current_tanks || 0,
    customers_lost: initial.customers_lost || 0,
    customers_gained: initial.customers_gained || 0,
    tanks_set: initial.tanks_set || 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Helper to safely parse number input
  const parseNumber = (value) => {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      if (onSave) await onSave(vals);
    } catch (error) {
      console.error('[KpiEditor] Save failed:', error);
      setSaveError(error.message || 'Failed to save KPIs. Please try again.');
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        padding: 24,
        maxWidth: 600,
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 700 }}>Edit Dashboard KPIs</h3>
        
        {saveError && (
          <div style={{
            padding: '8px 12px',
            marginBottom: 12,
            background: '#FEE2E2',
            color: '#991B1B',
            borderRadius: 8,
            fontSize: 12,
          }}>
            {saveError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Current Tanks</span>
            <input
              type="number"
              value={vals.current_tanks}
              onChange={e => setVals({ ...vals, current_tanks: parseNumber(e.target.value) })}
              min="0"
              step="1"
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Customers Lost</span>
            <input
              type="number"
              value={vals.customers_lost}
              onChange={e => setVals({ ...vals, customers_lost: parseNumber(e.target.value) })}
              min="0"
              step="1"
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Customers Gained</span>
            <input
              type="number"
              value={vals.customers_gained}
              onChange={e => setVals({ ...vals, customers_gained: parseNumber(e.target.value) })}
              min="0"
              step="1"
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>Tanks Set</span>
            <input
              type="number"
              value={vals.tanks_set}
              onChange={e => setVals({ ...vals, tanks_set: parseNumber(e.target.value) })}
              min="0"
              step="1"
              style={{
                padding: '8px 12px',
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </label>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: 'white',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 8,
              background: '#0B6E99',
              color: 'white',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Normalize status values to standard set: completed, scheduled, in_progress, canceled
function normalizeStatus(status) {
  if (!status) return "scheduled"; // default for empty status
  const s = String(status).toLowerCase().trim();
  
  // Completed variations
  if (s.includes("complete") || s.includes("done") || s.includes("finish")) {
    return "completed";
  }
  
  // Canceled/Cancelled variations
  if (s.includes("cancel") || s.includes("void")) {
    return "canceled";
  }
  
  // In Progress variations
  if (s.includes("progress") || s.includes("active") || s.includes("ongoing") || s.includes("started")) {
    return "in_progress";
  }
  
  // Scheduled variations
  if (s.includes("schedule") || s.includes("pending") || s.includes("upcoming")) {
    return "scheduled";
  }
  
  // Default: treat unknown statuses as scheduled
  return "scheduled";
}

function rangePreset(preset) {
  const now = new Date();
  if (preset === "today") { return {from: toISO(now), to: toISO(now), label:"Today"}; }
  if (preset === "7d") { const from = new Date(); from.setDate(now.getDate()-6); return {from: toISO(from), to: toISO(now), label:"Last 7 days"}; }
  if (preset === "30d") { const from = new Date(); from.setDate(now.getDate()-29); return {from: toISO(from), to: toISO(now), label:"Last 30 days"}; }
  if (preset === "mtd") { const from = new Date(now.getFullYear(), now.getMonth(), 1); return {from: toISO(from), to: toISO(now), label:"This month"}; }
  if (preset === "ytd") { const from = new Date(now.getFullYear(), 0, 1); return {from: toISO(from), to: toISO(now), label:"Year to date"}; }
  return rangePreset("30d");
}
function parseTicketDate(row) {
  const v = row?.date || row?.scheduled_window_start || row?.created_at;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(+d) ? null : d;
}

// NEW: helpers for delivery grouping
function toISODate(d) { return d.toISOString().slice(0,10); }
function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2,"0")}`;
}
function bucketKey(d, group) {
  if (group === "day") return toISODate(d); // YYYY-MM-DD
  if (group === "week") return isoWeekNumber(d); // YYYY-Www
  if (group === "month") return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; // YYYY-MM
  if (group === "year") return String(d.getFullYear()); // YYYY
  return toISODate(d);
}
function fmtKeyLabel(key, group) {
  if (group === "day") return key;
  if (group === "week") {
    const [y, w] = key.split("-W");
    return `W${w} ${y}`;
  }
  if (group === "month") return key; // YYYY-MM
  if (group === "year") return key;  // YYYY
  return key;
}

export default function ExecutiveDashboard() {
  const [preset, setPreset] = useState("30d");
  const [fromTo, setFromTo] = useState(rangePreset("30d"));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [serviceDaily, setServiceDaily] = useState([]);
  const [serviceTechs, setServiceTechs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [deliveryDaily, setDeliveryDaily] = useState([]);
  const [truckData, setTruckData] = useState([]);
  const [productData, setProductData] = useState([]);
  // NEW: grouping for deliveries chart
  const [delivGroup, setDelivGroup] = useState("day"); // 'day' | 'week' | 'month' | 'year'
  // KPI editor state
  const [dashboardKpis, setDashboardKpis] = useState(null);
  const [kpiEditorOpen, setKpiEditorOpen] = useState(false);
  // C-Store gallons data
  const [cStoreGallons, setCStoreGallons] = useState([]);
  // Billboard data state (serverless aggregator)
  const [billboardData, setBillboardData] = useState(null);
  const [loadingBillboard, setLoadingBillboard] = useState(true);

  useEffect(() => { setFromTo(rangePreset(preset)); }, [preset]);

  // Helper to load dashboard KPIs as fallback
  const loadKpisAsFallback = async () => {
    try {
      const k = await fetchDashboardKpis();
      setDashboardKpis(k);
    } catch (e) {
      console.warn('[ExecutiveDashboard] fallback dashboard kpis load failed', e);
    }
  };

  // Load billboard summary from serverless aggregator on mount
  useEffect(() => {
    let mounted = true;
    async function loadBillboard() {
      setLoadingBillboard(true);
      try {
        // 1) Prefer serverless aggregator via fetchMetricsClient
        const { data: payload, error } = await getBillboardSummary();
        
        // Check if payload is empty/placeholder
        if (payload && !error && !isEmptyBillboard(payload) && mounted) {
          // Store the billboard payload
          setBillboardData(payload);
          
          // Update dashboard KPIs if present in payload
          if (payload.dashboardKpis) {
            setDashboardKpis(payload.dashboardKpis);
          }
          
          // Update c-store gallons if present
          if (payload.cStoreGallons) {
            setCStoreGallons(payload.cStoreGallons);
          }
          
          console.log('[ExecutiveDashboard] Billboard data loaded successfully', {
            serviceRevenue: payload.serviceTracking?.completedRevenue,
            deliveryRevenue: payload.deliveryTickets?.revenue,
            cStoreCount: payload.cStoreGallons?.length,
          });
        } else if (payload && !error && isEmptyBillboard(payload)) {
          // Billboard payload present but empty — force Supabase fallback
          console.warn('[ExecutiveDashboard] Billboard payload present but empty — forcing Supabase fallback');
          
          // Try the server-side API endpoint as fallback (uses service role for better permissions)
          try {
            const fallbackResp = await fetch('/api/billboard-summary', { cache: 'no-store' });
            if (fallbackResp.ok) {
              const fallbackPayload = await fallbackResp.json();
              
              if (fallbackPayload && !isEmptyBillboard(fallbackPayload) && mounted) {
                console.log('[ExecutiveDashboard] Billboard loaded via Supabase fallback API');
                setBillboardData(fallbackPayload);
                
                if (fallbackPayload.dashboardKpis) {
                  setDashboardKpis(fallbackPayload.dashboardKpis);
                }
                
                if (fallbackPayload.cStoreGallons) {
                  setCStoreGallons(fallbackPayload.cStoreGallons);
                }
              } else {
                // Fallback API also returned empty, load KPIs directly
                console.warn('[ExecutiveDashboard] Supabase fallback API also returned empty, loading KPIs only');
                if (mounted) await loadKpisAsFallback();
              }
            } else {
              // Fallback API failed, load KPIs directly
              console.warn('[ExecutiveDashboard] Supabase fallback API failed, loading KPIs only');
              if (mounted) await loadKpisAsFallback();
            }
          } catch (e) {
            console.warn('[ExecutiveDashboard] Error calling Supabase fallback API:', e);
            // Last resort: Load KPIs directly
            if (mounted) await loadKpisAsFallback();
          }
        } else {
          console.warn('[ExecutiveDashboard] getBillboardSummary returned error or empty payload', error);
          // Fallback: Load KPIs directly if billboard fails
          try {
            const k = await fetchDashboardKpis();
            if (mounted) setDashboardKpis(k);
          } catch (e) {
            console.warn('[ExecutiveDashboard] fallback dashboard kpis load failed', e);
          }
        }
      } catch (e) {
        console.warn('[ExecutiveDashboard] Error loading billboard data:', e);
        // Fallback: Load KPIs directly
        try {
          const k = await fetchDashboardKpis();
          if (mounted) setDashboardKpis(k);
        } catch (fallbackError) {
          console.warn('[ExecutiveDashboard] fallback dashboard kpis load failed', fallbackError);
        }
      } finally {
        if (mounted) setLoadingBillboard(false);
      }
    }

    loadBillboard();
    return () => { mounted = false; };
  }, []); // Run once on mount

  // Load dashboard KPIs on mount (fallback if billboard doesn't provide them)
  useEffect(() => {
    // Skip if we already have KPIs from billboard
    if (dashboardKpis !== null) return;
    
    async function loadKpis() {
      try {
        const k = await fetchDashboardKpis();
        setDashboardKpis(k);
      } catch (e) {
        console.warn('[ExecutiveDashboard] failed to load dashboard kpis', e);
      }
    }
    loadKpis();
  }, [dashboardKpis]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { from, to } = fromTo;
        
        // Fetch service jobs data from aggregated views for better performance
        // Note: For now, we still use raw service_jobs for status breakdown
        // TODO: Create service_jobs_daily_by_status view for complete optimization
        const { data: d1, error: e1 } = await supabase
          .from("service_jobs")
          .select("job_date,status,job_amount,is_estimate,open_value,won_value,lost_value")
          .gte("job_date", from)
          .lte("job_date", to)
          .order("job_date", { ascending: true });
        if (e1) {
          console.error('Failed to load service jobs:', e1);
          // Don't throw - show graceful error
          if (e1.message?.includes('permission') || e1.message?.includes('policy')) {
            setErr('Data unavailable — check Supabase permissions for service_jobs table');
          } else {
            throw e1;
          }
        }

        const { data: d2, error: e2 } = await supabase
          .from("service_job_techs")
          .select("tech_name, job_amount, job_date")
          .gte("job_date", from)
          .lte("job_date", to);
        if (e2) {
          console.error('Failed to load service job techs:', e2);
          // Non-fatal, continue without tech data
        }

        // Fetch delivery tickets with all needed fields for status grouping
        // Keep this minimal - only fetch what we need for charts
        const { data: d3, error: e3 } = await supabase
          .from("delivery_tickets")
          .select("date, scheduled_window_start, created_at, amount, gallons_delivered, qty, status, truck, product, miles_driven")
          .gte("date", from)
          .lte("date", to)
          .limit(5000);
        if (e3) {
          console.error('Failed to load delivery tickets:', e3);
          if (e3.message?.includes('permission') || e3.message?.includes('policy')) {
            setErr('Data unavailable — check Supabase permissions for delivery_tickets table');
          } else {
            throw e3;
          }
        }

        // Fetch aggregated delivery data from view
        const { data: d4, error: e4 } = await supabase
          .from("delivery_tickets_daily")
          .select("day, ticket_count, total_gallons, revenue")
          .gte("day", from)
          .lte("day", to)
          .order("day", { ascending: true });
        if (e4) {
          console.error('Failed to load delivery_tickets_daily view:', e4);
          if (e4.message?.includes('permission') || e4.message?.includes('policy')) {
            setErr('Data unavailable — check Supabase permissions. Run SQL grants for delivery_tickets_daily view');
          } else {
            throw e4;
          }
        }

        // Fetch per-truck aggregated data from new view
        const { data: d5, error: e5 } = await supabase
          .from("delivery_tickets_per_truck")
          .select("truck, ticket_count, total_gallons, revenue")
          .order("revenue", { ascending: false })
          .limit(10);
        if (e5) {
          console.warn('Failed to load per-truck view, falling back to client-side aggregation:', e5);
          // Non-fatal - will compute client-side if view not available
        }

        // Fetch per-product aggregated data from new view
        const { data: d6, error: e6 } = await supabase
          .from("delivery_tickets_per_product")
          .select("product, ticket_count, total_gallons, revenue")
          .order("revenue", { ascending: false });
        if (e6) {
          console.warn('Failed to load per-product view, falling back to client-side aggregation:', e6);
          // Non-fatal - will compute client-side if view not available
        }

        // Fetch C-Store gallons data
        const { data: d7, error: e7 } = await supabase
          .from('cstore_gallons')
          .select('store_id, sheet_name, week_ending, total_gallons')
          .order('store_id', { ascending: true });
        if (e7) {
          console.warn('Failed to load c-store gallons:', e7);
          // Non-fatal - dashboard will still work without c-store data
        }

        if (!mounted) return;
        
        // Filter tickets by date range (only used if we didn't get view data)
        const fromD = new Date(from + "T00:00:00");
        const toD = new Date(to + "T23:59:59");
        const tFiltered = (Array.isArray(d3) ? d3 : []).filter((r) => {
          const d = parseTicketDate(r);
          return d && d >= fromD && d <= toD;
        });

        // Use per-truck view data if available, otherwise compute client-side
        let trucks = [];
        if (d5 && Array.isArray(d5) && d5.length > 0) {
          // Use aggregated view data (preferred)
          trucks = d5.map(t => ({
            truck: t.truck,
            gallons: Number(t.total_gallons) || 0,
            revenue: Number(t.revenue) || 0,
            count: Number(t.ticket_count) || 0
          }));
        } else {
          // Fallback: Calculate per-truck totals client-side
          const truckMap = new Map();
          tFiltered.forEach((t) => {
            const truck = t.truck || "Unknown";
            if (!truckMap.has(truck)) {
              truckMap.set(truck, { gallons: 0, revenue: 0, count: 0 });
            }
            const data = truckMap.get(truck);
            data.gallons += Number(t.gallons_delivered ?? t.qty) || 0;
            data.revenue += Number(t.amount) || 0;
            data.count += 1;
          });
          trucks = Array.from(truckMap.entries())
            .map(([truck, data]) => ({ truck, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
        }

        // Use per-product view data if available, otherwise compute client-side
        let products = [];
        if (d6 && Array.isArray(d6) && d6.length > 0) {
          // Use aggregated view data (preferred)
          products = d6.map(p => ({
            product: p.product,
            gallons: Number(p.total_gallons) || 0,
            revenue: Number(p.revenue) || 0,
            count: Number(p.ticket_count) || 0
          }));
        } else {
          // Fallback: Calculate per-product totals client-side
          const productMap = new Map();
          tFiltered.forEach((t) => {
            const product = t.product || "Unknown";
            if (!productMap.has(product)) {
              productMap.set(product, { gallons: 0, revenue: 0, count: 0 });
            }
            const data = productMap.get(product);
            data.gallons += Number(t.gallons_delivered ?? t.qty) || 0;
            data.revenue += Number(t.amount) || 0;
            data.count += 1;
          });
          products = Array.from(productMap.entries())
            .map(([product, data]) => ({ product, ...data }))
            .sort((a, b) => b.revenue - a.revenue);
        }

        setServiceDaily(Array.isArray(d1) ? d1 : []);
        setServiceTechs(Array.isArray(d2) ? d2 : []);
        setTickets(tFiltered);
        setDeliveryDaily(Array.isArray(d4) ? d4 : []);
        setTruckData(trucks);
        setProductData(products);
        setCStoreGallons(Array.isArray(d7) ? d7 : []);
      } catch (e) {
        console.error('Dashboard load error:', e);
        setErr(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [fromTo]);

  const agg = useMemo(() => {
    const dayKey = (s) => (s ? String(s).slice(0,10) : "");

    // Service aggregations (daily)
    const serviceDays = Array.from(new Set(serviceDaily.map((r) => dayKey(r.job_date)))).sort();
    const S = ["completed", "scheduled", "in_progress", "canceled"];
    const mapService = new Map();
    const addS = (day, status, cnt, rev, due) => {
      if (!mapService.has(day)) mapService.set(day, new Map());
      const st = mapService.get(day);
      const cur = st.get(status) || { count: 0, revenue: 0, due: 0 };
      st.set(status, { count: cur.count + (cnt||0), revenue: cur.revenue + (rev||0), due: cur.due + (due||0) });
    };
    // Each row is a single job, so count=1 and use job_amount (not total_revenue)
    serviceDaily.forEach((r) => {
      const normalizedStatus = normalizeStatus(r.status);
      addS(dayKey(r.job_date), normalizedStatus, 1, Number(r.job_amount||0), 0);
    });
    const serviceCompletedRevenueByDay = serviceDays.map((d) => mapService.get(d)?.get("completed")?.revenue || 0);
    const serviceSeriesStatus = [
      { name: "Completed", key: "completed", color: "#16A34A" },
      { name: "Scheduled", key: "scheduled", color: "#4338CA" },
      { name: "In Progress", key: "in_progress", color: "#F59E0B" },
      { name: "Canceled", key: "canceled", color: "#DC2626" },
    ].map((s) => ({ name: s.name, color: s.color, values: serviceDays.map((d)=> mapService.get(d)?.get(s.key)?.count || 0) }));

    const svcCompletedRevenue = serviceDaily.filter(r=>normalizeStatus(r.status)==="completed").reduce((a,b)=>a+Number(b.job_amount||0),0);
    const svcPipelineRevenue = ["scheduled","in_progress"].reduce((sum, st) => (
      sum + serviceDaily.filter(r=>normalizeStatus(r.status)===st).reduce((a,b)=>a+Number(b.job_amount||0),0)
    ), 0);
    const svcCounts = {
      completed: serviceDaily.filter(r=>normalizeStatus(r.status)==="completed").length,
      scheduled: serviceDaily.filter(r=>normalizeStatus(r.status)==="scheduled").length,
      inProgress: serviceDaily.filter(r=>normalizeStatus(r.status)==="in_progress").length,
      canceled: serviceDaily.filter(r=>normalizeStatus(r.status)==="canceled").length,
    };

    // Deliveries — for combined daily revenue (unchanged day basis)
    const ticketsDays = Array.from(new Set(tickets.map((t) => {
      const d = parseTicketDate(t); return d ? d.toISOString().slice(0,10) : null;
    }).filter(Boolean))).sort();
    const byDayTickets = new Map();
    const addT = (day, amount, status) => {
      if (!byDayTickets.has(day)) byDayTickets.set(day, { amount: 0, statusCounts: {} });
      const o = byDayTickets.get(day);
      o.amount += Number(amount||0);
      const k = String(status||"{}").toLowerCase();
      o.statusCounts[k] = (o.statusCounts[k]||0) + 1;
    };
    tickets.forEach((t) => {
      const d = parseTicketDate(t); if (!d) return;
      const day = d.toISOString().slice(0,10);
      addT(day, t.amount, t.status);
    });
    const deliveriesRevenueByDay = ticketsDays.map((d) => byDayTickets.get(d)?.amount || 0);

    // Deliveries — NEW grouped buckets for the chart (day/week/month/year)
    const ticketMap = new Map(); // key -> { amount, statusCounts }
    const keysOrder = [];
    tickets.forEach((t) => {
      const d = parseTicketDate(t); if (!d) return;
      const k = bucketKey(d, delivGroup);
      if (!ticketMap.has(k)) { ticketMap.set(k, { amount: 0, statusCounts: {} }); keysOrder.push(k); }
      const o = ticketMap.get(k);
      o.amount += Number(t.amount || 0);
      const st = String(t.status || "{}").toLowerCase();
      o.statusCounts[st] = (o.statusCounts[st] || 0) + 1;
    });
    const ticketsBuckets = keysOrder.sort();
    const deliveriesSeriesStatus = [
      { name: "Delivered", key: "delivered", color: "#16A34A" },
      { name: "Scheduled", key: "scheduled", color: "#4338CA" },
      { name: "Issues", key: "issue", color: "#DC2626" },
    ].map((s) => ({ name: s.name, color: s.color, values: ticketsBuckets.map((k)=> ticketMap.get(k)?.statusCounts[s.key] || 0) }));

    const deliveriesTotals = {
      tickets: tickets.length,
      gallons: tickets.reduce((a,b)=> a + (Number(b.gallons_delivered ?? b.qty) || 0), 0),
      revenue: tickets.reduce((a,b)=> a + (Number(b.amount) || 0), 0),
    };
    const deliveriesAvgPrice = deliveriesTotals.gallons > 0 ? deliveriesTotals.revenue / deliveriesTotals.gallons : 0;

    // Calculate average miles per stop for delivered tickets
    const deliveredTickets = tickets.filter(t => String(t.status || "").toLowerCase() === "delivered");
    const totalMiles = deliveredTickets.reduce((a, b) => a + (Number(b.miles_driven) || 0), 0);
    const deliveredStops = deliveredTickets.length;
    const avgMilesPerStop = deliveredStops > 0 ? totalMiles / deliveredStops : 0;

    // Combined revenue trend (service completed + delivery amounts) on daily axis
    const allDays = Array.from(new Set([...serviceDays, ...ticketsDays])).sort();
    const mapSvcRev = new Map(serviceDays.map((d,i)=>[d, serviceCompletedRevenueByDay[i] || 0]));
    const mapDelRev = new Map(ticketsDays.map((d,i)=>[d, deliveriesRevenueByDay[i] || 0]));
    const combinedRevenueByDay = allDays.map((d)=> (mapSvcRev.get(d)||0) + (mapDelRev.get(d)||0));

    // Top techs by service revenue (unchanged)
    const techSums = new Map();
    serviceTechs.forEach((t)=> {
      const key = (t.tech_name || "").trim() || "Unassigned";
      techSums.set(key, (techSums.get(key)||0) + Number(t.job_amount||0));
    });
    const topTechs = Array.from(techSums.entries())
      .map(([label, value])=>({ label, value }))
      .sort((a,b)=>b.value-a.value)
      .slice(0,7);

    // Estimate aggregations
    const estimates = serviceDaily.filter(r => r.is_estimate);
    const estimatesCount = estimates.length;
    const estimatesOpenValue = estimates.reduce((a, b) => a + (Number(b.open_value) || 0), 0);
    const estimatesWonValue = estimates.reduce((a, b) => a + (Number(b.won_value) || 0), 0);
    const estimatesLostValue = estimates.reduce((a, b) => a + (Number(b.lost_value) || 0), 0);
    
    // Tank metrics (placeholder - will be 0 until tank tracking is implemented)
    const currentTanks = dashboardKpis?.current_tanks || 0;
    const customersLost = dashboardKpis?.customers_lost || 0;
    const customersGained = dashboardKpis?.customers_gained || 0;
    const tanksSet = dashboardKpis?.tanks_set || 0;

    return {
      serviceDays, serviceCompletedRevenueByDay, serviceSeriesStatus,
      svcCompletedRevenue, svcPipelineRevenue, svcCounts,
      ticketsDays, deliveriesRevenueByDay, // kept for combined chart
      ticketsBuckets, deliveriesSeriesStatus, // used by grouped delivery chart
      deliveriesTotals, deliveriesAvgPrice,
      avgMilesPerStop, totalMiles, deliveredStops, // miles per stop metrics
      allDays, combinedRevenueByDay, topTechs,
      // Estimate metrics
      estimatesCount, estimatesOpenValue, estimatesWonValue, estimatesLostValue,
      // Tank metrics
      currentTanks, customersLost, customersGained, tanksSet,
    };
  }, [serviceDaily, serviceTechs, tickets, delivGroup, dashboardKpis]);

  const usd = (n) => "$" + Math.round(n||0).toLocaleString();
  const num = (n) => (n||0).toLocaleString();
  const grandRevenue = (agg.svcCompletedRevenue || 0) + (agg.deliveriesTotals?.revenue || 0);

  // Prepare data for DASHBOARD_SQUARES
  // Prefer billboard data (serverless aggregator) if available, otherwise use aggregated data
  const dashboardSquaresData = useMemo(() => {
    // Use billboard data if available (serverless aggregator provides this week's data)
    if (billboardData) {
      return {
        cStoreGallons: billboardData.cStoreGallons || [],
        serviceTracking: billboardData.serviceTracking || { completedRevenue: 0 },
        dashboardKpis: billboardData.dashboardKpis || {
          current_tanks: 0,
          customers_lost: 0,
          customers_gained: 0,
          tanks_set: 0,
        },
      };
    }
    
    // Fallback to aggregated data from date range queries
    return {
      cStoreGallons: cStoreGallons.map(r => ({ 
        storeId: r.store_id, 
        weekEnding: r.week_ending, 
        totalGallons: Number(r.total_gallons || 0),
        total_gallons: Number(r.total_gallons || 0) // support both formats
      })),
      serviceTracking: {
        completedRevenue: agg.svcCompletedRevenue || 0,
      },
      dashboardKpis: dashboardKpis || {
        current_tanks: 0,
        customers_lost: 0,
        customers_gained: 0,
        tanks_set: 0,
      },
    };
  }, [billboardData, cStoreGallons, agg.svcCompletedRevenue, dashboardKpis]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Date Range Controls */}
      <DashboardControls
        preset={preset}
        onPresetChange={setPreset}
        fromDate={fromTo.from}
        toDate={fromTo.to}
        onDateChange={(from, to) => setFromTo({ from, to, label: "Custom range" })}
        showCustomDates={false}
      />

      {err && <div style={{ color:"#b91c1c", fontSize:12, marginBottom:8, padding: 12, background: "#FEE2E2", borderRadius: 8 }}>{err}</div>}

      {/* Dashboard Squares - Configurable KPI tiles */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#6B7280' }}>Key Performance Indicators</h3>
          <button
            onClick={() => setKpiEditorOpen(true)}
            style={{
              padding: '6px 12px',
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: '#0B6E99',
            }}
          >
            Edit KPIs
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
          {DASHBOARD_SQUARES.map(square => {
            const raw = square.compute(dashboardSquaresData);
            const display = (() => {
              switch (square.format) {
                case 'currency':
                  return `$${Number(raw || 0).toLocaleString()}`;
                case 'gallons':
                  return `${Number(raw || 0).toLocaleString()} gal`;
                default:
                  return Number(raw || 0).toLocaleString();
              }
            })();
            return (
              <Card key={square.key} title={square.label} value={display} />
            );
          })}
        </div>
      </div>

      {/* KPI Cards with Professional Styling */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
        <Card 
          title="Total Revenue" 
          value={usd(grandRevenue)} 
          sub="Service + Deliveries"
          style={{ background: "linear-gradient(135deg, #0B6E99 0%, #00A99D 100%)", color: "white", border: "none" }}
        >
          <div style={{ marginTop: 8 }}>
            <Sparkline data={agg.combinedRevenueByDay || []} height={40} stroke="rgba(255,255,255,0.8)" fill="rgba(255,255,255,0.2)" />
          </div>
        </Card>
        
        <Card title="Service Revenue" value={usd(agg.svcCompletedRevenue)} sub="Completed jobs">
          <div style={{ marginTop: 8 }}>
            <Sparkline data={agg.serviceCompletedRevenueByDay || []} height={40} stroke="#00A99D" fill="rgba(0,169,157,0.1)" />
          </div>
        </Card>
        
        <Card title="Delivery Revenue" value={usd(agg.deliveriesTotals?.revenue)} sub={`${num(agg.deliveriesTotals?.tickets)} tickets`}>
          <div style={{ marginTop: 8 }}>
            <Sparkline data={agg.deliveriesRevenueByDay || []} height={40} stroke="#F5A623" fill="rgba(245,166,35,0.1)" />
          </div>
        </Card>
        
        <Card title="Delivery Gallons" value={num(agg.deliveriesTotals?.gallons)} sub={`Avg $${(agg.deliveriesAvgPrice||0).toFixed(2)}/gal`} />
        
        <Card title="Service Jobs" value={num(agg.svcCounts?.completed)} sub="Completed" />
        
        <Card 
          title="Avg Miles per Stop" 
          value={(agg.avgMilesPerStop || 0).toFixed(1)} 
          sub={`${num(Math.round(agg.totalMiles || 0))} miles / ${num(agg.deliveredStops || 0)} stops`} 
        />
        
        {/* Company Health Score Card */}
        <CompanyHealthCard />
      </div>

      {/* Estimate KPIs Row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16, marginTop:16 }}>
        <Card 
          title="Open Estimates" 
          value={usd(agg.estimatesOpenValue)} 
          sub={`${num(agg.estimatesCount)} total estimates`}
          style={{ background: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)", color: "white", border: "none" }}
        />
        
        <Card 
          title="Won Estimates" 
          value={usd(agg.estimatesWonValue)} 
          sub="Converted to jobs"
          style={{ background: "linear-gradient(135deg, #16A34A 0%, #059669 100%)", color: "white", border: "none" }}
        />
        
        <Card 
          title="Lost Estimates" 
          value={usd(agg.estimatesLostValue)} 
          sub="Not converted"
          style={{ background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)", color: "white", border: "none" }}
        />
      </div>

      {/* Main Charts Row */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Section title="Combined Revenue Trend (Daily)">
          <Card>
            <TimeSeriesChart
              data={agg.combinedRevenueByDay || []}
              categories={agg.allDays || []}
              title="Revenue"
              height={280}
              type="area"
              color="#0B6E99"
              yAxisFormatter={(val) => "$" + Math.round(val).toLocaleString()}
            />
          </Card>
        </Section>
        
        <Section title="Top Technicians">
          <Card>
            <HBars rows={agg.topTechs || []} />
          </Card>
        </Section>
      </div>

      {/* Service and Delivery Charts */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Section title="Service Jobs by Status">
          <Card>
            <BarBreakdown
              categories={agg.serviceDays.slice(-30) || []}
              series={agg.serviceSeriesStatus.map(s => ({
                name: s.name,
                data: s.values.slice(-30)
              }))}
              height={280}
              stacked={true}
              colors={['#16A34A', '#4338CA', '#F59E0B', '#DC2626']}
              yAxisFormatter={(val) => Math.round(val).toString()}
            />
          </Card>
        </Section>

        <Section
          title="Delivery Tickets by Status"
          actions={
            <select
              value={delivGroup}
              onChange={(e)=>setDelivGroup(e.target.value)}
              style={{ padding:"6px 10px", border:"1px solid #E5E7EB", borderRadius:8, fontSize: 12 }}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          }
        >
          <Card>
            <BarBreakdown
              categories={agg.ticketsBuckets.map(k=>fmtKeyLabel(k, delivGroup)).slice(-30)}
              series={agg.deliveriesSeriesStatus.map(s => ({
                name: s.name,
                data: s.values.slice(-30)
              }))}
              height={280}
              stacked={true}
              colors={['#16A34A', '#4338CA', '#DC2626']}
              yAxisFormatter={(val) => Math.round(val).toString()}
            />
          </Card>
        </Section>
      </div>

      {/* Truck and Product Breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Section title="Top 10 Trucks by Revenue">
          <Card>
            <BarBreakdown
              categories={truckData.map(t => t.truck)}
              series={[{
                name: "Revenue",
                data: truckData.map(t => t.revenue)
              }]}
              height={300}
              stacked={false}
              horizontal={true}
              colors={['#0B6E99']}
              yAxisFormatter={(val) => "$" + Math.round(val).toLocaleString()}
            />
          </Card>
        </Section>

        <Section title="Product Mix (Revenue)">
          <Card>
            <DonutChart
              labels={productData.map(p => p.product)}
              series={productData.map(p => p.revenue)}
              title="Total"
              height={300}
              colors={['#0B6E99', '#00A99D', '#F5A623', '#9333EA', '#DC2626', '#16A34A', '#0891B2']}
            />
          </Card>
        </Section>
      </div>

      {/* Data Table Summary */}
      <Section title="Summary Statistics">
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>TOTAL TICKETS</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.deliveriesTotals?.tickets)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>TOTAL GALLONS</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.deliveriesTotals?.gallons)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>AVG PRICE/GAL</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${(agg.deliveriesAvgPrice||0).toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>SERVICE COMPLETED</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.svcCounts?.completed)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>SERVICE SCHEDULED</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.svcCounts?.scheduled)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 4 }}>IN PROGRESS</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.svcCounts?.inProgress)}</div>
            </div>
          </div>
        </Card>
      </Section>

      {/* KPI Editor Modal */}
      {kpiEditorOpen && (
        <KpiEditor
          initial={dashboardKpis || {}}
          onClose={() => setKpiEditorOpen(false)}
          onSave={async (vals) => {
            await upsertDashboardKpis(vals);
            const k = await fetchDashboardKpis();
            setDashboardKpis(k);
            setKpiEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
