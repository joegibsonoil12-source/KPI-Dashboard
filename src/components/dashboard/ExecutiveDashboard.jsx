import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import TimeSeriesChart from "../charts/TimeSeriesChart";
import DonutChart from "../charts/DonutChart";
import BarBreakdown from "../charts/BarBreakdown";
import DashboardControls from "../DashboardControls";

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

  useEffect(() => { setFromTo(rangePreset(preset)); }, [preset]);

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
          .select("job_date,status,job_amount")
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
    serviceDaily.forEach((r) => addS(dayKey(r.job_date), r.status, 1, Number(r.job_amount||0), 0));
    const serviceCompletedRevenueByDay = serviceDays.map((d) => mapService.get(d)?.get("completed")?.revenue || 0);
    const serviceSeriesStatus = [
      { name: "Completed", key: "completed", color: "#16A34A" },
      { name: "Scheduled", key: "scheduled", color: "#4338CA" },
      { name: "In Progress", key: "in_progress", color: "#F59E0B" },
      { name: "Canceled", key: "canceled", color: "#DC2626" },
    ].map((s) => ({ name: s.name, color: s.color, values: serviceDays.map((d)=> mapService.get(d)?.get(s.key)?.count || 0) }));

    const svcCompletedRevenue = serviceDaily.filter(r=>r.status==="completed").reduce((a,b)=>a+Number(b.job_amount||0),0);
    const svcPipelineRevenue = ["scheduled","in_progress"].reduce((sum, st) => (
      sum + serviceDaily.filter(r=>r.status===st).reduce((a,b)=>a+Number(b.job_amount||0),0)
    ), 0);
    const svcCounts = {
      completed: serviceDaily.filter(r=>r.status==="completed").length,
      scheduled: serviceDaily.filter(r=>r.status==="scheduled").length,
      inProgress: serviceDaily.filter(r=>r.status==="in_progress").length,
      canceled: serviceDaily.filter(r=>r.status==="canceled").length,
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

    return {
      serviceDays, serviceCompletedRevenueByDay, serviceSeriesStatus,
      svcCompletedRevenue, svcPipelineRevenue, svcCounts,
      ticketsDays, deliveriesRevenueByDay, // kept for combined chart
      ticketsBuckets, deliveriesSeriesStatus, // used by grouped delivery chart
      deliveriesTotals, deliveriesAvgPrice,
      avgMilesPerStop, totalMiles, deliveredStops, // miles per stop metrics
      allDays, combinedRevenueByDay, topTechs,
    };
  }, [serviceDaily, serviceTechs, tickets, delivGroup]);

  const usd = (n) => "$" + Math.round(n||0).toLocaleString();
  const num = (n) => (n||0).toLocaleString();
  const grandRevenue = (agg.svcCompletedRevenue || 0) + (agg.deliveriesTotals?.revenue || 0);

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
    </div>
  );
}
