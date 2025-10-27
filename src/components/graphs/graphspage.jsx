import React, { useEffect, useState } from 'react';
import TimeRangePicker from './TimeRangePicker';
import MetricSelector from './MetricSelector';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';

/**
 * GraphsPage
 * - UI for selecting source, metric, granularity and date range
 * - Fetches /api/metrics-timeseries and displays chart(s)
 *
 * NOTE: This expects the server API endpoint /api/metrics-timeseries to exist (see backend work).
 */

const DEFAULT_SOURCE = 'delivery_tickets';
const DEFAULT_GRANULARITY = 'day';

export default function GraphsPage() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [metric, setMetric] = useState('revenue'); // field to plot
  const [granularity, setGranularity] = useState(DEFAULT_GRANULARITY);
  const [range, setRange] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 30);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  });
  const [compare, setCompare] = useState('none'); // none | prev_period | custom
  const [compareRange, setCompareRange] = useState(null);
  const [data, setData] = useState([]);
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSeries = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        source,
        start: range.start,
        end: range.end,
        granularity,
        compare
      });
      if (compare === 'custom' && compareRange) {
        params.set('compareStart', compareRange.start);
        params.set('compareEnd', compareRange.end);
      }
      const url = `/api/metrics-timeseries?${params.toString()}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
      }
      const json = await resp.json();
      setData((json.data || []).map(d => ({ ...d })));
      setCompareData(json.compareData || null);
    } catch (err) {
      console.error('Failed to fetch series', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, metric, granularity, range.start, range.end, compare, compareRange]);

  const xKey = granularity === 'day' ? 'day' : granularity === 'week' ? 'week_start' : 'month_start';

  return (
    <div style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 12 }}>Graphs</h2>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Source</label>
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="service_jobs">Service Tracking</option>
            <option value="delivery_tickets">Delivery Tickets</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Metric</label>
          <MetricSelector source={source} metric={metric} onChange={setMetric} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Granularity</label>
          <select value={granularity} onChange={e => setGranularity(e.target.value)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 4 }}>Range</label>
          <TimeRangePicker range={range} setRange={setRange} />
        </div>

        <div style={{ minWidth: 180 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Compare</label>
          <select value={compare} onChange={e => setCompare(e.target.value)}>
            <option value="none">None</option>
            <option value="prev_period">Previous Period</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {compare === 'custom' && (
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>Compare Range</label>
            <TimeRangePicker range={compareRange || range} setRange={r => setCompareRange(r)} />
          </div>
        )}
      </div>

      <div style={{ borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', padding: 12 }}>
        {loading ? (
          <div>Loading chart…</div>
        ) : error ? (
          <div style={{ color: '#c00' }}>Error: {error}</div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={data}>
              <CartesianGrid stroke="#eee" />
              <XAxis dataKey={xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={metric} stroke="#2b8aef" dot={false} />
              {compareData && (
                <Line type="monotone" data={compareData} dataKey={metric} stroke="#ff7a7a" dot={false} name="comparison" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ marginTop: 10, color: '#666', fontSize: 13 }}>
        Tip: use the range selector and granularity to change levels of detail. The chart expects the server endpoint /api/metrics-timeseries (source, start, end, granularity, compare).
      </div>
    </div>
  );
}
