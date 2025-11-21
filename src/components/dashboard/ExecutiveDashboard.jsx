/* ExecutiveDashboard.jsx
   Replacement that is robust and self-contained.
   - Two zones: top (square KPI tiles) and bottom (charts)
   - Drag any card between zones and reorder within a zone
   - Layout persisted to localStorage under execdash_custom_layout_v1
   - Uses existing components: KpiCard, CompanyHealthCard, TimeSeriesChart, DonutChart, BarBreakdown
   - Imports UploadAvgMilesButton (add file if not present)
*/

import React, { useEffect, useState, useRef } from "react";
import { getBillboardSummary } from "../../lib/fetchMetricsClient";
import { fetchDashboardKpis } from "../../lib/dashboardKpis";
import CompanyHealthCard from "../CompanyHealthCard";
import KpiCard from "../Billboard/KpiCard";
import UploadAvgMilesButton from "../UploadAvgMilesButton";
import TimeSeriesChart from "../charts/TimeSeriesChart";
import DonutChart from "../charts/DonutChart";
import BarBreakdown from "../charts/BarBreakdown";
import { supabase } from "../../lib/supabaseClient";

const AVAILABLE_CARDS = [
  // top tiles
  { id: "tile_totalGallons", title: "TOTAL GALLONS (ALL C-STORES)", zone: "top", type: "tile" },
  { id: "tile_serviceRevenueThisWeek", title: "SERVICE REVENUE (THIS WEEK)", zone: "top", type: "tile" },
  { id: "tile_currentTanks", title: "CURRENT TANKS", zone: "top", type: "tile" },
  { id: "tile_customersLost", title: "CUSTOMERS LOST", zone: "top", type: "tile" },
  { id: "tile_customersGained", title: "CUSTOMERS GAINED", zone: "top", type: "tile" },
  { id: "tile_tanksSet", title: "TANKS SET", zone: "top", type: "tile" },

  // bottom charts/cards
  { id: "combinedRevenue", title: "Combined Revenue Trend (Daily)", zone: "bottom", type: "chart" },
  { id: "serviceCard", title: "Service - Revenue & Counts", zone: "bottom", type: "chart" },
  { id: "deliveryCard", title: "Delivery - Revenue & Counts", zone: "bottom", type: "chart" },
  { id: "productMix", title: "Product Mix (Revenue)", zone: "bottom", type: "chart" },
  { id: "summaryStats", title: "Summary Statistics", zone: "bottom", type: "tile" },
  { id: "companyHealth", title: "Company Health", zone: "bottom", type: "tile" },
  { id: "tanksSetWeek", title: "Tanks Set (Weekly)", zone: "bottom", type: "chart" },
  { id: "avgMilesCard", title: "Avg Miles per Stop", zone: "bottom", type: "tile" },
];

function findMeta(id) {
  return AVAILABLE_CARDS.find(c => c.id === id) || { id, title: id };
}

