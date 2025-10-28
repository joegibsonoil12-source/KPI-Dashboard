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
  const [metric, setMetric] = useState('revenue');
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
  const [debugInfo, setDebugInfo] = useState(null);
  const [totals, setTotals] = useState(null);

  /**
   * Update metric when source changes to ensure valid combination
   */
  useEffect(() => {
    if (source === 'service') {
      setMetric('revenue');
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

      // Store debug info and totals
      setDebugInfo(result.debug || null);
      setTotals(result.totals || null);

      if (result.error) {
        setError(result.error);
        setChartData([]);
        setLoading(false);
        return;
      }

      // Transform data for recharts
      const dateColumnMap = {
        day: 'day',
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
      job_count: 'Job Count',
      ticket_count: 'Ticket Count',
      total_gallons: 'Total Gallons',
      revenue: 'Revenue',
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

      {/* Warning/Debug Messages */}
      {debugInfo?.primary?.usedFallback && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Using fallback aggregation from base tables
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  The database view <code className="bg-yellow-100 px-1 py-0.5 rounded">{debugInfo.primary.viewName}</code> was not found. 
                  Data is being aggregated from the base tables in real-time, which may be slower.
                </p>
                <p className="mt-2">
                  <strong>To improve performance:</strong> Run <code className="bg-yellow-100 px-1 py-0.5 rounded">migrations/001_create_metrics_views.sql</code> in your Supabase SQL Editor.
                </p>
                {totals?.primary && (
                  <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                    <p className="font-semibold text-yellow-900 mb-1">Aggregated Totals:</p>
                    <ul className="text-xs space-y-1">
                      <li>• Records: {totals.primary.recordCount}</li>
                      {source === 'service' && (
                        <>
                          <li>• Total Jobs: {totals.primary.totalJobs?.toLocaleString()}</li>
                          <li>• Total Revenue: ${totals.primary.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                        </>
                      )}
                      {source === 'delivery' && (
                        <>
                          <li>• Total Tickets: {totals.primary.totalTickets?.toLocaleString()}</li>
                          <li>• Total Gallons: {totals.primary.totalGallons?.toLocaleString(undefined, { maximumFractionDigits: 1 })}</li>
                          <li>• Total Revenue: ${totals.primary.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data quality warnings */}
      {!loading && !error && chartData.length > 0 && (() => {
        const hasNegativeRevenue = chartData.some(d => d.value < 0);
        const hasUnusuallyHighValue = chartData.some(d => 
          (metric.includes('revenue') || metric.includes('amount')) && d.value > 1000000
        );
        
        if (hasNegativeRevenue || hasUnusuallyHighValue) {
          return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-blue-800">
                    Data Quality Notice
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    {hasNegativeRevenue && (
                      <p>⚠️ Some data points show negative revenue values. Please verify the data in the base tables.</p>
                    )}
                    {hasUnusuallyHighValue && (
                      <p>⚠️ Some values appear unusually high. Please verify the data for accuracy.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

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
