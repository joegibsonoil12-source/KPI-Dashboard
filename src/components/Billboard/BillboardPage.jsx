/**
 * BillboardPage Component
 *
 * Main Billboard page that orchestrates all Billboard components
 * 
 * Data Flow:
 * - Fetches data from Supabase service_jobs and delivery_tickets tables
 * - Uses aggregate views (service_jobs_daily, delivery_tickets_daily) when available
 * - Falls back to direct table queries if views don't exist
 * - Falls back to mock data if Supabase is not configured
 * - All numeric fields are protected with safe helpers (num, fmtCurrency, fmtGallons)
 * 
 * Features:
 * - Polls at configurable intervals (default 30s)
 * - Supports TV mode via ?tv=1 query param
 * - Configurable refresh via ?refresh=X query param or BILLBOARD_REFRESH_SEC env
 * - Fullscreen / Pop-out behavior for TV mode
 * - Dark theme optimized for display screens
 * - Responsive layout that fits content on one screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import BillboardTicker from './BillboardTicker';
import BillboardCards from './BillboardCards';
import WeekCompareMeter from './WeekCompareMeter';
import { getBillboardSummary } from '../../lib/fetchMetricsClient';
import '../../styles/billboard.css';
import '../../styles/brand.css'; // ensure brand variables and button classes are available

// Default refresh interval in seconds (can be overridden by env or query param)
const DEFAULT_REFRESH_SEC = 30;

/**
 * Get refresh interval from env or default
 */
