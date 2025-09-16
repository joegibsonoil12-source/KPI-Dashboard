// src/pages/KPIs.jsx
import React, { useState, useEffect } from "react";
import KPICards from "../components/KPICards";

export default function KPIs() {
  const [kpiData, setKpiData] = useState({
    revenueMTD: 0,
    gallonsMTD: 0,
    avgOrderValue: 0,
    onTimePercentage: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [supabaseAvailable, setSupabaseAvailable] = useState(false);

  useEffect(() => {
    async function loadKPIData() {
      // Try to import Supabase client dynamically
      try {
        const { supabase } = await import("../lib/supabaseClient");
        setSupabaseAvailable(true);
        
        // Fetch KPI data from views
        const [
          revenueMTDResult,
          gallonsMTDResult,
          avgOrderValueResult,
          onTimePercentageResult,
          deliveriesResult,
          invoicesResult
        ] = await Promise.all([
          supabase.from("revenue_mtd").select("*").single(),
          supabase.from("gallons_sold_mtd").select("*").single(),
          supabase.from("avg_order_value_mtd").select("*").single(),
          supabase.from("deliveries_on_time_pct_mtd").select("*").single(),
          supabase
            .from("deliveries")
            .select("delivery_number, customer_id, scheduled_date, delivery_date, gallons_delivered, total_amount, status, customers(name)")
            .order("delivery_date", { ascending: false })
            .limit(10),
          supabase
            .from("invoices")
            .select("invoice_number, customer_id, invoice_date, due_date, total_amount, status, customers(name)")
            .in("status", ["sent", "partial", "overdue"])
            .order("due_date", { ascending: true })
            .limit(10)
        ]);

        // Set KPI data
        setKpiData({
          revenueMTD: revenueMTDResult.data?.revenue || 0,
          gallonsMTD: gallonsMTDResult.data?.gallons_sold || 0,
          avgOrderValue: avgOrderValueResult.data?.avg_order_value || 0,
          onTimePercentage: onTimePercentageResult.data?.on_time_percentage || 0,
        });

        // Set recent deliveries
        setRecentDeliveries(deliveriesResult.data || []);
        
        // Set outstanding invoices
        setOutstandingInvoices(invoicesResult.data || []);
        
      } catch (err) {
        console.log("Supabase not available or error loading data:", err.message);
        setSupabaseAvailable(false);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadKPIData();
  }, []);

  if (!supabaseAvailable) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          KPI Dashboard
        </h1>
        <div style={{
          padding: 20,
          backgroundColor: "#FEF3C7",
          border: "1px solid #F59E0B",
          borderRadius: 8,
          color: "#92400E"
        }}>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Supabase Configuration Required</h3>
          <p style={{ margin: 0 }}>
            To view live KPI data, please configure your Supabase settings in the app.
            Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment.
          </p>
        </div>
        
        {/* Show placeholder KPI cards */}
        <div style={{ marginTop: 24 }}>
          <KPICards 
            revenueMTD={45672.50}
            gallonsMTD={18945}
            avgOrderValue={1287.30}
            onTimePercentage={94.2}
            isDemo={true}
          />
        </div>
        
        {/* Demo tables */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
          <div>
            <h3 style={{ marginBottom: 12 }}>Recent Deliveries (Demo)</h3>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#F9FAFB" }}>
                  <tr>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Delivery #</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Customer</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Gallons</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>DEL2024005</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>Odessa Truck Stop</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>1,200</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>
                      <span style={{ padding: "4px 8px", fontSize: 12, backgroundColor: "#D1FAE5", color: "#065F46", borderRadius: 4 }}>
                        Delivered
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>DEL2024004</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>Desert Rose Restaurant</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>510</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>
                      <span style={{ padding: "4px 8px", fontSize: 12, backgroundColor: "#D1FAE5", color: "#065F46", borderRadius: 4 }}>
                        Delivered
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div>
            <h3 style={{ marginBottom: 12 }}>Outstanding Invoices (Demo)</h3>
            <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#F9FAFB" }}>
                  <tr>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Invoice #</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Customer</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>INV2024002</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>Johnson Residence</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>$436.59</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>2025-01-01</td>
                  </tr>
                  <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>INV2024004</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>Desert Rose Restaurant</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>$1,349.46</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>2025-01-03</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          KPI Dashboard
        </h1>
        <p>Loading KPI data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
          KPI Dashboard
        </h1>
        <div style={{
          padding: 20,
          backgroundColor: "#FEE2E2",
          border: "1px solid #F87171",
          borderRadius: 8,
          color: "#DC2626"
        }}>
          <h3 style={{ margin: 0, marginBottom: 8 }}>Error Loading Data</h3>
          <p style={{ margin: 0 }}>
            Failed to load KPI data: {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        KPI Dashboard
      </h1>
      
      {/* KPI Cards */}
      <KPICards 
        revenueMTD={kpiData.revenueMTD}
        gallonsMTD={kpiData.gallonsMTD}
        avgOrderValue={kpiData.avgOrderValue}
        onTimePercentage={kpiData.onTimePercentage}
      />
      
      {/* Data Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div>
          <h3 style={{ marginBottom: 12 }}>Recent Deliveries</h3>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ backgroundColor: "#F9FAFB" }}>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Delivery #</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Customer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Gallons</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((delivery, index) => (
                  <tr key={delivery.delivery_number} style={{ borderTop: index > 0 ? "1px solid #E5E7EB" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{delivery.delivery_number}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{delivery.customers?.name || "Unknown"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{delivery.gallons_delivered?.toLocaleString()}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>
                      <span style={{ 
                        padding: "4px 8px", 
                        fontSize: 12, 
                        backgroundColor: delivery.status === "delivered" ? "#D1FAE5" : "#FEF3C7",
                        color: delivery.status === "delivered" ? "#065F46" : "#92400E",
                        borderRadius: 4 
                      }}>
                        {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentDeliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#6B7280" }}>
                      No recent deliveries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 style={{ marginBottom: 12 }}>Outstanding Invoices</h3>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ backgroundColor: "#F9FAFB" }}>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Invoice #</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Customer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Amount</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#374151" }}>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {outstandingInvoices.map((invoice, index) => (
                  <tr key={invoice.invoice_number} style={{ borderTop: index > 0 ? "1px solid #E5E7EB" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{invoice.invoice_number}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{invoice.customers?.name || "Unknown"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>${invoice.total_amount?.toLocaleString()}</td>
                    <td style={{ padding: "12px 16px", fontSize: 14 }}>{new Date(invoice.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {outstandingInvoices.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#6B7280" }}>
                      No outstanding invoices
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}