export default function ExecutiveDashboard() {
  const LOCALSTORAGE_KEY = "execdash_custom_layout_v1";
  const LOCALSTORAGE_VISIBLE = LOCALSTORAGE_KEY + "_visible";

  const [payload, setPayload] = useState(null);
  const [dashboardKpis, setDashboardKpis] = useState(null);
  const [computedAgg, setComputedAgg] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const dragRef = useRef({ zone: null, index: null, id: null });

  // layout state (two zones)
  const [layoutTop, setLayoutTop] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.top)) return parsed.top;
      }
    } catch (e) {}
    return [
      "tile_totalGallons",
      "tile_serviceRevenueThisWeek",
      "tile_currentTanks",
      "tile_customersLost",
      "tile_customersGained",
      "tile_tanksSet",
    ];
  });

  const [layoutBottom, setLayoutBottom] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.bottom)) return parsed.bottom;
      }
    } catch (e) {}
    return [
      "combinedRevenue",
      "serviceCard",
      "deliveryCard",
      "productMix",
      "summaryStats",
      "companyHealth",
      "tanksSetWeek",
      "avgMilesCard",
    ];
  });

  const [visible, setVisible] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_VISIBLE);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const v = {};
    AVAILABLE_CARDS.forEach(c => (v[c.id] = true));
    return v;
  });

  // helpers
  const fmtNum = (v) => (v === null || v === undefined ? "0" : Number(v).toLocaleString());
  const fmtDateKey = (k) => (k && typeof k === "string" ? k : k instanceof Date ? k.toISOString().slice(0,10) : String(k||""));

  // load initial data
  useEffect(() => {
    let mounted = true;
    async function loadAll() {
      setLoading(true);
      try {
        const [bb, kpis] = await Promise.all([getBillboardSummary(), fetchDashboardKpis()]);
        if (!mounted) return;
        if (bb.error) console.warn("[ExecDash] billboard error", bb.error);
        setPayload(bb.data || {});
        setDashboardKpis(kpis || {});
        setError(bb.error || null);
      } catch (err) {
        console.error("[ExecDash] load error", err);
        if (mounted) setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAll();
    return () => { mounted = false; };
  }, []);

  // fallback aggregation (30d) if payload lacks series
  useEffect(() => {
    const hasSeries = payload && (
      payload.combinedRevenueByDay || payload.serviceSeriesStatus || payload.deliveriesSeriesStatus || payload.truckData || payload.productData
    );
    if (hasSeries) return;

    let mounted = true;
    async function fallback() {
      try {
        if (!supabase) return;
        const end = new Date();
        const start = new Date(); start.setDate(start.getDate() - 29);
        const fmt = d => d.toISOString().slice(0,10);
        const days = [];
        for (let i = 0; i < 30; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(fmt(d)); }

        const { data: delRows } = await supabase.from("delivery_tickets").select("date, amount, qty, status, truck, product").gte("date", fmt(start)).lte("date", fmt(end));
        const { data: svcRows } = await supabase.from("service_jobs").select("job_date, job_amount, status, technician").gte("job_date", fmt(start)).lte("job_date", fmt(end));

        const deliveryMap = {}, deliveryStatusMap = {}, truckMap = {}, productMap = {};
        let totalTickets = 0, totalGallons = 0, totalDelRevenue = 0;
        (delRows||[]).forEach(r => {
          const day = (r.date||"").slice(0,10);
          const amt = Number(r.amount||0), qty = Number(r.qty||0);
          totalTickets++; totalGallons += qty; totalDelRevenue += amt;
          deliveryMap[day] = (deliveryMap[day] || 0) + amt;
          const st = (r.status||"unknown").toLowerCase();
          deliveryStatusMap[st] = deliveryStatusMap[st] || {}; deliveryStatusMap[st][day] = (deliveryStatusMap[st][day] || 0) + 1;
          if (r.truck) truckMap[r.truck] = (truckMap[r.truck] || 0) + amt;
          if (r.product) productMap[r.product] = (productMap[r.product] || 0) + amt;
        });

        const serviceMap = {}, serviceStatusMap = {}; let totalSvcCompleted = 0;
        (svcRows||[]).forEach(r => {
          const day = (r.job_date||"").slice(0,10);
          const amt = Number(r.job_amount||0); const st = (r.status||"unknown").toLowerCase();
          serviceStatusMap[st] = serviceStatusMap[st] || {}; serviceStatusMap[st][day] = (serviceStatusMap[st][day]||0) + 1;
          if (st === "completed") { serviceMap[day] = (serviceMap[day]||0) + amt; totalSvcCompleted++; }
        });

        const combinedRevenueByDay = days.map(d => (Number(serviceMap[d]||0) + Number(deliveryMap[d]||0)));
        const serviceSeriesStatus = Object.keys(serviceStatusMap).sort().map(st => ({ name: st, values: days.map(d => Number(serviceStatusMap[st][d]||0)) }));
        const deliveriesSeriesStatus = Object.keys(deliveryStatusMap).sort().map(st => ({ name: st, values: days.map(d => Number(deliveryStatusMap[st][d]||0)) }));
        const truckData = Object.entries(truckMap).map(([truck,revenue]) => ({ truck, revenue })).sort((a,b)=>b.revenue-a.revenue).slice(0,10);
        const productData = Object.entries(productMap).map(([product,revenue]) => ({ product, revenue })).sort((a,b)=>b.revenue-a.revenue).slice(0,10);

        if (!mounted) return;
        setComputedAgg({
          combinedRevenueByDay, allDays: days,
          serviceSeriesStatus, deliveriesSeriesStatus,
          truckData, productData,
          deliveriesTotals: { tickets: totalTickets, gallons: totalGallons },
          deliveriesAvgPrice: totalTickets ? totalDelRevenue / totalTickets : 0,
          svcCounts: { completed: totalSvcCompleted },
        });
      } catch (err) {
        console.error("[ExecDash] fallback error", err);
      }
    }
    fallback();
    return () => { mounted = false; };
  }, [payload]);

  // aggregated view for UI
  const agg = {
    combinedRevenueByDay: (payload && (payload.combinedRevenueByDay || payload.combinedRevenue)) || computedAgg.combinedRevenueByDay || [],
    allDays: (payload && (payload.allDays || payload.combinedDays)) || computedAgg.allDays || [],
    truckData: (payload && (payload.truckData || payload.topTrucks)) || computedAgg.truckData || [],
    productData: (payload && (payload.productData || payload.topProducts)) || computedAgg.productData || [],
    serviceSeriesStatus: (payload && (payload.serviceSeriesStatus || payload.serviceSeries)) || computedAgg.serviceSeriesStatus || [],
    deliveriesSeriesStatus: (payload && (payload.deliveriesSeriesStatus || payload.deliveriesSeries)) || computedAgg.deliveriesSeriesStatus || [],
    deliveriesTotals: (payload && payload.deliveriesTotals) || computedAgg.deliveriesTotals || { tickets: 0, gallons: 0 },
    deliveriesAvgPrice: (payload && payload.deliveriesAvgPrice) || computedAgg.deliveriesAvgPrice || 0,
    svcCounts: (payload && payload.svcCounts) || computedAgg.svcCounts || { completed: 0 },
  };

  // persist layout/visible
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify({ top: layoutTop, bottom: layoutBottom }));
      localStorage.setItem(LOCALSTORAGE_VISIBLE, JSON.stringify(visible));
    } catch (e) {}
  }, [layoutTop, layoutBottom, visible]);

  // drag helpers
  function handleDragStart(zone, index, id, e) {
    dragRef.current = { zone, index, id };
    setDraggingId(id);
    try { e.dataTransfer.setData("text/plain", JSON.stringify({ zone, index, id })); } catch {}
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragOver(zone, index, e) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  function handleDrop(zone, index, e) {
    e.preventDefault();
    const from = dragRef.current;
    if (!from || !from.id) return;
    const id = from.id;
    const top = Array.from(layoutTop);
    const bottom = Array.from(layoutBottom);
    // remove from source
    if (from.zone === "top") top.splice(from.index, 1); else bottom.splice(from.index, 1);
    // insert into target
    const target = (zone === "top") ? top : bottom;
    const pos = (index == null) ? target.length : index;
    target.splice(pos, 0, id);
    setLayoutTop(top);
    setLayoutBottom(bottom);
    dragRef.current = { zone: null, index: null, id: null };
    setDraggingId(null);
  }
  function handleDragEnd() { dragRef.current = { zone: null, index: null, id: null }; setDraggingId(null); }

  // card picker actions
  function toggleVisibility(cardId) {
    setVisible(prev => {
      const next = { ...prev, [cardId]: !prev[cardId] };
      // if making visible and not in layout, add to bottom
      if (next[cardId] && !layoutTop.includes(cardId) && !layoutBottom.includes(cardId)) {
        setLayoutBottom(prev => [...prev, cardId]);
      }
      return next;
    });
  }
  function addCardToZone(cardId, zone) {
    setVisible(prev => ({ ...prev, [cardId]: true }));
    if (zone === "top") {
      setLayoutTop(prev => prev.includes(cardId) ? prev : [...prev, cardId]);
    } else {
      setLayoutBottom(prev => prev.includes(cardId) ? prev : [...prev, cardId]);
    }
  }
  function removeCard(cardId) {
    setVisible(prev => ({ ...prev, [cardId]: false }));
    setLayoutTop(prev => prev.filter(i => i !== cardId));
    setLayoutBottom(prev => prev.filter(i => i !== cardId));
  }

  // render tile content
  function renderTile(id) {
    const dk = dashboardKpis || {};
    const squares = payload?.dashboardSquares || {};
    switch (id) {
      case "tile_totalGallons":
        return <KpiCard title="TOTAL GALLONS (ALL C-STORES)" value={(squares.totalGallonsAllStores || 0).toLocaleString()} sub="gal" />;
      case "tile_serviceRevenueThisWeek":
        return <KpiCard title="SERVICE REVENUE (THIS WEEK)" value={(squares.weeklyServiceRevenue || 0).toLocaleString(undefined,{style:'currency',currency:'USD'})} />;
      case "tile_currentTanks":
        return <KpiCard title="CURRENT TANKS" value={(dk.current_tanks || 0).toLocaleString()} />;
      case "tile_customersLost":
        return <KpiCard title="CUSTOMERS LOST" value={(dk.customers_lost || 0).toLocaleString()} />;
      case "tile_customersGained":
        return <KpiCard title="CUSTOMERS GAINED" value={(dk.customers_gained || 0).toLocaleString()} />;
      case "tile_tanksSet":
        return <KpiCard title="TANKS SET" value={(dk.tanks_set || 0).toLocaleString()} />;
      case "summaryStats":
        return (
          <div>
            <div style={{display:"grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap:12}}>
              <div><div style={{fontSize:11,color:"#6B7280",fontWeight:600}}>TOTAL TICKETS</div><div style={{fontSize:20,fontWeight:700}}>{fmtNum(agg.deliveriesTotals?.tickets)}</div></div>
              <div><div style={{fontSize:11,color:"#6B7280",fontWeight:600}}>TOTAL GALLONS</div><div style={{fontSize:20,fontWeight:700}}>{fmtNum(agg.deliveriesTotals?.gallons)}</div></div>
              <div><div style={{fontSize:11,color:"#6B7280",fontWeight:600}}>AVG PRICE/GAL</div><div style={{fontSize:20,fontWeight:700}}>${(agg.deliveriesAvgPrice||0).toFixed(2)}</div></div>
              <div><div style={{fontSize:11,color:"#6B7280",fontWeight:600}}>SERVICE COMPLETED</div><div style={{fontSize:20,fontWeight:700}}>{fmtNum(agg.svcCounts?.completed)}</div></div>
            </div>
          </div>
        );
      case "companyHealth":
        return (typeof CompanyHealthCard === "function") ? <CompanyHealthCard /> : <div/>;
      case "avgMilesCard":
        const avgMiles = payload?.deliveryTicketsMetrics?.avgMiles ?? null;
        return (
          <div>
            <div style={{fontSize:12,color:"#6B7280"}}>Avg Miles per Stop</div>
            <div style={{fontSize:22,fontWeight:700, marginTop:6}}>{avgMiles !== null ? `${Number(avgMiles).toFixed(1)} mi` : "—"}</div>
            <div style={{marginTop:10}}><UploadAvgMilesButton/></div>
          </div>
        );
      default:
        return <div/>;
    }
  }

  // render chart content
  function renderChart(id) {
    switch (id) {
      case "combinedRevenue":
        return <TimeSeriesChart data={agg.combinedRevenueByDay||[]} categories={agg.allDays||[]} title="Revenue" height={260} type="area" color="#0B6E99" yAxisFormatter={(v)=>"$"+Math.round(v).toLocaleString()} />;
      case "serviceCard":
        return <BarBreakdown categories={(agg.allDays||[]).slice(-30)} series={(agg.serviceSeriesStatus||[]).map(s=>({name:s.name,data:(s.values||s.data||[]).slice(-30)}))} height={260} stacked colors={["#16A34A","#4338CA","#F59E0B","#DC2626"]} />;
      case "deliveryCard":
        return <BarBreakdown categories={(agg.allDays||[]).slice(-30)} series={(agg.deliveriesSeriesStatus||[]).map(s=>({name:s.name,data:(s.values||s.data||[]).slice(-30)}))} height={260} stacked colors={["#16A34A","#4338CA","#DC2626"]} />;
      case "productMix":
        return <DonutChart labels={(agg.productData||[]).map(p=>p.product||p.name)} series={(agg.productData||[]).map(p=>Number(p.revenue||p.amount||0))} title="Total" height={260} colors={["#0B6E99","#00A99D","#F5A623","#9333EA","#DC2626","#16A34A","#0891B2"]} />;
      case "tanksSetWeek":
        if (payload?.tanksSetWeekly) {
          return <TimeSeriesChart data={payload.tanksSetWeekly.values} categories={payload.tanksSetWeekly.weeks} title="Tanks Set (Weekly)" height={240} type="line" color="#9333EA" />;
        }
        const dk = dashboardKpis || {};
        const singleWeek = dk.tanks_set || 0;
        return <TimeSeriesChart data={[singleWeek]} categories={[new Date().toISOString().slice(0,10)]} title="Tanks Set (Weekly)" height={240} type="line" color="#9333EA" />;
      default:
        return <div/>;
    }
  }

  // Render
  return (
    <div style={{display:"flex",gap:16,padding:18}}>
      {/* Sidebar */}
      <aside style={{width:260,flexShrink:0}}>
        <div style={{background:"#fff",border:"1px solid #E6E6E6",borderRadius:8,padding:12}}>
          <h3 style={{marginTop:0}}>Card Picker</h3>
          <p style={{margin:0,color:"#6B7280",fontSize:13}}>Toggle cards to show/hide; add to Top or Bottom.</p>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
            {AVAILABLE_CARDS.map(card => (
              <div key={card.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}}>
                  <input type="checkbox" checked={!!visible[card.id]} onChange={()=>toggleVisibility(card.id)} />
                  <span style={{fontSize:14}}>{card.title}</span>
                </label>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>addCardToZone(card.id,"top")} style={{fontSize:12}}>Add Top</button>
                  <button onClick={()=>addCardToZone(card.id,"bottom")} style={{fontSize:12}}>Add Bottom</button>
                  {visible[card.id] && (layoutTop.includes(card.id) || layoutBottom.includes(card.id)) && <button onClick={()=>removeCard(card.id)} style={{fontSize:12}}>Remove</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h2 style={{margin:0}}>Gibson Oil & Gas — KPI Dashboard</h2>
          <div><button className="btn btn-outline">Edit KPIs</button></div>
        </div>

        {error && <div style={{background:"#fee2e2",padding:12,borderRadius:6,color:"#b91c1c",marginBottom:12}}>{String(error)}</div>}
        {loading && <div style={{marginBottom:12}}>Loading dashboard...</div>}

        {/* TOP ZONE */}
        <div style={{marginBottom:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:16}} onDragOver={(e)=>{e.preventDefault();}} onDrop={(e)=>{handleDrop("top",null,e);}}>
          {layoutTop.map((cardId, idx) => {
            if (!visible[cardId]) return null;
            const meta = findMeta(cardId);
            const isDragging = draggingId === cardId;
            return (
              <div key={cardId} draggable onDragStart={(e)=>handleDragStart("top", idx, cardId, e)} onDragOver={(e)=>handleDragOver("top", idx, e)} onDrop={(e)=>handleDrop("top", idx, e)} onDragEnd={handleDragEnd} style={{background:"#fff",border:"1px solid #E6E6E6",borderRadius:8,overflow:"hidden",boxShadow:isDragging?"0 6px 18px rgba(11,110,153,0.08)":undefined}}>
                <div style={{padding:10,borderBottom:"1px solid #F3F4F6",cursor:"grab",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10 6h.01M14 6h.01M10 12h.01M14 12h.01M10 18h.01M14 18h.01" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <div style={{fontWeight:700}}>{meta.title}</div>
                  </div>
                  <button onClick={()=>removeCard(cardId)} style={{border:"none",background:"transparent",cursor:"pointer"}}>✕</button>
                </div>
                <div style={{padding:12}}>
                  {renderTile(cardId)}
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM ZONE */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16}} onDragOver={(e)=>{e.preventDefault();}} onDrop={(e)=>{handleDrop("bottom",null,e);}}>
          {layoutBottom.map((cardId, idx) => {
            if (!visible[cardId]) return null;
            const meta = findMeta(cardId);
            const isDragging = draggingId === cardId;
            return (
              <div key={cardId} draggable onDragStart={(e)=>handleDragStart("bottom", idx, cardId, e)} onDragOver={(e)=>handleDragOver("bottom", idx, e)} onDrop={(e)=>handleDrop("bottom", idx, e)} onDragEnd={handleDragEnd} style={{background:"#fff",border:"1px solid #E6E6E6",borderRadius:8,overflow:"hidden",boxShadow:isDragging?"0 6px 18px rgba(11,110,153,0.08)":undefined}}>
                <div style={{padding:10,borderBottom:"1px solid #F3F4F6",cursor:"grab",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10 6h.01M14 6h.01M10 12h.01M14 12h.01M10 18h.01M14 18h.01" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <div style={{fontWeight:700}}>{meta.title}</div>
                  </div>
                  <button onClick={()=>removeCard(cardId)} style={{border:"none",background:"transparent",cursor:"pointer"}}>✕</button>
                </div>
                <div style={{padding:12}}>
                  {renderChart(cardId)}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
