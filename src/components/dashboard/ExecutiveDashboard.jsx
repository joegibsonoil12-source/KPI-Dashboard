import React, { useEffect, useState } from "react";
import { getBillboardSummary } from "../../lib/fetchMetricsClient";
import { fetchDashboardKpis } from "../../lib/dashboardKpis";
import CompanyHealthCard from "../CompanyHealthCard";

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

      {/* Chart placeholder */}
      <div style={{
      marginTop: 12
    }}>
        <h3>Combined Revenue Trend (Daily)</h3>
        <div style={{
        height: 240,
        borderRadius: 8,
        border: '1px solid #E6E6E6',
        background: '#FFF'
      }}>
          <div style={{
          padding: 16,
          color: '#6B7280'
        }}>
            Chart will appear here. If numbers still zero, inspect getBillboardSummary() response in Network.
          </div>
        </div>
      </div>

      <div style={{
      marginTop: 18
    }}>
        {typeof CompanyHealthCard === 'function' ? <CompanyHealthCard /> : null}
      </div>
    </div>;
}
