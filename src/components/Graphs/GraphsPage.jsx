/**
 * GraphsPage Component
 * 
 * Main page for displaying time series graphs of service and delivery metrics
 * Features:
 * - Time range selection with compare modes
 * - Metric selection (source, metric type, granularity)
 * - Line charts with recharts (primary and comparison series)
 * - Responsive layout
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import TimeRangePicker from './TimeRangePicker';
import MetricSelector from './MetricSelector';
import { getMetricsTimeseries } from '../../lib/fetchMetricsClient';

/**
 * Format date for display based on granularity
 */
function formatDate(dateStr, granularity) {
  const date = new Date(dateStr);
  
  if (granularity === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (granularity === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (granularity === 'month') {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }
  return dateStr;
}

/**
 * Format value based on metric type
 */
function formatValue(value, metric) {
  if (metric.includes('revenue') || metric.includes('amount')) {
    return `$${parseFloat(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (metric.includes('gallons')) {
    return `${parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} gal`;
  } else {
    return parseFloat(value).toLocaleString();
  }
}

/**
 * Get default date range (last 30 days)
 */
function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function GraphsPage() {
  const defaultRange = getDefaultDateRange();
  
  // State for filters
  const [source, setSource] = useState('service');
  const [metric, setMetric] = useState('completed_revenue');
  const [granularity, setGranularity] = useState('day');
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [compareMode, setCompareMode] = useState('none');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');

  // State for data
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Update metric when source changes to ensure valid combination
   */
  useEffect(() => {
    if (source === 'service') {
      setMetric('completed_revenue');
    } else if (source === 'delivery') {
      setMetric('revenue');
    }
  }, [source]);

  /**
   * Fetch data whenever filters change
   */
  useEffect(() => {
    fetchData();
  }, [source, metric, granularity, startDate, endDate, compareMode, compareStart, compareEnd]);

  /**
   * Fetch timeseries data
   */
  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const options = {
        source,
        start,
        end,
        granularity,
      };

      // Add comparison if requested
      if (compareMode === 'previous') {
        options.compare = 'previous';
      } else if (compareMode === 'custom' && compareStart && compareEnd) {
        options.compare = 'custom';
        options.compareStart = new Date(compareStart);
        options.compareEnd = new Date(compareEnd);
      }

      const result = await getMetricsTimeseries(options);

      if (result.error) {
        setError(result.error);
        setChartData([]);
        setLoading(false);
        return;
      }

      // Transform data for recharts
      const dateColumnMap = {
        day: 'date',
        week: 'week_start',
        month: 'month_start',
      };
      const dateColumn = dateColumnMap[granularity];

      // Build chart data
      const transformedData = (result.primary || []).map(item => ({
        date: formatDate(item[dateColumn], granularity),
        value: parseFloat(item[metric]) || 0,
      }));

      // Add comparison data if available
      if (result.comparison && result.comparison.length > 0) {
        const comparisonMap = {};
        result.comparison.forEach(item => {
          const formattedDate = formatDate(item[dateColumn], granularity);
          comparisonMap[formattedDate] = parseFloat(item[metric]) || 0;
        });

        transformedData.forEach((item, index) => {
          // Try to match comparison data by index
          if (result.comparison[index]) {
            item.comparison = parseFloat(result.comparison[index][metric]) || 0;
          }
        });
      }

      setChartData(transformedData);
      setLoading(false);
    } catch (err) {
      console.error('[GraphsPage] Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
      setChartData([]);
      setLoading(false);
    }
  }

  /**
   * Get chart title
   */
  function getChartTitle() {
    const metricLabels = {
      total_jobs: 'Total Jobs',
      completed_jobs: 'Completed Jobs',
      scheduled_jobs: 'Scheduled Jobs',
      deferred_jobs: 'Deferred Jobs',
      completed_revenue: 'Completed Revenue',
      pipeline_revenue: 'Pipeline Revenue',
      total_amount: 'Total Amount',
      total_tickets: 'Total Tickets',
      total_gallons: 'Total Gallons',
      revenue: 'Revenue',
      avg_ticket_amount: 'Average Ticket Amount',
    };

    const sourceLabels = {
      service: 'Service Jobs',
      delivery: 'Delivery Tickets',
    };

    const granularityLabels = {
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
    };

    return `${sourceLabels[source]} - ${metricLabels[metric]} (${granularityLabels[granularity]})`;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Metrics Graphs</h1>

      {/* Filters */}
      <MetricSelector
        source={source}
        metric={metric}
        granularity={granularity}
        onSourceChange={setSource}
        onMetricChange={setMetric}
        onGranularityChange={setGranularity}
      />

      <TimeRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        compareMode={compareMode}
        onCompareModeChange={setCompareMode}
        compareStart={compareStart}
        compareEnd={compareEnd}
        onCompareStartChange={setCompareStart}
        onCompareEndChange={setCompareEnd}
      />

      {/* Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{getChartTitle()}</h2>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">Loading data...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">Error: {error}</div>
          </div>
        )}

        {!loading && !error && chartData.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500">No data available for the selected period</div>
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (metric.includes('revenue') || metric.includes('amount')) {
                    return `$${(value / 1000).toFixed(0)}k`;
                  }
                  return value.toLocaleString();
                }}
              />
              <Tooltip
                formatter={(value) => formatValue(value, metric)}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Current Period"
                dot={{ r: 4 }}
              />
              {chartData.some(d => d.comparison !== undefined) && (
                <Line
                  type="monotone"
                  dataKey="comparison"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Comparison Period"
                  dot={{ r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
