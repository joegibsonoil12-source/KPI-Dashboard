import React from 'react';

/**
 * Props:
 * - range: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 * - setRange: function
 *
 * This is intentionally simple and uses native <input type="date"> to avoid new deps.
 */

export default function TimeRangePicker({ range, setRange }) {
  const r = range || { start: '', end: '' };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="date"
        value={r.start || ''}
        onChange={e => setRange({ start: e.target.value, end: r.end })}
      />
      <span style={{ padding: '0 6px' }}>—</span>
      <input
        type="date"
        value={r.end || ''}
        onChange={e => setRange({ start: r.start, end: e.target.value })}
      />
    </div>
  );
}
