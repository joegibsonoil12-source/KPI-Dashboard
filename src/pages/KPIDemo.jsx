// Minimal demo page for testing
import React from "react";
import KPICards from "../components/KPICards";

export default function KPIDemo() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
        KPI Dashboard (Demo)
      </h1>
      
      {/* Demo KPI Cards */}
      <KPICards 
        revenueMTD={45672.50}
        gallonsMTD={18945}
        avgOrderValue={1287.30}
        onTimePercentage={94.2}
        isDemo={true}
      />
      
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
                <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>DEL2024003</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>Midland Manufacturing Co</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>680</td>
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
                <tr style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>INV2024003</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>West Texas Diner</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>$892.25</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>2024-12-31</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}