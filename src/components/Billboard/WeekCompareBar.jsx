/**
 * WeekCompareBar Component
 * 
 * Displays This Week vs Last Week revenue comparison with:
 * - This Week revenue
 * - Last Week revenue
 * - Percent change
 * - Progressive fill bar that updates as data changes
 * 
 * Clean, accessible design matching the site aesthetic
 */

import React, { useMemo } from 'react';
import '../../styles/billboard.css';

// Reusable currency formatter (created once, reused across renders)
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * WeekCompareBar component
 * 
 * @param {Object} props
 * @param {number} props.thisWeekTotalRevenue - This week total revenue
 * @param {number} props.lastWeekTotalRevenue - Last week total revenue
 * @param {number} props.percentChange - Percent change
 */
export default function WeekCompareBar({ 
  thisWeekTotalRevenue = 0, 
  lastWeekTotalRevenue = 0, 
  percentChange = 0,
  scheduledJobs = 0,
  scheduledRevenue = 0,
}) {
  // Log scheduled metrics for debugging
  console.debug('[WeekCompareBar] Scheduled metrics:', {
    scheduledJobs,
    scheduledRevenue,
  });

  // Calculate percentage relative to last week (100% = matching last week)
  const percentOfLastWeek = lastWeekTotalRevenue > 0 
    ? (thisWeekTotalRevenue / lastWeekTotalRevenue) * 100 
    : (thisWeekTotalRevenue > 0 ? 100 : 0);

  // Determine color scheme based on performance (memoized)
  const colorScheme = useMemo(() => {
    if (percentOfLastWeek > 110) {
      return {
        bg: '#dcfce7',
        bar: '#10b981',
        text: '#166534',
        label: 'Strong Growth',
      };
    } else if (percentOfLastWeek >= 90) {
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
  }, [percentOfLastWeek]);

  // Cap the bar width at 150% for visual purposes
  const barWidth = Math.min(percentOfLastWeek, 150);

  // Format currency (reuses singleton formatter)
  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') return '$0.00';
    return currencyFormatter.format(value);
  };

  return (
    <div 
      className="week-compare-bar" 
      role="region" 
      aria-label="Week revenue comparison"
    >
      <div className="week-compare-header">
        <h3 className="week-compare-title">This Week vs Last Week</h3>
        <div 
          className="week-compare-status" 
          style={{ color: colorScheme.text, backgroundColor: colorScheme.bg }}
          aria-live="polite"
        >
          {colorScheme.label}
        </div>
      </div>

      <div className="week-compare-values">
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">This Week</span>
          <span 
            className="week-compare-value-amount" 
            style={{ color: colorScheme.bar }}
            aria-label={`This week revenue: ${formatCurrency(thisWeekTotalRevenue)}`}
          >
            {formatCurrency(thisWeekTotalRevenue)}
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Last Week</span>
          <span 
            className="week-compare-value-amount"
            aria-label={`Last week revenue: ${formatCurrency(lastWeekTotalRevenue)}`}
          >
            {formatCurrency(lastWeekTotalRevenue)}
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Change</span>
          <span 
            className={`week-compare-value-amount ${percentChange >= 0 ? 'positive' : 'negative'}`}
            style={{ color: colorScheme.text }}
            aria-label={`Change: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`}
          >
            {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Scheduled Jobs</span>
          <span 
            className="week-compare-value-amount"
            aria-label={`Scheduled jobs: ${scheduledJobs}`}
          >
            {scheduledJobs}
          </span>
        </div>
        <div className="week-compare-value-item">
          <span className="week-compare-value-label">Scheduled Revenue</span>
          <span 
            className="week-compare-value-amount"
            style={{ color: '#8b5cf6' }}
            aria-label={`Scheduled revenue: ${formatCurrency(scheduledRevenue)}`}
          >
            {formatCurrency(scheduledRevenue)}
          </span>
        </div>
      </div>

      <div 
        className="week-compare-bar-container" 
        style={{ backgroundColor: colorScheme.bg }}
        role="progressbar"
        aria-valuenow={Math.round(percentOfLastWeek)}
        aria-valuemin="0"
        aria-valuemax="150"
        aria-label={`Performance at ${Math.round(percentOfLastWeek)}% of last week`}
      >
        <div 
          className="week-compare-bar-fill"
          style={{ 
            width: `${barWidth}%`,
            backgroundColor: colorScheme.bar,
            transition: 'width 0.6s ease',
          }}
        >
          <span className="week-compare-bar-label">
            {percentOfLastWeek.toFixed(0)}%
          </span>
        </div>
      </div>

      <div className="week-compare-legend" aria-label="Performance legend">
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
