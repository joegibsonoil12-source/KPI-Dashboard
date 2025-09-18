import React from "react";
import KpiChart from "../components/KpiChart";
import "../styles/gibson.css";

export default function Dashboard() {
  return (
    <div className="gibson-bg" style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 12 }}>KPI Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
        <KpiChart metric="production" title="Production Volume (barrels)" chartType="bar" />
        <KpiChart metric="revenue" title="Revenue (USD)" chartType="line" />
        <KpiChart metric="downtime" title="Downtime (hours)" chartType="line" />
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
        <KpiChart metric="oee" title="OEE (%)" chartType="line" />
        <KpiChart metric="cost-per-unit" title="Cost per Unit (USD)" chartType="line" />
      </div>
    </div>
  );
}
