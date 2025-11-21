// src/components/dashboard/ExecutiveDashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import { getBillboardSummary } from "../../lib/fetchMetricsClient";
import { fetchDashboardKpis } from "../../lib/dashboardKpis";
import CompanyHealthCard from "../CompanyHealthCard";
// Charts
import TimeSeriesChart from "../charts/TimeSeriesChart";
import DonutChart from "../charts/DonutChart";
import BarBreakdown from "../charts/BarBreakdown";
// Supabase (used for fallback aggregation when the aggregator doesn't return series)
import { supabase } from "../../lib/supabaseClient";

/**
 * Executive Dashboard with draggable cards and a sidebar card-picker.
 *
 * - Cards are draggable by their title bar; title follows drag.
 * - Sidebar allows toggling cards on/off and adding them to the layout.
 * - Layout persists to localStorage under key 'execdash_layout_v1'.
 *
 * NOTE: This UI layer prefers aggregator-provided series. If series are missing
 * it falls back to a 30-day Supabase aggregation (same logic as earlier PR).
 */

const LOCALSTORAGE_KEY = "execdash_layout_v1";

// Master list of available cards. Use `componentKey` to decide what to render.
// Keep ids stable.
const AVAILABLE_CARDS = [
  { id: "combinedRevenue", title: "Combined Revenue Trend (Daily)", componentKey: "combinedRevenue" },
  { id: "topTechnicians", title: "Top Technicians", componentKey: "topTechs" },
  { id: "serviceStatus", title: "Service Jobs by Status", componentKey: "serviceStatus" },
  { id: "deliveryStatus", title: "Delivery Tickets by Status", componentKey: "deliveryStatus" },
  { id: "topTrucks", title: "Top 10 Trucks by Revenue", componentKey: "topTrucks" },
  { id: "productMix", title: "Product Mix (Revenue)", componentKey: "productMix" },
  { id: "summaryStats", title: "Summary Statistics", componentKey: "summaryStats" },
  { id: "companyHealth", title: "Company Health", componentKey: "companyHealth" },
];

