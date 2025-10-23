/**
 * WeekCompareMeter Component
 * 
 * Horizontal bar meter comparing This Week vs Last Week revenue
 * Color logic:
 * - Green: >110% (growth)
 * - Amber: 90-110% (stable)
 * - Red: <90% (decline)
 */

import React from 'react';
import '../../styles/billboard.css';

/**
 * Get color based on percentage
 * @param {number} percent - Percent change
 * @returns {Object} - Color scheme
 */
function getColorScheme(percent) {
  if (percent > 110) {
    return {
      bg: '#dcfce7',
      bar: '#10b981',
      text: '#166534',
      label: 'Strong Growth',
    };
  } else if (percent >= 90) {
    return {
      bg: '#fef3c7',
      bar: '#f59e0b',
      text: '#92400e',
      label: 'Stable',
    };
  } else {
    return {
      bg: '#fee2e2',
      bar: '#ef4444',
      text: '#991b1b',
      label: 'Needs Attention',
    };
  }
}

/**
 * WeekCompareMeter component
 * 
 * @param {Object} props
 * @param {number} props.thisWeek - This week total revenue
 * @param {number} props.lastWeek - Last week total revenue
 * @param {number} props.percentChange - Percent change
 */
export default function WeekCompareMeter({ thisWeek = 0, lastWeek = 0, percentChange = 0 }) {
  // Calculate percentage relative to last week (100% = matching last week)
  const percentOfLastWeek = lastWeek > 0 ? (thisWeek / lastWeek) * 100 : (thisWeek > 0 ? 100 : 0);
  const colorScheme = getColorScheme(percentOfLastWeek);

  // Cap the bar width at 150% for visual purposes
  const barWidth = Math.min(percentOfLastWeek, 150);

  // Format currency
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—';
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="week-compare-meter">
      <div className="week-compare-header">
        <h3 className="week-compare-title">This Week vs Last Week</h3>
        <div className="week-compare-status" style={{ color: colorScheme.text, backgroundColor: colorScheme.bg }}>
          {colorScheme.label}
        </div>
      </div>

      <div className="week-compare-values">
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">This Week</span>
          <span className="week-compare-value-amount" style={{ color: colorScheme.bar }}>
            {formatCurrency(thisWeek)}
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Last Week</span>
          <span className="week-compare-value-amount">
            {formatCurrency(lastWeek)}
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Change</span>
          <span 
            className={`week-compare-value-amount ${percentChange >= 0 ? 'positive' : 'negative'}`}
            style={{ color: colorScheme.text }}
          >
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="week-compare-bar-container" style={{ backgroundColor: colorScheme.bg }}>
        <div 
          className="week-compare-bar"
          style={{ 
            width: `${barWidth}%`,
            backgroundColor: colorScheme.bar,
          }}
        >
          <span className="week-compare-bar-label">
            {percentOfLastWeek.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="week-compare-legend">
        <div className="week-compare-legend-item">
          <div className="week-compare-legend-marker" style={{ backgroundColor: '#ef4444' }}></div>
          <span>&lt;90% - Needs Attention</span>
        </div>
        <div className="week-compare-legend-item">
          <div className="week-compare-legend-marker" style={{ backgroundColor: '#f59e0b' }}></div>
          <span>90-110% - Stable</span>
        </div>
        <div className="week-compare-legend-item">
          <div className="week-compare-legend-marker" style={{ backgroundColor: '#10b981' }}></div>
          <span>&gt;110% - Strong Growth</span>
        </div>
      </div>
    </div>
  );
}
