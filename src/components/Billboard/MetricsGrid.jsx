// src/components/Billboard/MetricsGrid.jsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getBillboardSummary, getMetricsTimeseries } from '../../lib/fetchMetricsClient';
import { supabase } from '../../lib/supabaseClient';
import { readRefreshSec, secondsToMs } from '../../lib/readRefreshSec';
import KpiCard from './KpiCard';
import StatusTicks from './StatusTicks';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

// Threshold constants for status determination
const THRESHOLDS = {
  revenue: {
    ok: 100000,      // >= $100k is good
    warn: 50000,     // $50k-$100k is warning
    // < $50k is negative
  },
  tickets: {
    ok: 100,         // >= 100 tickets is good
    warn: 50,        // 50-100 tickets is warning
    // < 50 is negative
  },
  gallons: {
    ok: 30000,       // >= 30k gallons is good
    warn: 15000,     // 15k-30k gallons is warning
    // < 15k is negative
  },
  jobs: {
    ok: 30,          // >= 30 jobs is good
    warn: 15,        // 15-30 jobs is warning
    // < 15 is negative
  },
  percentChange: {
    ok: 0,           // >= 0% is good
    warn: -5,        // -5% to 0% is warning
    // < -5% is negative
  },
};

/**
 * Determine status based on value and thresholds
 */
function getStatus(value, thresholdConfig) {
  if (value >= thresholdConfig.ok) return 'ok';
  if (value >= thresholdConfig.warn) return 'warn';
  return 'neg';
}

/**
 * MetricsGrid component
 * Displays live KPI metrics in a responsive grid with realtime updates
 */
