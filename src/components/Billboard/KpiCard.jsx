// src/components/Billboard/KpiCard.jsx
import React from 'react';
import '../../styles/billboard.css';

/**
 * KpiCard component
 * Displays a KPI metric with title, value, subtitle, status indicator, and optional trend
 * 
 * @param {string} title - Main label for the KPI
 * @param {string|number} value - The primary metric value to display
 * @param {string} sub - Subtitle or secondary information
 * @param {string} status - Status indicator: 'ok', 'warn', or 'neg'
 * @param {string} trend - Optional trend indicator (e.g., "+5.2%", "↑ 12")
 * @param {string} ariaLabel - Accessible label for screen readers
 */
export default function KpiCard({ title, value, sub, status = 'ok', trend, ariaLabel }) {
  // Map status to CSS classes and colors
  const statusColors = {
    ok: '#10b981',    // green
    warn: '#f59e0b',  // amber
    neg: '#ef4444',   // red
  };

  const statusColor = statusColors[status] || statusColors.ok;

  return (
    <div 
      className="kpi-card" 
      role="group" 
      aria-label={ariaLabel || `${title}: ${value}`}
      style={{
        borderLeft: `4px solid ${statusColor}`,
        padding: '16px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#6b7280', 
            fontWeight: 500,
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.025em',
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '1.875rem', 
            fontWeight: 700, 
            color: '#111827',
            lineHeight: 1.2,
            marginBottom: '4px',
          }}>
            {value}
          </div>
          {sub && (
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#9ca3af',
            }}>
              {sub}
            </div>
          )}
        </div>
        
        {trend && (
          <div style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: statusColor,
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: `${statusColor}15`,
          }}>
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
