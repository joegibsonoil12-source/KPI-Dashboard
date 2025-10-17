import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function Card({ title, value, sub, right, style, children }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{title}</div>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      {value !== undefined && <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>}
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

export default function ExecutiveDashboard() {
  const [preset, setPreset] = useState("30d");
  const [fromTo, setFromTo] = useState(rangePreset("30d"));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [serviceDaily, setServiceDaily] = useState([]);
  const [serviceTechs, setServiceTechs] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => { setFromTo(rangePreset(preset)); }, [preset]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setErr("");
      try {
        const { from, to } = fromTo;
        const { data: d1, error: e1 } = await supabase
          .from("view_service_metrics_daily")
          .select("job_date,status,job_count,total_revenue,total_due")
          .gte("job_date", from)
          .lte("job_date", to)
          .order("job_date", { ascending: true });
        if (e1) throw e1;

        const { data: d2, error: e2 } = await supabase
          .from("service_job_techs")
          .select("tech_name, job_amount, job_date")
          .gte("job_date", from)
          .lte("job_date", to);
        if (e2) throw e2;

        const { data: d3, error: e3 } = await supabase
          .from("delivery_tickets")
          .select("date, scheduled_window_start, created_at, amount, gallons_delivered, qty, status, truck")
          .limit(5000);
        if (e3) throw e3;

        if (!mounted) return;
        const fromD = new Date(from + "T00:00:00");
        const toD = new Date(to + "T23:59:59");
        const tFiltered = (Array.isArray(d3) ? d3 : []).filter((r) => {
          const d = parseTicketDate(r);
          return d && d >= fromD && d <= toD;
        });

        setServiceDaily(Array.isArray(d1) ? d1 : []);
        setServiceTechs(Array.isArray(d2) ? d2 : []);
        setTickets(tFiltered);
      } catch (e) {
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

    const serviceDays = Array.from(new Set(serviceDaily.map((r) => dayKey(r.job_date)))).sort();
    const S = ["completed", "scheduled", "in_progress", "canceled"]; 
    const mapService = new Map();
    const addS = (day, status, cnt, rev, due) => {
      if (!mapService.has(day)) mapService.set(day, new Map());
      const st = mapService.get(day);
      const cur = st.get(status) || { count: 0, revenue: 0, due: 0 };
      st.set(status, { count: cur.count + (cnt||0), revenue: cur.revenue + (rev||0), due: cur.due + (due||0) });
    };
    serviceDaily.forEach((r) => addS(dayKey(r.job_date), r.status, r.job_count||0, Number(r.total_revenue||0), Number(r.total_due||0)));
    const serviceCompletedRevenueByDay = serviceDays.map((d) => mapService.get(d)?.get("completed")?.revenue || 0);
    const serviceSeriesStatus = [
      { name: "Completed", key: "completed", color: "#16A34A" },
      { name: "Scheduled", key: "scheduled", color: "#4338CA" },
      { name: "In Progress", key: "in_progress", color: "#F59E0B" },
      { name: "Canceled", key: "canceled", color: "#DC2626" },
    ].map((s) => ({ name: s.name, color: s.color, values: serviceDays.map((d)=> mapService.get(d)?.get(s.key)?.count || 0) }));

    const svcCompletedRevenue = serviceDaily.filter(r=>r.status==="completed").reduce((a,b)=>a+Number(b.total_revenue||0),0);
    const svcPipelineRevenue = ["scheduled","in_progress"].reduce((sum, st) => (
      sum + serviceDaily.filter(r=>r.status===st).reduce((a,b)=>a+Number(b.total_revenue||0),0)
    ), 0);
    const svcCounts = {
      completed: serviceDaily.filter(r=>r.status==="completed").reduce((a,b)=>a+(b.job_count||0),0),
      scheduled: serviceDaily.filter(r=>r.status==="scheduled").reduce((a,b)=>a+(b.job_count||0),0),
      inProgress: serviceDaily.filter(r=>r.status==="in_progress").reduce((a,b)=>a+(b.job_count||0),0),
      canceled: serviceDaily.filter(r=>r.status==="canceled").reduce((a,b)=>a+(b.job_count||0),0),
    };

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
    const deliveriesSeriesStatus = [
      { name: "Delivered", key: "delivered", color: "#16A34A" },
      { name: "Scheduled", key: "scheduled", color: "#4338CA" },
      { name: "Issues", key: "issue", color: "#DC2626" },
    ].map((s) => ({ name: s.name, color: s.color, values: ticketsDays.map((d)=> byDayTickets.get(d)?.statusCounts[s.key] || 0) }));

    const deliveriesTotals = {
      tickets: tickets.length,
      gallons: tickets.reduce((a,b)=> a + (Number(b.gallons_delivered ?? b.qty) || 0), 0),
      revenue: tickets.reduce((a,b)=> a + (Number(b.amount) || 0), 0),
    };
    const deliveriesAvgPrice = deliveriesTotals.gallons > 0 ? deliveriesTotals.revenue / deliveriesTotals.gallons : 0;

    const allDays = Array.from(new Set([...serviceDays, ...ticketsDays])).sort();
    const mapSvcRev = new Map(serviceDays.map((d,i)=>[d, serviceCompletedRevenueByDay[i] || 0]));
    const mapDelRev = new Map(ticketsDays.map((d,i)=>[d, deliveriesRevenueByDay[i] || 0]));
    const combinedRevenueByDay = allDays.map((d)=> (mapSvcRev.get(d)||0) + (mapDelRev.get(d)||0));

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
      ticketsDays, deliveriesRevenueByDay, deliveriesSeriesStatus,
      deliveriesTotals, deliveriesAvgPrice,
      allDays, combinedRevenueByDay, topTechs,
    };
  }, [serviceDaily, serviceTechs, tickets]);

  const usd = (n) => "$" + Math.round(n||0).toLocaleString();
  const num = (n) => (n||0).toLocaleString();
  const grandRevenue = (agg.svcCompletedRevenue || 0) + (agg.deliveriesTotals?.revenue || 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section
        title="Executive Overview"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={preset} onChange={(e)=>setPreset(e.target.value)} style={{ padding:"8px 10px", border:"1px solid #E5E7EB", borderRadius:8 }}>
              <option value="30d">Last 30 days</option>
              <option value="mtd">This month</option>
              <option value="ytd">Year to date</option>
            </select>
            <div style={{ alignSelf:"center", fontSize:12, color:"#6B7280" }}>
              {fromTo.label} • {fromTo.from} → {fromTo.to}
            </div>
          </div>
        }
      >
        {err && <div style={{ color:"#b91c1c", fontSize:12, marginBottom:8 }}>{err}</div>}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6, minmax(180px, 1fr))", gap:12 }}>
          <Card title="Total Revenue (Service + Deliveries)" value={usd(grandRevenue)} sub="Sum over range" />
          <Card title="Service Revenue (Completed)" value={usd(agg.svcCompletedRevenue)} />
          <Card title="Delivery Revenue" value={usd(agg.deliveriesTotals?.revenue)} />
          <Card title="Service Jobs — Completed" value={num(agg.svcCounts?.completed)} />
          <Card title="Service Pipeline (Sched + In Prog)" value={usd(agg.svcPipelineRevenue)} />
          <Card title="Delivery Gallons" value={num(agg.deliveriesTotals?.gallons)} sub={"Avg $" + (agg.deliveriesAvgPrice||0).toFixed(2) + "/gal"} />
        </div>
      </Section>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Section title="Combined Revenue Trend">
          <Card>
            <Sparkline data={agg.combinedRevenueByDay || []} />
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6B7280", marginTop:6 }}>
              <span>{agg.allDays?.[0] || ""}</span>
              <span>{agg.allDays?.[agg.allDays.length-1] || ""}</span>
            </div>
          </Card>
        </Section>
        <Section title="Top Technicians (Service Revenue)">
          <Card>
            <HBars rows={agg.topTechs || []} />
          </Card>
        </Section>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Section title="Service — Jobs by Status (Daily)">
          <Card>
            <StackedBars categories={agg.serviceDays} series={agg.serviceSeriesStatus} />
            <div style={{ display:"flex", gap:12, marginTop:8, fontSize:12, color:"#6B7280", flexWrap:"wrap" }}>
              {agg.serviceSeriesStatus.map((s)=>(
                <div key={s.name} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:12, height:12, background:s.color, display:"inline-block", borderRadius:3 }} />
                  {s.name}
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Deliveries — Tickets by Status (Daily)">
          <Card>
            <StackedBars categories={agg.ticketsDays} series={agg.deliveriesSeriesStatus} />
            <div style={{ display:"flex", gap:12, marginTop:8, fontSize:12, color:"#6B7280", flexWrap:"wrap" }}>
              {agg.deliveriesSeriesStatus.map((s)=>(
                <div key={s.name} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:12, height:12, background:s.color, display:"inline-block", borderRadius:3 }} />
                  {s.name}
                </div>
              ))}
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}