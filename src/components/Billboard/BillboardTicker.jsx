/**
 * BillboardTicker Component
 * 
 * NASDAQ-style scrolling marquee using react-fast-marquee
 * Displays key metrics with robust null handling (shows 0 instead of blanks)
 */

import React from 'react';
import Marquee from 'react-fast-marquee';
import '../../styles/billboard.css';

/**
 * Format a value with explicit zero fallback
 * @param {*} value - Value to format
 * @param {string} type - Format type: 'number', 'currency', 'percent', 'gallons', 'text'
 * @returns {string} - Formatted value or "0" for numeric types, "—" for text
 */
function formatValue(value, type = 'text') {
  // Handle null/undefined/empty by type
  if (value === null || value === undefined || value === '') {
    switch (type) {
      case 'number':
        return '0';
      case 'currency':
        return '$0.00';
      case 'percent':
        return '0.0%';
      case 'gallons':
        return '0.0 gal';
      default:
        return '—';
    }
  }

  // Format based on type
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
 * @param {Array} props.items - Array of ticker items { label, value, type, change }
 * @param {number} props.speed - Scroll speed in pixels per second (default: 50)
 */
export default function BillboardTicker({ items = [], speed = 50 }) {
  // Ensure we always have items to display (use zeros if empty)
  const displayItems = items.length > 0 ? items : [
    { label: 'Completed Services', value: 0, type: 'number' },
    { label: 'Service Revenue', value: 0, type: 'currency' },
    { label: 'Delivery Tickets', value: 0, type: 'number' },
    { label: 'Gallons Delivered', value: 0, type: 'gallons' },
    { label: 'Total Revenue', value: 0, type: 'currency' },
  ];

  return (
    <div className="billboard-ticker-container">
      <Marquee 
        speed={speed} 
        gradient={false}
        pauseOnHover={true}
        className="billboard-ticker"
      >
        {displayItems.map((item, index) => (
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
      </Marquee>
    </div>
  );
}
