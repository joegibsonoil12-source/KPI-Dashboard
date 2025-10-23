/**
 * BillboardCards Component
 * 
 * Large metric cards for displaying key KPIs
 * Uses clamp() for responsive typography
 * Handles null values gracefully
 */

import React from 'react';
import '../../styles/billboard.css';

/**
 * Format a number value
 * @param {*} value - Value to format
 * @param {string} type - Format type
 * @returns {string} - Formatted value or "—"
 */
function formatMetricValue(value, type = 'number') {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (type) {
    case 'currency':
      return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'gallons':
      return Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
    default:
      return Number(value).toLocaleString();
  }
}

/**
 * BillboardCards component
 * 
 * @param {Object} props
 * @param {Object} props.metrics - Metrics object with named properties
 */
export default function BillboardCards({ metrics = {} }) {
  const cards = [
    {
      label: 'Completed Services',
      value: metrics.completedServices,
      type: 'number',
      color: '#10b981',
    },
    {
      label: 'Delivery Tickets',
      value: metrics.deliveryTickets,
      type: 'number',
      color: '#3b82f6',
    },
    {
      label: 'Total Gallons',
      value: metrics.totalGallons,
      type: 'gallons',
      color: '#f59e0b',
    },
    {
      label: 'Total Revenue',
      value: metrics.totalRevenue,
      type: 'currency',
      color: '#8b5cf6',
    },
    {
      label: 'Pipeline',
      value: metrics.pipelineRevenue,
      type: 'currency',
      color: '#ec4899',
    },
  ];

  return (
    <div className="billboard-cards-container">
      {cards.map((card, index) => (
        <div key={index} className="billboard-card" style={{ borderTopColor: card.color }}>
          <div className="billboard-card-label">{card.label}</div>
          <div className="billboard-card-value" style={{ color: card.color }}>
            {formatMetricValue(card.value, card.type)}
          </div>
          {card.type === 'gallons' && card.value !== null && card.value !== undefined && (
            <div className="billboard-card-unit">gallons</div>
          )}
        </div>
      ))}
    </div>
  );
}
