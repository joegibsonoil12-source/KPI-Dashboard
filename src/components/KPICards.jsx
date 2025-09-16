// src/components/KPICards.jsx
import React from "react";

export default function KPICards({ revenueMTD, gallonsMTD, avgOrderValue, onTimePercentage, isDemo = false }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value) => {
    return `${value}%`;
  };

  const cardStyle = {
    backgroundColor: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    padding: 20,
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  };

  const titleStyle = {
    fontSize: 14,
    fontWeight: 500,
    color: "#6B7280",
    marginBottom: 8,
  };

  const valueStyle = {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  };

  const labelStyle = {
    fontSize: 12,
    color: "#9CA3AF",
  };

  const demoLabelStyle = {
    fontSize: 10,
    color: "#F59E0B",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
      {/* Revenue MTD Card */}
      <div style={cardStyle}>
        {isDemo && <div style={demoLabelStyle}>Demo Data</div>}
        <div style={titleStyle}>Revenue Month-to-Date</div>
        <div style={valueStyle}>{formatCurrency(revenueMTD)}</div>
        <div style={labelStyle}>Total revenue this month</div>
      </div>

      {/* Gallons MTD Card */}
      <div style={cardStyle}>
        {isDemo && <div style={demoLabelStyle}>Demo Data</div>}
        <div style={titleStyle}>Gallons Sold MTD</div>
        <div style={valueStyle}>{formatNumber(gallonsMTD)}</div>
        <div style={labelStyle}>Gallons delivered this month</div>
      </div>

      {/* Average Order Value Card */}
      <div style={cardStyle}>
        {isDemo && <div style={demoLabelStyle}>Demo Data</div>}
        <div style={titleStyle}>Avg Order Value</div>
        <div style={valueStyle}>{formatCurrency(avgOrderValue)}</div>
        <div style={labelStyle}>Average invoice amount</div>
      </div>

      {/* On-Time Delivery Card */}
      <div style={cardStyle}>
        {isDemo && <div style={demoLabelStyle}>Demo Data</div>}
        <div style={titleStyle}>On-Time Deliveries</div>
        <div style={valueStyle}>{formatPercentage(onTimePercentage)}</div>
        <div style={labelStyle}>Delivered on or before scheduled date</div>
      </div>
    </div>
  );
}