function getRefreshInterval() {
  // Try to get from env variable (Vite uses VITE_ prefix)
  const envRefresh = import.meta.env.VITE_BILLBOARD_REFRESH_SEC;
  if (envRefresh) {
    const parsed = parseInt(envRefresh, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_REFRESH_SEC;
}

/**
 * Parse query params
 */
function useQueryParams() {
  const [params, setParams] = useState({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramsObj = {};
    for (const [key, value] of urlParams.entries()) {
      paramsObj[key] = value;
    }
    setParams(paramsObj);
  }, []);

  return params;
}

/**
 * Safe numeric helpers - coerce null/undefined to 0
 */
const num = (v) => {
  // If value is string or number, convert to Number; treat NaN as 0
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const fmtCurrency = (v) => `$${num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtGallons = (v) => `${num(v).toLocaleString(undefined, { maximumFractionDigits: 1 })} gal`;

/**
 * BillboardPage component
 */
export default function BillboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const queryParams = useQueryParams();
  const isTVMode = queryParams.tv === '1';
  const refreshOverride = queryParams.refresh ? parseInt(queryParams.refresh, 10) : null;
  const refreshInterval = refreshOverride || getRefreshInterval();

  /**
   * Fetch billboard data
   */
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await getBillboardSummary();

      // Log the full result for debugging (inspect result.debug.usedView, totals, etc)
      // This helps confirm whether the client used the DB views or the JS fallback.
      // Example to look for in console: result.debug.usedView === true
      // You can remove or reduce logging after verification.
      // eslint-disable-next-line no-console
      console.debug('getBillboardSummary result:', result);

      if (result?.error) {
        throw new Error(result.error);
      }

      setData(result.data || null);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching billboard data:', err);
      setError(err.message || 'Failed to load billboard data');
      setLoading(false);
    }
  }, []);

  /**
   * Initial load and polling setup
   */
  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling interval
    const intervalId = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchData, refreshInterval]);

  /**
   * If opened in TV mode (?tv=1) try to request fullscreen automatically.
   */
  useEffect(() => {
    if (isTVMode && document.documentElement.requestFullscreen) {
      // Small delay to ensure page is loaded
      setTimeout(() => {
        document.documentElement.requestFullscreen().catch(err => {
          // not critical — log and continue
          // eslint-disable-next-line no-console
          console.log('Fullscreen request failed:', err);
        });
      }, 500);
    }
  }, [isTVMode]);

  /**
   * Get TV mode URL with token
   *
   * - If running on GitHub Pages (hostname contains github.io), build a Vercel popout URL
   *   so the fallback popout opens the Vercel-hosted billboard (which may have server-side API).
   * - Otherwise default to current origin/path (local / deployed origin).
   */
  const getTVUrl = () => {
    const tvToken = import.meta.env.VITE_BILLBOARD_TV_TOKEN || (window.__ENV && window.__ENV.BILLBOARD_TV_TOKEN) || '';
    const hostname = (window && window.location && window.location.hostname) ? window.location.hostname : '';
    const isGithubPages = hostname.endsWith('github.io') || hostname.includes('githubusercontent.com');
    const vercelPopoutBase = import.meta.env.VITE_BILLBOARD_VERCEL_BASE || 'https://kpi-dashboard-seven-eta.vercel.app';
    const baseUrl = isGithubPages ? `${vercelPopoutBase}/billboard` : `${window.location.origin}${window.location.pathname}`;
    if (tvToken) {
      return `${baseUrl}?tv=1&token=${encodeURIComponent(tvToken)}`;
    }
    return `${baseUrl}?tv=1`;
  };

  /**
   * Primary behavior: request fullscreen on the billboard container.
   * Fallback: open a new window at the TV URL.
   */
  const openTVMode = () => {
    try {
      // Prefer targeting the billboard container so only the billboard is fullscreen
      const el = document.querySelector('.billboard-page') || document.documentElement;

      if (el && el.requestFullscreen) {
        el.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed, falling back to popout window:', err);
          const tvUrl = getTVUrl();
          window.open(tvUrl, 'BillboardTV', 'width=1920,height=1080,toolbar=0,location=0,menubar=0,status=0');
        });
      } else {
        // no fullscreen API support — fallback to popout window
        const tvUrl = getTVUrl();
        window.open(tvUrl, 'BillboardTV', 'width=1920,height=1080,toolbar=0,location=0,menubar=0,status=0');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('openTVMode error:', err);
      const tvUrl = getTVUrl();
      window.open(tvUrl, 'BillboardTV', 'width=1920,height=1080,toolbar=0,location=0,menubar=0,status=0');
    }
  };

  /**
   * Copy TV URL to clipboard
   */
  const copyTVUrl = async () => {
    const tvUrl = getTVUrl();
    try {
      await navigator.clipboard.writeText(tvUrl);
      // small visual confirmation
      alert('TV URL copied to clipboard!');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy:', err);
      // fallback
      prompt('Copy this TV URL:', tvUrl);
    }
  };

  /**
   * Prepare ticker items from data
   */
  const getTickerItems = () => {
    if (!data) return [];

    return [
      {
        label: 'Completed Services',
        value: num(data.serviceTracking?.completed),
        type: 'number',
      },
      {
        label: 'Service Revenue',
        value: num(data.serviceTracking?.completedRevenue),
        type: 'currency',
      },
      {
        label: 'Delivery Tickets',
        value: num(data.deliveryTickets?.totalTickets),
        type: 'number',
      },
      {
        label: 'Gallons Delivered',
        value: num(data.deliveryTickets?.totalGallons),
        type: 'gallons',
      },
      {
        label: 'Delivery Revenue',
        value: num(data.deliveryTickets?.revenue),
        type: 'currency',
      },
      {
        label: 'Week Performance',
        value: num(data.weekCompare?.percentChange),
        type: 'percent',
        change: num(data.weekCompare?.percentChange),
      },
    ];
  };

  /**
   * Prepare metrics for cards
   */
  const getMetrics = () => {
    if (!data) return {};

    const thisWeekTotal = num(data.weekCompare?.thisWeekTotalRevenue);

    return {
      completedServices: num(data.serviceTracking?.completed),
      deliveryTickets: num(data.deliveryTickets?.totalTickets),
      totalGallons: num(data.deliveryTickets?.totalGallons),
      totalRevenue: thisWeekTotal,
      pipelineRevenue: num(data.serviceTracking?.pipelineRevenue),
    };
  };

  // Loading state
  if (loading) {
    return (
      <div className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
        <div className="billboard-loading">
          <div className="billboard-loading-spinner" />
          <p>Loading Billboard data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
        <div className="billboard-error">
          <h2>Error Loading Billboard</h2>
          <p>{error}</p>
          <button onClick={fetchData} className="btn secondary">Retry</button>
        </div>
      </div>
    );
  }

  // Final render (use safe numeric helpers for display)
  const metrics = getMetrics();
  const tickerItems = getTickerItems();

  return (
    <div className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
      {/* Header - hidden in TV mode */}
      {!isTVMode && (
        <div className="billboard-header">
          <h1 className="billboard-title">Operations Billboard</h1>
          <div className="billboard-actions">
            {/* Primary action: full screen the billboard */}
            <button onClick={openTVMode} className="btn olive popout-button" title="Full screen billboard">
              📺 Full screen
            </button>

            {/* Secondary actions */}
            <button onClick={copyTVUrl} className="btn secondary">📋 Copy TV URL</button>
            <button onClick={fetchData} className="btn secondary">🔄 Refresh</button>
          </div>
        </div>
      )}

      {/* Ticker */}
      <BillboardTicker items={tickerItems} speed={80} />

      {/* Main content */}
      <div className="billboard-content">
        {/* Metric Cards */}
        <BillboardCards metrics={metrics} />

        {/* Week Comparison Meter */}
        <WeekCompareMeter
          thisWeek={num(data?.weekCompare?.thisWeekTotalRevenue)}
          lastWeek={num(data?.weekCompare?.lastWeekTotalRevenue)}
          percentChange={num(data?.weekCompare?.percentChange)}
        />

        {/* Additional Details */}
        <div className="billboard-details">
          <div className="billboard-detail-card">
            <h3>Service Tracking</h3>
            <div className="billboard-detail-grid">
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Completed</span>
                <span className="billboard-detail-value">{metrics.completedServices}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Scheduled</span>
                <span className="billboard-detail-value">{num(data?.serviceTracking?.scheduled)}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Deferred</span>
                <span className="billboard-detail-value warning">{num(data?.serviceTracking?.deferred)}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Pipeline</span>
                <span className="billboard-detail-value">
                  {fmtCurrency(num(data?.serviceTracking?.pipelineRevenue))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Small summary row under header for quick values (keeps the ticker + cards consistent with previous UI) */}
        <div className="summary-row">
          <div>Delivery Tickets <strong>{metrics.deliveryTickets}</strong></div>
          <div>Gallons Delivered <strong>{fmtGallons(metrics.totalGallons)}</strong></div>
          <div>Delivery Revenue <strong>{fmtCurrency(num(data?.deliveryTickets?.revenue))}</strong></div>
        </div>
      </div>

      {/* Footer - last updated timestamp */}
      <div className="billboard-footer">
        <span className="billboard-footer-text">
          Last Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
        </span>
        <span className="billboard-footer-text">
          Auto-refresh: {refreshInterval}s
        </span>
      </div>
    </div>
  );
}
