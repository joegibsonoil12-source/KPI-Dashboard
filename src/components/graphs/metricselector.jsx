import React from 'react';

/**
 * MetricSelector selects which field to plot depending on the selected source.
 * It emits the field name used by the API/views.
 *
 * Service jobs view fields: job_count, revenue
 * Delivery tickets view fields: ticket_count, total_gallons, revenue
 */

export default function MetricSelector({ source, metric, onChange }) {
  const options = source === 'service_jobs'
    ? [
        { value: 'job_count', label: 'Jobs (count)' },
        { value: 'revenue', label: 'Revenue' }
      ]
    : [
        { value: 'ticket_count', label: 'Tickets (count)' },
        { value: 'total_gallons', label: 'Gallons' },
        { value: 'revenue', label: 'Revenue' }
      ];

  return (
    <select value={metric} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