export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [dashboardKpis, setDashboardKpis] = useState(null);

  // UI state
  const [delivGroup, setDelivGroup] = useState("day");

  // computed agg fallback (from Supabase) — same as previous PR
  const [computedAgg, setComputedAgg] = useState({
    combinedRevenueByDay: [],
    allDays: [],
    serviceSeriesStatus: [],
    deliveriesSeriesStatus: [],
    truckData: [],
    productData: [],
    topTechs: [],
    deliveriesTotals: { tickets: 0, gallons: 0 },
    deliveriesAvgPrice: 0,
    svcCounts: { completed: 0 },
  });

  // Layout: array of card ids in order. Start with a sensible default or load from localStorage.
  const [layout, setLayout] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { /* ignore */ }
    // default layout
    return [
      "combinedRevenue",
      "topTechnicians",
      "serviceStatus",
      "deliveryStatus",
      "topTrucks",
      "productMix",
      "summaryStats",
      "companyHealth",
    ];
  });

  // Visibility: which cards are visible (defaults: all true)
  const [visible, setVisible] = useState(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY + "_visible");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch (e) {}
    const v = {};
    AVAILABLE_CARDS.forEach(c => v[c.id] = true);
    return v;
  });

  // Drag state
  const dragIndexRef = useRef(null);
  const dragOverIndexRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);

  // numeric formatting
  function num(v) {
    try {
      if (v === null || v === undefined) return "0";
      return Number(v).toLocaleString();
    } catch (e) {
      return String(v || "0");
    }
  }

  // simple label formatter
  function fmtKeyLabel(k, group) {
    if (!k && k !== 0) return "";
    if (typeof k === "string") return k;
    if (k instanceof Date) return k.toISOString().slice(0, 10);
    return String(k);
  }

  // --- Data load: billboard summary + dashboard kpis ---
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [kb, kpis] = await Promise.all([
          getBillboardSummary(),
          fetchDashboardKpis(),
        ]);

        if (!mounted) return;
        if (kb.error) console.warn("[ExecutiveDashboard] billboard error:", kb.error);
        setPayload(kb.data || {});
        setDashboardKpis(kpis || {});
        setError(kb.error || null);
      } catch (err) {
        console.error("[ExecutiveDashboard] load error:", err);
        if (mounted) setError(err.message || String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // --- Fallback aggregation for charts (last 30 days) ---
  useEffect(() => {
    const hasSeries = payload &&
      (payload.combinedRevenueByDay || payload.serviceSeriesStatus || payload.deliveriesSeriesStatus || payload.truckData || payload.productData);
    if (hasSeries) return; // prefer aggregator-provided series

    let mounted = true;
    async function computeFallbackAgg() {
      try {
        if (!supabase) {
          console.warn("[ExecutiveDashboard] No supabase client; can't compute fallback agg.");
          return;
        }

        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29); // inclusive 30 days
        const fmt = d => d.toISOString().slice(0, 10);

        const days = [];
        for (let i = 0; i < 30; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          days.push(fmt(d));
        }

        const { data: delRows, error: delError } = await supabase
          .from("delivery_tickets")
          .select("date, amount, qty, status, truck, product")
          .gte("date", fmt(start))
          .lte("date", fmt(end));
        if (delError) console.warn("[ExecutiveDashboard] delivery fetch error:", delError);

        const { data: svcRows, error: svcError } = await supabase
          .from("service_jobs")
          .select("job_date, job_amount, status, technician")
          .gte("job_date", fmt(start))
          .lte("job_date", fmt(end));
        if (svcError) console.warn("[ExecutiveDashboard] service fetch error:", svcError);

        // aggregate
        const deliveryMap = {};
        const deliveryStatusMap = {};
        const truckMap = {};
        const productMap = {};
        let totalTickets = 0, totalGallons = 0, totalDelRevenue = 0;

        (delRows || []).forEach(r => {
          const day = (r.date || "").slice(0, 10);
          const amt = Number(r.amount || 0);
          const qty = Number(r.qty || 0);
          totalTickets += 1;
          totalGallons += qty;
          totalDelRevenue += amt;
          deliveryMap[day] = (deliveryMap[day] || 0) + amt;

          const st = (r.status || "unknown").toString().toLowerCase();
          deliveryStatusMap[st] = deliveryStatusMap[st] || {};
          deliveryStatusMap[st][day] = (deliveryStatusMap[st][day] || 0) + 1;

          if (r.truck) truckMap[r.truck] = (truckMap[r.truck] || 0) + amt;
          if (r.product) productMap[r.product] = (productMap[r.product] || 0) + amt;
        });

        const serviceMap = {};
        const serviceStatusMap = {};
        let totalSvcCompleted = 0;
        (svcRows || []).forEach(r => {
          const day = (r.job_date || "").slice(0, 10);
          const amt = Number(r.job_amount || 0);
          const st = (r.status || "unknown").toString().toLowerCase();

          serviceStatusMap[st] = serviceStatusMap[st] || {};
          serviceStatusMap[st][day] = (serviceStatusMap[st][day] || 0) + 1;

          if (st === "completed") {
            serviceMap[day] = (serviceMap[day] || 0) + amt;
            totalSvcCompleted += 1;
          }
        });

        const combinedRevenueByDay = days.map(d => {
          const svcV = Number(serviceMap[d] || 0);
          const delV = Number(deliveryMap[d] || 0);
          return svcV + delV;
        });

        const serviceStatuses = Object.keys(serviceStatusMap).sort();
        const serviceSeriesStatus = serviceStatuses.map(st => ({
          name: st,
          values: days.map(d => Number(serviceStatusMap[st][d] || 0)),
        }));

        const deliveryStatuses = Object.keys(deliveryStatusMap).sort();
        const deliveriesSeriesStatus = deliveryStatuses.map(st => ({
          name: st,
          values: days.map(d => Number(deliveryStatusMap[st][d] || 0)),
        }));

        const truckData = Object.entries(truckMap)
          .map(([truck, revenue]) => ({ truck, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const productData = Object.entries(productMap)
          .map(([product, revenue]) => ({ product, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);

        const techMap = {};
        (svcRows || []).forEach(r => {
          const tech = r.technician || "Unknown";
          techMap[tech] = techMap[tech] || 0;
          if ((r.status || "").toLowerCase() === "completed") {
            techMap[tech] += Number(r.job_amount || 0);
          }
        });
        const topTechs = Object.entries(techMap)
          .map(([name, revenue]) => ({ name, value: revenue }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);

        const deliveriesTotals = { tickets: totalTickets, gallons: totalGallons };
        const deliveriesAvgPrice = totalTickets ? totalDelRevenue / totalTickets : 0;
        const svcCounts = { completed: totalSvcCompleted };

        if (!mounted) return;
        setComputedAgg({
          combinedRevenueByDay,
          allDays: days,
          serviceSeriesStatus,
          deliveriesSeriesStatus,
          truckData,
          productData,
          topTechs,
          deliveriesTotals,
          deliveriesAvgPrice,
          svcCounts,
        });

      } catch (err) {
        console.error("[ExecutiveDashboard] computeFallbackAgg error:", err);
      }
    }
    computeFallbackAgg();
    return () => { mounted = false; };
  }, [payload]);

  // Merge agg: prefer payload series, then computedAgg fallbacks
  const agg = {
    combinedRevenueByDay: (payload && (payload.combinedRevenueByDay || payload.combinedRevenue)) || computedAgg.combinedRevenueByDay || [],
    allDays: (payload && (payload.allDays || payload.combinedDays)) || computedAgg.allDays || [],
    topTechs: (payload && (payload.topTechs || payload.topTechnicians)) || computedAgg.topTechs || [],
    truckData: (payload && (payload.truckData || payload.topTrucks)) || computedAgg.truckData || [],
    productData: (payload && (payload.productData || payload.topProducts)) || computedAgg.productData || [],
    serviceDays: (payload && payload.serviceDays) || computedAgg.allDays || [],
    serviceSeriesStatus: (payload && (payload.serviceSeriesStatus || payload.serviceSeries)) || computedAgg.serviceSeriesStatus || [],
    ticketsBuckets: (payload && payload.ticketsBuckets) || computedAgg.allDays || [],
    deliveriesSeriesStatus: (payload && (payload.deliveriesSeriesStatus || payload.deliveriesSeries)) || computedAgg.deliveriesSeriesStatus || [],
    deliveriesTotals: (payload && payload.deliveriesTotals) || computedAgg.deliveriesTotals || { tickets: 0, gallons: 0 },
    deliveriesAvgPrice: (payload && payload.deliveriesAvgPrice) || computedAgg.deliveriesAvgPrice || 0,
    svcCounts: (payload && payload.svcCounts) || computedAgg.svcCounts || { completed: 0 },
  };

  // persist layout/visible when changed
  useEffect(() => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(layout));
      localStorage.setItem(LOCALSTORAGE_KEY + "_visible", JSON.stringify(visible));
    } catch (e) { /* ignore */ }
  }, [layout, visible]);

  // --- Drag handlers ---
  function handleDragStart(e, index, cardId) {
    dragIndexRef.current = index;
    setDraggingId(cardId);
    // set data for legacy browsers
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch (err) {}
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    dragOverIndexRef.current = index;
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e, index) {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    const toIndex = index;
    if (fromIndex == null || toIndex == null) {
      // fallback: try reading dataTransfer
      const dt = e.dataTransfer.getData("text/plain");
      if (dt) {
        const parsed = Number(dt);
        if (!isNaN(parsed)) {
          dragIndexRef.current = parsed;
        }
      }
    }
    const fi = dragIndexRef.current;
    const ti = toIndex;
    if (fi === undefined || fi === null) return;
    if (fi === ti) {
      setDraggingId(null);
      dragIndexRef.current = null;
      dragOverIndexRef.current = null;
      return;
    }
    const newLayout = Array.from(layout);
    const [moved] = newLayout.splice(fi, 1);
    newLayout.splice(ti, 0, moved);
    setLayout(newLayout);
    setDraggingId(null);
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  }

  function handleDragEnd() {
    setDraggingId(null);
    dragIndexRef.current = null;
    dragOverIndexRef.current = null;
  }

  // --- Sidebar card picker handlers ---
  function toggleVisibility(cardId) {
    setVisible(prev => {
      const newVisibility = !prev[cardId];
      const wasVisible = prev[cardId];
      
      // if becoming visible and not in layout, push to end
      if (!wasVisible && newVisibility) {
        setLayout(prevLayout => {
          if (!prevLayout.includes(cardId)) {
            return [...prevLayout, cardId];
          }
          return prevLayout;
        });
      }
      
      return { ...prev, [cardId]: newVisibility };
    });
  }

  function removeCard(cardId) {
    setLayout(prev => prev.filter(id => id !== cardId));
    setVisible(prev => ({ ...prev, [cardId]: false }));
  }

  function addCard(cardId) {
    setVisible(prev => ({ ...prev, [cardId]: true }));
    setLayout(prev => {
      if (!prev.includes(cardId)) return [...prev, cardId];
      return prev;
    });
  }

  // Utility: render card content by id
  function renderCardContent(cardId) {
    switch (cardId) {
      case "combinedRevenue":
        return (
          <TimeSeriesChart
            data={agg.combinedRevenueByDay || []}
            categories={agg.allDays || []}
            title="Revenue"
            height={260}
            type="area"
            color="#0B6E99"
            yAxisFormatter={(val) => "$" + Math.round(val).toLocaleString()}
          />
        );
      case "topTechnicians":
        return (
          <BarBreakdown
            categories={(agg.topTechs || []).map(t => t.name)}
            series={[
              { name: "Revenue", data: (agg.topTechs || []).map(t => Number(t.value || 0)) }
            ]}
            horizontal={true}
            height={260}
            colors={["#0B6E99"]}
            yAxisFormatter={(v) => Math.round(v).toLocaleString()}
          />
        );
      case "serviceStatus":
        return (
          <BarBreakdown
            categories={(agg.serviceDays || []).slice(-30)}
            series={(agg.serviceSeriesStatus || []).map(s => ({ name: s.name, data: (s.values || s.data || []).slice(-30) }))}
            stacked={true}
            height={260}
            colors={["#16A34A", "#4338CA", "#F59E0B", "#DC2626"]}
            yAxisFormatter={(v) => Math.round(v).toString()}
          />
        );
      case "deliveryStatus":
        return (
          <BarBreakdown
            categories={(agg.ticketsBuckets || []).map(k => fmtKeyLabel(k, delivGroup)).slice(-30)}
            series={(agg.deliveriesSeriesStatus || []).map(s => ({ name: s.name, data: (s.values || s.data || []).slice(-30) }))}
            stacked={true}
            height={260}
            colors={["#16A34A", "#4338CA", "#DC2626"]}
            yAxisFormatter={(v) => Math.round(v).toString()}
          />
        );
      case "topTrucks":
        return (
          <BarBreakdown
            categories={(agg.truckData || []).map((t) => t.truck || t.name)}
            series={[{ name: "Revenue", data: (agg.truckData || []).map((t) => Number(t.revenue || t.amount || 0)) }]}
            horizontal={true}
            height={300}
            colors={["#0B6E99"]}
            yAxisFormatter={(val) => "$" + Math.round(val).toLocaleString()}
          />
        );
      case "productMix":
        return (
          <DonutChart
            labels={(agg.productData || []).map((p) => p.product || p.name)}
            series={(agg.productData || []).map((p) => Number(p.revenue || p.amount || 0))}
            title="Total"
            height={280}
            colors={[
              "#0B6E99", "#00A99D", "#F5A623", "#9333EA", "#DC2626", "#16A34A", "#0891B2",
            ]}
          />
        );
      case "summaryStats":
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>TOTAL TICKETS</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.deliveriesTotals?.tickets)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>TOTAL GALLONS</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.deliveriesTotals?.gallons)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>AVG PRICE/GAL</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>${(agg.deliveriesAvgPrice || 0).toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>SERVICE COMPLETED</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{num(agg.svcCounts?.completed)}</div>
            </div>
          </div>
        );
      case "companyHealth":
        return (typeof CompanyHealthCard === "function") ? <CompanyHealthCard /> : <div />;
      default:
        return <div />;
    }
  }

  // Helper: returns card metadata from AVAILABLE_CARDS
  function cardMeta(id) {
    return AVAILABLE_CARDS.find(c => c.id === id) || { id, title: id };
  }

  // Render
  return (
    <div style={{ display: "flex", gap: 16, padding: 18 }}>
      {/* Sidebar */}
      <aside style={{ width: 260, flexShrink: 0 }}>
        <div style={{ background: "#fff", border: "1px solid #E6E6E6", borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Card Picker</h3>
          <p style={{ marginTop: 0, marginBottom: 8, color: "#6B7280", fontSize: 13 }}>
            Toggle cards to show/hide. Drag titles to reorder the visible cards.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {AVAILABLE_CARDS.map(card => (
              <div key={card.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!visible[card.id]}
                    onChange={() => toggleVisibility(card.id)}
                    aria-label={`Toggle ${card.title}`}
                  />
                  <span style={{ fontSize: 14 }}>{card.title}</span>
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {!visible[card.id] && (
                    <button
                      onClick={() => addCard(card.id)}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#F3F4F6" }}
                    >
                      Add
                    </button>
                  )}
                  {visible[card.id] && layout.includes(card.id) && (
                    <button
                      onClick={() => removeCard(card.id)}
                      style={{ fontSize: 12, padding: "6px 8px", borderRadius: 6, border: "1px solid #E5E7EB", background: "#FFF" }}
                      aria-label={`Remove ${card.title}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <hr style={{ margin: "12px 0", borderColor: "#F3F4F6" }} />
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tips</div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>Drag the card title to reorder.</li>
              <li>Use the Add/Remove buttons to adjust visible cards.</li>
              <li>Layout saved in browser (localStorage).</li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Gibson Oil & Gas — KPI Dashboard</h2>
          <div>
            <button className="btn btn-outline" style={{ marginRight: 8 }}>Edit KPIs</button>
          </div>
        </div>

        {error && <div style={{ background: '#fee2e2', padding: 12, borderRadius: 6, color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
        {loading && <div style={{ marginBottom: 12 }}>Loading dashboard...</div>}

        {/* Grid of cards: render in order from layout, only if visible */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {layout.map((cardId, index) => {
            if (!visible[cardId]) return null;
            const meta = cardMeta(cardId);
            const isDragging = draggingId === cardId;
            return (
              <div
                key={cardId}
                draggable
                onDragStart={(e) => handleDragStart(e, index, cardId)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: isDragging ? 0.65 : 1,
                  borderRadius: 8,
                  background: "#FFF",
                  border: "1px solid #E6E6E6",
                  overflow: "hidden",
                  boxShadow: isDragging ? "0 4px 14px rgba(11,110,153,0.08)" : undefined,
                }}
              >
                {/* Card header / drag handle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderBottom: "1px solid #F3F4F6",
                    cursor: "grab",
                    background: isDragging ? "#F8FAFC" : "#FFF",
                  }}
                  aria-grabbed={isDragging}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden style={{ opacity: 0.6 }}>
                      <path d="M10 6h.01M14 6h.01M10 12h.01M14 12h.01M10 18h.01M14 18h.01" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ fontWeight: 700 }}>{meta.title}</div>
                    <div style={{ marginLeft: 8, fontSize: 12, color: "#6B7280" }}>
                      {/* small hint */}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => removeCard(cardId)}
                      title="Remove card"
                      style={{ border: "none", background: "transparent", color: "#6B7280", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: 12 }}>
                  {renderCardContent(cardId)}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
