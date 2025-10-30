// src/components/Billboard/BillboardTopTicker.jsx
import React, { useEffect, useState } from 'react';
import Marquee from 'react-fast-marquee';
import { readRefreshSec, secondsToMs } from '../../lib/readRefreshSec';

/**
 * BillboardTopTicker - NASDAQ-style scrolling ticker
 * Client-first approach: calls clientGetBillboardSummary() as primary source
 * Maps delivery and service fields to chips with formatting
 * Falls back to SAMPLE_CHIPS if no data available
 * Supports runtime API base via window.__ENV.BILLBOARD_API_BASE if configured
 */

// Sample chips for fallback when no data is available
const SAMPLE_CHIPS = [
  { label: 'SERVICE REVENUE', value: '$125,000', change: '+8.1%', positive: true },
  { label: 'DELIVERY REVENUE', value: '$89,451', change: '+5.2%', positive: true },
  { label: 'TOTAL TICKETS', value: '156', change: null, positive: null },
  { label: 'GALLONS', value: '45,231', change: '+12.3%', positive: true },
  { label: 'COMPLETED JOBS', value: '42', change: null, positive: null },
];

/**
 * Client-side Supabase function to fetch billboard summary
 * Uses fetchMetricsClient.getBillboardSummary() which queries service_jobs and delivery_tickets
 */
async function clientGetBillboardSummary() {
  try {
    const { getBillboardSummary } = await import('../../lib/fetchMetricsClient.js');
    const result = await getBillboardSummary();
    
    if (result.error) {
      console.warn('[BillboardTopTicker] Error from getBillboardSummary:', result.error);
    }
    
    return result.data || null;
  } catch (err) {
    console.error('[BillboardTopTicker] Error calling clientGetBillboardSummary:', err);
    return null;
  }
}

export default function BillboardTopTicker({ pollInterval = null }) {
  const [chips, setChips] = useState(SAMPLE_CHIPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('loading');

  // Read refresh interval from runtime or build env, default to 30 seconds
  const refreshInterval = pollInterval || secondsToMs(readRefreshSec(30));

  const fetchData = async () => {
    try {
      // GitHub Pages: Use ONLY client-side Supabase (no server API)
      console.log('[BillboardTopTicker] Fetching data from Supabase...');
      const summary = await clientGetBillboardSummary();
      
      if (summary && summary.serviceTracking && summary.deliveryTickets) {
        // Map delivery and service fields to chips
        const mappedChips = mapSummaryToChips(summary);
        setChips(mappedChips);
        setError(null);
        setDataSource('supabase');
        console.log('[BillboardTopTicker] Successfully loaded data from Supabase:', summary);
      } else {
        // No real data available, show sample
        console.warn('[BillboardTopTicker] No data from Supabase, using sample data');
        setChips(SAMPLE_CHIPS);
        setError('Using sample data - configure Supabase credentials');
        setDataSource('sample');
      }
    } catch (err) {
      console.error('[BillboardTopTicker] Fetch error:', err);
      setError(err.message);
      setChips(SAMPLE_CHIPS);
      setDataSource('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);

    // Listen for forced refresh events (e.g., after markCustomerCompleted)
    const handleBillboardRefresh = (event) => {
      console.log('[BillboardTopTicker] Forced refresh triggered:', event.detail);
      fetchData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('billboard-refresh', handleBillboardRefresh);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('billboard-refresh', handleBillboardRefresh);
      }
    };
  }, [refreshInterval]);

  if (loading) {
    return (
      <div className="billboard-top-ticker-loading">
        <span>Loading ticker data...</span>
      </div>
    );
  }

  return (
    <div className="billboard-top-ticker-container">
      <Marquee 
        speed={40}
        gradient={false} 
        pauseOnHover={true}
        pauseOnClick={true}
        delay={0}
        play={true}
        direction="left"
      >
        {chips.map((chip, idx) => (
          <div key={idx} className="billboard-top-ticker-item">
            <span className="billboard-top-ticker-label">{chip.label}</span>
            <span className="billboard-top-ticker-value">{chip.value}</span>
            {chip.change && (
              <span className={`billboard-top-ticker-chip ${chip.positive ? 'chip-positive' : 'chip-negative'}`}>
                {chip.change}
              </span>
            )}
          </div>
        ))}
      </Marquee>
      {dataSource === 'sample' && (
        <div className="billboard-data-warning">
          ⚠️ Sample data - Configure Supabase in Settings
        </div>
      )}
    </div>
  );
}

/**
 * Map summary data from getBillboardSummary() to chip format
 * Extracts delivery and service fields with proper formatting
 */
function mapSummaryToChips(summary) {
  if (!summary) return SAMPLE_CHIPS;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('en-US').format(val || 0);
  };

  const formatPercent = (change) => {
    const num = parseFloat(change) || 0;
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  };

  // Extract fields from summary
  const serviceRevenue = summary.serviceTracking?.completedRevenue || 0;
  const deliveryRevenue = summary.deliveryTickets?.revenue || 0;
  const totalTickets = summary.deliveryTickets?.totalTickets || 0;
  const totalGallons = summary.deliveryTickets?.totalGallons || 0;
  const completedJobs = summary.serviceTracking?.completed || 0;
  const scheduledJobs = summary.serviceTracking?.scheduled || 0;
  const totalRevenue = summary.weekCompare?.thisWeekTotalRevenue || 0;
  const percentChange = summary.weekCompare?.percentChange || 0;

  return [
    {
      label: 'TOTAL REVENUE',
      value: formatCurrency(totalRevenue),
      change: formatPercent(percentChange),
      positive: percentChange >= 0,
    },
    {
      label: 'SERVICE REVENUE',
      value: formatCurrency(serviceRevenue),
      change: null,
      positive: null,
    },
    {
      label: 'DELIVERY REVENUE',
      value: formatCurrency(deliveryRevenue),
      change: null,
      positive: null,
    },
    {
      label: 'DELIVERY TICKETS',
      value: formatNumber(totalTickets),
      change: null,
      positive: null,
    },
    {
      label: 'GALLONS',
      value: formatNumber(totalGallons),
      change: null,
      positive: null,
    },
    {
      label: 'COMPLETED JOBS',
      value: formatNumber(completedJobs),
      change: null,
      positive: null,
    },
    {
      label: 'SCHEDULED JOBS',
      value: formatNumber(scheduledJobs),
      change: null,
      positive: null,
    },
  ];
}
