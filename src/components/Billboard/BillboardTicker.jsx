/**
 * BillboardTicker Component
 * 
 * CSS-only marquee ribbon that displays scrolling metrics
 * Handles null values gracefully by showing "—"
 */

import React from 'react';
import '../../styles/billboard.css';

/**
 * Format a value with null handling
 * @param {*} value - Value to format
 * @param {string} type - Format type: 'number', 'currency', 'percent', 'text'
 * @returns {string} - Formatted value or "—" if null/undefined
 */
function formatValue(value, type = 'text') {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  switch (type) {
    case 'number':
      return Number(value).toLocaleString();
    case 'currency':
      return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percent':
      return `${Number(value).toFixed(1)}%`;
    case 'gallons':
      return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} gal`;
    default:
      return String(value);
  }
}

/**
 * BillboardTicker component
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of ticker items { label, value, type }
 * @param {number} props.speed - Animation speed (default: 80)
 */
export default function BillboardTicker({ items = [], speed = 80 }) {
  // Duplicate items to create seamless loop
  const duplicatedItems = [...items, ...items];

  return (
    <div className="billboard-ticker-container">
      <div className="billboard-ticker" style={{ animationDuration: `${speed}s` }}>
        {duplicatedItems.map((item, index) => (
          <div key={index} className="billboard-ticker-item">
            <span className="billboard-ticker-label">{item.label || '—'}</span>
            <span className="billboard-ticker-value">
              {formatValue(item.value, item.type || 'text')}
            </span>
            {item.change !== null && item.change !== undefined && (
              <span className={`billboard-ticker-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
