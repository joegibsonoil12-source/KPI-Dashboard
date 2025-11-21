import React, { useEffect, useState } from "react";
import { getBillboardSummary } from "../../lib/fetchMetricsClient";
import { fetchDashboardKpis } from "../../lib/dashboardKpis";
import CompanyHealthCard from "../CompanyHealthCard";

// Charts
import TimeSeriesChart from "../charts/TimeSeriesChart";
import DonutChart from "../charts/DonutChart";
import BarBreakdown from "../charts/BarBreakdown";

// Local lightweight KPI card used to render tiles. Use existing project Card components if preferred.
function KpiCard({
  title,
  value,
  subtitle
}) {
  return <div style={{
    background: 'white',
    border: '1px solid #E6E6E6',
    borderRadius: 8,
    padding: 16,
    minHeight: 90,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  }}>
      <div style={{
      fontSize: 12,
      color: '#6B7280',
      fontWeight: 700,
      textTransform: 'uppercase'
    }}>{title}</div>
      <div style={{
      fontSize: 26,
      fontWeight: 800,
      marginTop: 8
    }}>{value}</div>
      {subtitle && <div style={{
      fontSize: 12,
      color: '#9CA3AF'
    }}>{subtitle}</div>}
    </div>;
}
function formatCurrency(v) {
  return `$${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}
function formatGallons(v) {
  return `${Number(v || 0).toLocaleString()} gal`;
}
export default function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  // Small UI state for the delivery grouping dropdown
  const [delivGroup, setDelivGroup] = useState("day");

  // Default empty payload shape used if serverless call or fallback produce nothing
  const EMPTY = {
    serviceTracking: {
      completed: 0,
      scheduled: 0,
      deferred: 0,
      completedRevenue: 0,
      pipelineRevenue: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0
    },
    deliveryTickets: {
      totalTickets: 0,
      totalGallons: 0,
      revenue: 0
    },
    weekCompare: {
      thisWeekTotalRevenue: 0,
      lastWeekTotalRevenue: 0,
      percentChange: 0,
      scheduledJobs: 0,
      scheduledRevenue: 0
    },
    cStoreGallons: [],
    dashboardSquares: {},
    dashboardKpis: {
      current_tanks: 0,
      customers_lost: 0,
      customers_gained: 0,
      tanks_set: 0
    }
  };
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Prefer serverless aggregator (fault-tolerant, service-role). getBillboardSummary() handles fallback internally if necessary.
        const {
          data,
          error
        } = await getBillboardSummary();
        if (error) {
          console.warn('[ExecutiveDashboard] getBillboardSummary returned error:', error);
          // fallback: fetch KPIs alone so tiles aren't entirely empty
          try {
            const k = await fetchDashboardKpis();
            if (mounted) setPayload({
              ...EMPTY,
              dashboardKpis: k
            });
          } catch (e) {
            if (mounted) setPayload(EMPTY);
          }
        } else if (!data) {
          try {
            const k = await fetchDashboardKpis();
            if (mounted) setPayload({
              ...EMPTY,
              dashboardKpis: k
            });
          } catch (e) {
            if (mounted) setPayload(EMPTY);
          }
        } else {
          if (mounted) {
            // Normalize the payload so the rest of the component uses stable keys
            const normalized = {
              serviceTracking: data.serviceTracking || EMPTY.serviceTracking,
              deliveryTickets: data.deliveryTickets || EMPTY.deliveryTickets,
              weekCompare: data.weekCompare || EMPTY.weekCompare,
              cStoreGallons: data.cStoreGallons || EMPTY.cStoreGallons,
              dashboardSquares: data.dashboardSquares || EMPTY.dashboardSquares,
              dashboardKpis: data.dashboardKpis || EMPTY.dashboardKpis
            };
            setPayload(normalized);
          }
        }
      } catch (e) {
        console.error('[ExecutiveDashboard] load failed', e);
        setError(String(e));
        try {
          const k = await fetchDashboardKpis();
          if (mounted) setPayload({
            ...EMPTY,
            dashboardKpis: k
          });
        } catch (ee) {
          if (mounted) setPayload(EMPTY);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Map payload to tiles (safe defaults used)
  const serviceRevenueThisWeek = payload?.weekCompare?.thisWeekTotalRevenue ?? payload?.dashboardSquares?.weeklyServiceRevenue ?? 0;
  const totalGallons = payload?.dashboardSquares?.totalGallonsAllStores !== undefined ? payload.dashboardSquares.totalGallonsAllStores : (payload?.cStoreGallons || []).reduce((s, r) => s + (Number(r.totalGallons) || 0), 0);
  const completedJobs = payload?.serviceTracking?.completed ?? 0;
  const deliveryTickets = payload?.deliveryTickets?.totalTickets ?? 0;
  const deliveryGallons = payload?.deliveryTickets?.totalGallons ?? 0;
  const deliveryRevenue = payload?.deliveryTickets?.revenue ?? 0;
  const dashboardKpis = payload?.dashboardKpis ?? {
    current_tanks: 0,
    customers_lost: 0,
    customers_gained: 0,
    tanks_set: 0
  };
  
  // Maximum number of entries to display in time-series charts
  const MAX_CHART_ENTRIES = 30;
  
  //
  // --- lightweight chart helpers & safe "agg" mapping ---
  //
  // The charts expect an `agg` object (historically produced by the aggregator).
  // If the serverless aggregator already returns those keys, great; otherwise
  // we provide safe fallbacks so the UI renders without blowing up.
  //
  const agg = {
    // Combined revenue timeseries (array of numbers or objects, depending on your aggregator)
    combinedRevenueByDay: payload?.combinedRevenueByDay || payload?.combinedRevenue || [],
    allDays: payload?.allDays || payload?.combinedDays || [],

    // Top technicians/trucks/products
    topTechs: payload?.topTechs || payload?.topTechnicians || [],
    truckData: payload?.truckData || payload?.topTrucks || [],
    productData: payload?.productData || payload?.topProducts || [],

    // Service and delivery breakdown series (arrays expected by BarBreakdown)
    serviceDays: payload?.serviceDays || [],
    serviceSeriesStatus: payload?.serviceSeriesStatus || (payload?.serviceSeries ? payload.serviceSeries : []),
    ticketsBuckets: payload?.ticketsBuckets || [],
    deliveriesSeriesStatus: payload?.deliveriesSeriesStatus || (payload?.deliveriesSeries ? payload.deliveriesSeries : []),

    // Summary numbers
    deliveriesTotals: payload?.deliveriesTotals || { tickets: 0, gallons: 0 },
    deliveriesAvgPrice: payload?.deliveriesAvgPrice || 0,
    svcCounts: payload?.svcCounts || { completed: 0 },
  };

  // small formatting helpers used by the UI
  function num(v) {
    try {
      if (v === null || v === undefined) return "0";
      return Number(v).toLocaleString();
    } catch (e) {
      return String(v || "0");
    }
  }

  // Format bucket keys depending on grouping (day/week/month/year).
  // If your aggregator already returns human-friendly labels, this will just
  // echo them back.
  function fmtKeyLabel(k, group) {
    if (!k && k !== 0) return "";
    // if it's already a string, return it
    if (typeof k === "string") return k;
    // if it's a date-like object, format it
    if (k instanceof Date) return k.toISOString().slice(0, 10);
    // otherwise stringify
    return String(k);
  }

  // Minimal Section / Card wrappers used by the layout
  function Section({ title, children, actions }) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {actions ? <div>{actions}</div> : null}
        </div>
        {children}
      </div>
    );
  }
  function Card({ children }) {
    return <div style={{ background: "#FFF", border: "1px solid #E6E6E6", borderRadius: 8, padding: 12 }}>{children}</div>;
  }

  // HBars: small helper to render horizontal bar list (wraps BarBreakdown)
  function HBars({ rows = [] }) {
    const cats = rows.map(r => r.name || r.technician || r.label || "");
    const values = rows.map(r => Number(r.value || r.revenue || r.count || 0));
    return (
      <BarBreakdown
        categories={cats}
        series={[{ name: "Value", data: values }]}
        horizontal={true}
        height={220}
        colors={["#0B6E99"]}
        yAxisFormatter={(v) => Math.round(v).toLocaleString()}
      />
    );
  }

  return <div style={{
    padding: 18
  }}>
      <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    }}>
        <h2 style={{
        margin: 0
      }}>Gibson Oil & Gas — KPI Dashboard</h2>
        <div>
          <button className="btn btn-outline" style={{
          marginRight: 8
        }}>Edit KPIs</button>
        </div>
      </div>

      {error && <div style={{
      background: '#fee2e2',
      padding: 12,
      borderRadius: 6,
      color: '#b91c1c',
      marginBottom: 12
    }}>{error}</div>}
      {loading && <div style={{
      marginBottom: 12
    }}>Loading dashboard...</div>}

      {/* KPI tiles */}
      <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 12,
      marginBottom: 18
    }}>
        <KpiCard title="Total Gallons (All C-Stores)" value={formatGallons(totalGallons)} />
        <KpiCard title="Service Revenue (This Week)" value={formatCurrency(serviceRevenueThisWeek)} />
        <KpiCard title="Current Tanks" value={Number(dashboardKpis.current_tanks || 0).toLocaleString()} />
        <KpiCard title="Customers Lost" value={Number(dashboardKpis.customers_lost || 0).toLocaleString()} />
        <KpiCard title="Customers Gained" value={Number(dashboardKpis.customers_gained || 0).toLocaleString()} />
        <KpiCard title="Tanks Set" value={Number(dashboardKpis.tanks_set || 0).toLocaleString()} />
      </div>

      {/* Secondary tiles */}
      <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 12,
      marginBottom: 18
    }}>
        <KpiCard title="Total Revenue" value={formatCurrency(serviceRevenueThisWeek + deliveryRevenue)} subtitle="Service + Deliveries" />
        <KpiCard title="Service Revenue" value={formatCurrency(serviceRevenueThisWeek)} subtitle="Completed jobs" />
        <KpiCard title="Delivery Revenue" value={formatCurrency(deliveryRevenue)} subtitle={`${deliveryTickets} tickets`} />
        <KpiCard title="Delivery Gallons" value={`${Number(deliveryGallons || 0).toLocaleString()} gal`} subtitle={`Avg $${deliveryTickets ? (deliveryRevenue / deliveryTickets).toFixed(2) : '0.00'}/ticket`} />
        <KpiCard title="Service Jobs" value={completedJobs} subtitle="Completed" />
        <KpiCard title="Avg Miles Per Stop" value={`0.0`} subtitle="(miles / stops)" />
      </div>

      {/* Estimate boxes (keeps original look) */}
      <div style={{
      display: 'flex',
      gap: 12,
      marginBottom: 18
    }}>
        <div style={{
        flex: 1,
        minHeight: 90,
        background: '#EDE9FE',
        borderRadius: 8,
        padding: 16
      }}>
          <div style={{
          fontSize: 12,
          color: '#6D28D9',
          fontWeight: 700
        }}>Open Estimates</div>
          <div style={{
          fontSize: 22,
          fontWeight: 800,
          marginTop: 8
        }}>{formatCurrency(0)}</div>
          <div style={{
          fontSize: 12,
          color: '#9CA3AF'
        }}>0 total estimates</div>
        </div>
        <div style={{
        flex: 1,
        minHeight: 90,
        background: '#DCFCE7',
        borderRadius: 8,
        padding: 16
      }}>
          <div style={{
          fontSize: 12,
          color: '#059669',
          fontWeight: 700
        }}>Won Estimates</div>
          <div style={{
          fontSize: 22,
          fontWeight: 800,
          marginTop: 8
        }}>{formatCurrency(0)}</div>
          <div style={{
          fontSize: 12,
          color: '#9CA3AF'
        }}>Converted to jobs</div>
        </div>
        <div style={{
        flex: 1,
        minHeight: 90,
        background: '#FEE2E2',
        borderRadius: 8,
        padding: 16
      }}>
          <div style={{
          fontSize: 12,
          color: '#DC2626',
          fontWeight: 700
        }}>Lost Estimates</div>
          <div style={{
          fontSize: 22,
          fontWeight: 800,
          marginTop: 8
        }}>{formatCurrency(0)}</div>
          <div style={{
          fontSize: 12,
          color: '#9CA3AF'
        }}>Not converted</div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Section title="Service Jobs by Status">
          <Card>
            <BarBreakdown
              categories={(agg.serviceDays || []).slice(-MAX_CHART_ENTRIES)}
              series={(agg.serviceSeriesStatus || []).map((s) => ({
                name: s.name,
                data: (s.values || s.data || []).slice(-MAX_CHART_ENTRIES),
              }))}
              height={280}
              stacked={true}
              colors={["#16A34A", "#4338CA", "#F59E0B", "#DC2626"]}
              yAxisFormatter={(val) => Math.round(val).toString()}
            />
          </Card>
        </Section>

        <Section
          title="Delivery Tickets by Status"
          actions={
            <select
              value={delivGroup}
              onChange={(e) => setDelivGroup(e.target.value)}
              style={{
                padding: "6px 10px",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                fontSize: 12,
              }}
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
              categories={((agg.ticketsBuckets || []).map((k) => fmtKeyLabel(k, delivGroup))).slice(-MAX_CHART_ENTRIES)}
              series={(agg.deliveriesSeriesStatus || []).map((s) => ({
                name: s.name,
                data: (s.values || s.data || []).slice(-MAX_CHART_ENTRIES),
              }))}
              height={280}
              stacked={true}
              colors={["#16A34A", "#4338CA", "#DC2626"]}
              yAxisFormatter={(val) => Math.round(val).toString()}
            />
          </Card>
        </Section>
      </div>

      {/* Truck and Product Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Section title="Top 10 Trucks by Revenue">
          <Card>
            <BarBreakdown
              categories={(agg.truckData || []).map((t) => t.truck || t.name)}
              series={[
                {
                  name: "Revenue",
                  data: (agg.truckData || []).map((t) => Number(t.revenue || t.amount || 0)),
                },
              ]}
              height={300}
              stacked={false}
              horizontal={true}
              colors={["#0B6E99"]}
              yAxisFormatter={(val) => "$" + Math.round(val).toLocaleString()}
            />
          </Card>
        </Section>

        <Section title="Product Mix (Revenue)">
          <Card>
            <DonutChart
              labels={(agg.productData || []).map((p) => p.product || p.name)}
              series={(agg.productData || []).map((p) => Number(p.revenue || p.amount || 0))}
              title="Total"
              height={300}
              colors={[
                "#0B6E99",
                "#00A99D",
                "#F5A623",
                "#9333EA",
                "#DC2626",
                "#16A34A",
                "#0891B2",
              ]}
            />
          </Card>
        </Section>
      </div>

      {/* Data Table Summary */}
      <Section title="Summary Statistics">
        <Card>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                TOTAL TICKETS
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {num(agg.deliveriesTotals?.tickets)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                TOTAL GALLONS
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {num(agg.deliveriesTotals?.gallons)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                AVG PRICE/GAL
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                ${(agg.deliveriesAvgPrice || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6B7280",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                SERVICE COMPLETED
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {num(agg.svcCounts?.completed)}
              </div>
            </div>
          </div>
        </Card>
      </Section>

      {/* Company Health card at the bottom */}
      <div style={{ marginTop: 18 }}>
        {typeof CompanyHealthCard === "function" ? <CompanyHealthCard /> : null}
      </div>
    </div>;
}