export default function MetricsGrid() {
  const [metrics, setMetrics] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [topDeliveries, setTopDeliveries] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const channelRef = useRef(null);

  // Read refresh interval from runtime or build env, default to 30 seconds
  const refreshInterval = secondsToMs(readRefreshSec(30));

  /**
   * Fetch billboard summary data
   */
  const fetchMetrics = useCallback(async () => {
    try {
      const result = await getBillboardSummary();
      
      if (result.error) {
        console.error('[MetricsGrid] Error fetching metrics:', result.error);
        setError(result.error);
        return;
      }

      if (result.data && mounted.current) {
        setMetrics(result.data);
        setError(null);
        console.log('[MetricsGrid] Metrics updated:', result.data);
      }
    } catch (err) {
      console.error('[MetricsGrid] Fetch error:', err);
      if (mounted.current) {
        setError(err.message);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Fetch timeseries data for sparklines
   */
  const fetchTimeseries = useCallback(async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7); // Last 7 days

      const result = await getMetricsTimeseries({
        source: 'delivery',
        start,
        end,
        granularity: 'day',
      });

      if (result.primary && result.primary.length > 0 && mounted.current) {
        setTimeseries(result.primary);
      }
    } catch (err) {
      console.warn('[MetricsGrid] Error fetching timeseries:', err);
    }
  }, []);

  /**
   * Fetch top deliveries and services
   */
  const fetchTopItems = useCallback(async () => {
    if (!supabase) {
      console.warn('[MetricsGrid] Supabase not configured, skipping top items fetch');
      return;
    }

    try {
      // Fetch top 3 deliveries by amount
      const { data: deliveries, error: delError } = await supabase
        .from('delivery_tickets')
        .select('customer, amount, date')
        .order('amount', { ascending: false })
        .limit(3);

      if (!delError && deliveries && mounted.current) {
        setTopDeliveries(deliveries);
      }

      // Fetch top 3 services by job_amount
      const { data: services, error: svcError } = await supabase
        .from('service_jobs')
        .select('customer_name, job_amount, job_date, status')
        .eq('status', 'completed')
        .order('job_amount', { ascending: false })
        .limit(3);

      if (!svcError && services && mounted.current) {
        setTopServices(services);
      }
    } catch (err) {
      console.warn('[MetricsGrid] Error fetching top items:', err);
    }
  }, []);

  /**
   * Setup realtime subscription
   */
  const setupRealtimeSubscription = useCallback(() => {
    if (!supabase) {
      console.warn('[MetricsGrid] Supabase not configured, skipping realtime subscription');
      return;
    }

    try {
      const channel = supabase
        .channel('public:metrics-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'delivery_tickets' },
          (payload) => {
            console.log('[MetricsGrid] Realtime update from delivery_tickets:', payload);
            fetchMetrics();
            fetchTimeseries();
            fetchTopItems();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'service_jobs' },
          (payload) => {
            console.log('[MetricsGrid] Realtime update from service_jobs:', payload);
            fetchMetrics();
            fetchTimeseries();
            fetchTopItems();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[MetricsGrid] Realtime subscription active');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[MetricsGrid] Realtime subscription failed, continuing with polling:', status);
          }
        });

      channelRef.current = channel;
    } catch (err) {
      console.warn('[MetricsGrid] Error setting up realtime subscription:', err);
    }
  }, [fetchMetrics, fetchTimeseries, fetchTopItems]);

  // Initial data fetch and setup
  useEffect(() => {
    mounted.current = true;

    // Initial fetches
    fetchMetrics();
    fetchTimeseries();
    fetchTopItems();

    // Setup polling
    const intervalId = setInterval(() => {
      fetchMetrics();
      fetchTimeseries();
      fetchTopItems();
    }, refreshInterval);

    // Setup realtime subscription
    setupRealtimeSubscription();

    // Listen for forced refresh events
    const handleBillboardRefresh = (event) => {
      console.log('[MetricsGrid] Forced refresh triggered:', event.detail);
      fetchMetrics();
      fetchTimeseries();
      fetchTopItems();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('billboard-refresh', handleBillboardRefresh);
    }

    // Cleanup
    return () => {
      mounted.current = false;
      clearInterval(intervalId);
      
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('billboard-refresh', handleBillboardRefresh);
      }
    };
  }, [fetchMetrics, fetchTimeseries, fetchTopItems, refreshInterval, setupRealtimeSubscription]);

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // Format number
  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        Loading metrics...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
        Error loading metrics: {error}
      </div>
    );
  }

  // No data state
  if (!metrics) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        No metrics available
      </div>
    );
  }

  // Extract metrics
  const delivery = metrics.deliveryTickets || {};
  const service = metrics.serviceTracking || {};
  const week = metrics.weekCompare || {};

  // Calculate statuses
  const totalRevenue = week.thisWeekTotalRevenue || 0;
  const percentChange = week.percentChange || 0;
  const totalTickets = delivery.totalTickets || 0;
  const totalGallons = delivery.totalGallons || 0;
  const completedJobs = service.completed || 0;
  const deliveryRevenue = delivery.revenue || 0;
  const serviceRevenue = service.completedRevenue || 0;
  const pipelineRevenue = service.pipelineRevenue || 0;
  const scheduledJobs = week.scheduledJobs || 0;
  const scheduledRevenue = week.scheduledRevenue || 0;

  // Log scheduled metrics for debugging
  console.debug('[MetricsGrid] Scheduled metrics:', {
    scheduledJobs,
    scheduledRevenue,
  });

  // Generate status ticks
  const statusTicks = [
    {
      label: 'Revenue',
      status: getStatus(totalRevenue, THRESHOLDS.revenue),
      tooltip: `Total revenue: ${formatCurrency(totalRevenue)}`,
    },
    {
      label: 'Deliveries',
      status: getStatus(totalTickets, THRESHOLDS.tickets),
      tooltip: `${totalTickets} delivery tickets`,
    },
    {
      label: 'Services',
      status: getStatus(completedJobs, THRESHOLDS.jobs),
      tooltip: `${completedJobs} completed jobs`,
    },
    {
      label: 'Trend',
      status: getStatus(percentChange, THRESHOLDS.percentChange),
      tooltip: `Week-over-week: ${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`,
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      {/* Status Ticks */}
      <div style={{ marginBottom: '24px' }}>
        <StatusTicks ticks={statusTicks} />
      </div>

      {/* KPI Cards Grid */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          sub={`This week vs last week`}
          status={getStatus(totalRevenue, THRESHOLDS.revenue)}
          trend={`${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`}
          ariaLabel={`Total revenue: ${formatCurrency(totalRevenue)}, ${percentChange >= 0 ? 'up' : 'down'} ${Math.abs(percentChange).toFixed(1)}% from last week`}
        />

        <KpiCard
          title="Delivery Revenue"
          value={formatCurrency(deliveryRevenue)}
          sub={`${formatNumber(totalTickets)} tickets, ${formatNumber(totalGallons)} gallons`}
          status={getStatus(deliveryRevenue, THRESHOLDS.revenue)}
          ariaLabel={`Delivery revenue: ${formatCurrency(deliveryRevenue)} from ${totalTickets} tickets`}
        />

        <KpiCard
          title="Service Revenue"
          value={formatCurrency(serviceRevenue)}
          sub={`${completedJobs} completed jobs`}
          status={getStatus(serviceRevenue, THRESHOLDS.revenue)}
          ariaLabel={`Service revenue: ${formatCurrency(serviceRevenue)} from ${completedJobs} completed jobs`}
        />

        <KpiCard
          title="Pipeline"
          value={formatCurrency(pipelineRevenue)}
          sub={`Scheduled & deferred`}
          status="neutral"
          ariaLabel={`Pipeline revenue: ${formatCurrency(pipelineRevenue)}`}
        />

        <KpiCard
          title="Scheduled Jobs"
          value={formatNumber(scheduledJobs)}
          sub={`Revenue: ${formatCurrency(scheduledRevenue)}`}
          status={getStatus(scheduledJobs, THRESHOLDS.jobs)}
          ariaLabel={`Scheduled jobs: ${scheduledJobs}, Revenue: ${formatCurrency(scheduledRevenue)}`}
        />
      </div>

      {/* Sparkline Chart */}
      {timeseries.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            Delivery Revenue Trend (Last 7 Days)
          </h3>
          <div style={{ height: '120px', backgroundColor: '#fff', borderRadius: '8px', padding: '12px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  dot={false}
                />
                <Tooltip 
                  formatter={(value) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={(label) => `Day: ${label}`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Deliveries and Services */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Top Deliveries */}
        {topDeliveries.length > 0 && (
          <div style={{ 
            backgroundColor: '#fff', 
            borderRadius: '8px', 
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Top 3 Deliveries
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topDeliveries.map((del, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    {del.customer || 'Unknown'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                    {formatCurrency(del.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Services */}
        {topServices.length > 0 && (
          <div style={{ 
            backgroundColor: '#fff', 
            borderRadius: '8px', 
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
              Top 3 Services
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topServices.map((svc, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    {svc.customer_name || 'Unknown'}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                    {formatCurrency(svc.job_amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
