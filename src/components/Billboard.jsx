// src/components/Billboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import RollingTicker from "./rollingticker";
import { markCustomerCompleted } from "../lib/markCustomerCompleted";

// Reusable UI components
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

function Table({ columns, rows, keyField }) {
  return (
    <div style={{ overflow: "auto", border: "1px solid #E5E7EB", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: "#F3F4F6" }}>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[keyField] ?? i} style={{ background: i % 2 ? "#FAFAFA" : "white" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "10px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                  {typeof c.render === "function" ? c.render(row[c.key], row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Billboard Component - Fully wired to authoritative service and delivery data
 * 
 * Features:
 * - Fetches services from service_jobs table
 * - Fetches deliveries from delivery_tickets table
 * - Displays RollingTicker for deliveries
 * - Shows deferred count computed from services where status='deferred'
 * - Implements Mark Completed functionality that updates authoritative data
 */
export default function Billboard() {
  const [services, setServices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch services from service_jobs table
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("service_jobs")
        .select("*")
        .order("job_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching services:", err);
      throw err;
    }
  };

  // Fetch deliveries from delivery_tickets table
  const fetchDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_tickets")
        .select("*")
        .order("delivery_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching deliveries:", err);
      throw err;
    }
  };

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [servicesData, deliveriesData] = await Promise.all([
          fetchServices(),
          fetchDeliveries(),
        ]);
        setServices(servicesData);
        setDeliveries(deliveriesData);
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [servicesData, deliveriesData] = await Promise.all([
        fetchServices(),
        fetchDeliveries(),
      ]);
      setServices(servicesData);
      setDeliveries(deliveriesData);
    } catch (err) {
      setError(err.message || "Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  // Handle mark completed
  const handleMarkCompleted = async (serviceId) => {
    try {
      // Call the client helper which will call the server endpoint or RPC
      const result = await markCustomerCompleted(serviceId);
      
      if (result.updatedService) {
        // Update local state with the updated service
        setServices((prev) =>
          prev.map((s) => (s.id === serviceId ? result.updatedService : s))
        );
      } else {
        // If no updatedService returned, re-fetch all services
        const freshServices = await fetchServices();
        setServices(freshServices);
      }
    } catch (err) {
      console.error("Error marking service completed:", err);
      alert("Failed to mark service as completed: " + (err.message || "Unknown error"));
    }
  };

  // Compute deferred count
  const deferredCount = useMemo(() => {
    return services.filter((s) => s.status === "deferred").length;
  }, [services]);

  // Compute service metrics
  const serviceMetrics = useMemo(() => {
    const completed = services.filter((s) => s.status === "completed").length;
    const scheduled = services.filter((s) => s.status === "scheduled").length;
    const inProgress = services.filter((s) => s.status === "in_progress").length;
    const totalRevenue = services.reduce((sum, s) => sum + (parseFloat(s.job_amount) || 0), 0);

    return { completed, scheduled, inProgress, deferred: deferredCount, totalRevenue };
  }, [services, deferredCount]);

  // Compute delivery metrics
  const deliveryMetrics = useMemo(() => {
    const totalGallons = deliveries.reduce((sum, d) => sum + (parseFloat(d.gallons_delivered) || 0), 0);
    const totalDeliveries = deliveries.length;

    return { totalGallons, totalDeliveries };
  }, [deliveries]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Loading Billboard data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: "#dc2626", fontSize: 16, marginBottom: 8 }}>Error: {error}</div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: "#111827",
            color: "white",
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header with refresh button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Billboard - Operations Overview</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: "white",
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
          }}
          aria-label="Refresh data"
        >
          🔄 {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Service Metrics Cards */}
      <Section title="Service Tracking Metrics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <Card
            title="Deferred Services"
            value={serviceMetrics.deferred}
            sub="Needs attention"
            style={{ borderColor: serviceMetrics.deferred > 0 ? "#FCA5A5" : "#E5E7EB" }}
          />
          <Card title="Completed" value={serviceMetrics.completed} sub="Jobs done" />
          <Card title="Scheduled" value={serviceMetrics.scheduled} sub="Upcoming" />
          <Card title="In Progress" value={serviceMetrics.inProgress} sub="Active now" />
          <Card
            title="Total Revenue"
            value={`$${serviceMetrics.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub="Service jobs"
          />
        </div>
      </Section>

      {/* Rolling Ticker for Deliveries */}
      <Section title="Delivery Metrics">
        <div style={{ marginBottom: 12 }}>
          <RollingTicker 
            items={deliveries.slice(0, 20).map((d) => ({
              label: d.store || "Unknown Store",
              value: `${(d.gallons_delivered || 0).toLocaleString()} gal`,
              change: null,
            }))}
            speed={80}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <Card
            title="Total Deliveries"
            value={deliveryMetrics.totalDeliveries}
            sub="Tickets logged"
          />
          <Card
            title="Total Gallons"
            value={deliveryMetrics.totalGallons.toLocaleString()}
            sub="Delivered"
          />
        </div>
      </Section>

      {/* Services Table */}
      <Section
        title="Recent Services"
        actions={
          <span style={{ fontSize: 12, color: "#6B7280" }}>
            {services.length} jobs | {deferredCount} deferred
          </span>
        }
      >
        <Table
          keyField="id"
          columns={[
            { key: "job_number", label: "Job #" },
            {
              key: "job_date",
              label: "Date",
              render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
            },
            { key: "customer_name", label: "Customer" },
            {
              key: "status",
              label: "Status",
              render: (v) => {
                const colors = {
                  completed: { bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" },
                  scheduled: { bg: "#E0E7FF", text: "#3730A3", border: "#C7D2FE" },
                  in_progress: { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
                  deferred: { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
                  canceled: { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
                };
                const style = colors[v] || colors.canceled;
                return (
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      fontSize: 12,
                      background: style.bg,
                      color: style.text,
                      border: `1px solid ${style.border}`,
                    }}
                  >
                    {v || "unknown"}
                  </span>
                );
              },
            },
            {
              key: "job_amount",
              label: "Amount",
              render: (v) => (v ? `$${parseFloat(v).toLocaleString()}` : "—"),
            },
            { key: "primary_tech", label: "Tech" },
            {
              key: "actions",
              label: "Actions",
              render: (_, row) => {
                if (row.status === "deferred" || row.status === "scheduled") {
                  return (
                    <button
                      onClick={() => handleMarkCompleted(row.id)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #10B981",
                        background: "white",
                        color: "#10B981",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      aria-label={`Mark job ${row.job_number} as completed`}
                    >
                      Mark Completed
                    </button>
                  );
                }
                return "—";
              },
            },
          ]}
          rows={services.slice(0, 20)}
        />
      </Section>
    </div>
  );
}
