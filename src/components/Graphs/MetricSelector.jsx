/**
 * MetricSelector Component
 * 
 * Selector for choosing data source and metric type
 * Features:
 * - Source selector (Service Jobs, Delivery Tickets)
 * - Metric selector (varies based on source)
 * - Granularity selector (Day, Week, Month)
 */

import React from 'react';

const SERVICE_METRICS = [
  { value: 'job_count', label: 'Job Count' },
  { value: 'revenue', label: 'Revenue' },
];

const DELIVERY_METRICS = [
  { value: 'ticket_count', label: 'Ticket Count' },
  { value: 'total_gallons', label: 'Total Gallons' },
  { value: 'revenue', label: 'Revenue' },
];

export default function MetricSelector({
  source,
  metric,
  granularity,
  onSourceChange,
  onMetricChange,
  onGranularityChange,
}) {
  // Get available metrics based on selected source
  const availableMetrics = source === 'service' ? SERVICE_METRICS : DELIVERY_METRICS;

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Metrics</h3>
      
      <div className="grid grid-cols-3 gap-4">
        {/* Source selector */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">Data Source</label>
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="service">Service Jobs</option>
            <option value="delivery">Delivery Tickets</option>
          </select>
        </div>

        {/* Metric selector */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">Metric</label>
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableMetrics.map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Granularity selector */}
        <div>
          <label className="block text-xs text-slate-600 mb-1">Granularity</label>
          <select
            value={granularity}
            onChange={(e) => onGranularityChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>
    </div>
  );
}
