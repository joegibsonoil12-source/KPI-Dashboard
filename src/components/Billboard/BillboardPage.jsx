/**
 * BillboardPage Component
 *
 * Main Billboard page that orchestrates all Billboard components
 * Features:
 * - Polls /api/billboard-summary at configurable intervals
 * - Supports TV mode via ?tv=1 query param
 * - Configurable refresh via ?refresh=X query param or BILLBOARD_REFRESH_SEC env
 * - Pop-out button for TV mode
 * - Dark theme optimized for display screens
 */

import React, { useState, useEffect, useCallback } from 'react';
import BillboardTicker from './BillboardTicker';
import BillboardCards from './BillboardCards';
import WeekCompareMeter from './WeekCompareMeter';
import { getBillboardSummary } from '../../pages/api/billboard-summary';
import '../../styles/billboard.css';

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

      if (result.error) {
        throw new Error(result.error);
      }

      setData(result.data);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
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
   * Request fullscreen in TV mode
   */
  useEffect(() => {
    if (isTVMode && document.documentElement.requestFullscreen) {
      // Small delay to ensure page is loaded
      setTimeout(() => {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen request failed:', err);
        });
      }, 500);
    }
  }, [isTVMode]);

  /**
   * Get TV mode URL with token
   *
   * New behavior:
   * - If running on GitHub Pages (hostname contains github.io), build a Vercel popout URL
   *   so the Pop Out button opens the working Vercel billboard (which has the API).
   * - Otherwise default to local/original behavior.
   */
  const getTVUrl = () => {
    // token sources: Vite build-time VITE_BILLBOARD_TV_TOKEN (may be empty on GH Pages),
    // or runtime-config (window.__ENV) if present.
    const tvToken = import.meta.env.VITE_BILLBOARD_TV_TOKEN || (window.__ENV && window.__ENV.BILLBOARD_TV_TOKEN) || '';

    // Detect GitHub Pages hosting (e.g., username.github.io or githubusercontent)
    const hostname = (window && window.location && window.location.hostname) ? window.location.hostname : '';
    const isGithubPages = hostname.endsWith('github.io') || hostname.includes('githubusercontent.com');

    // Preferred Vercel popout base (non-secret, safe to hardcode)
    const vercelPopoutBase = import.meta.env.VITE_BILLBOARD_VERCEL_BASE || 'https://kpi-dashboard-seven-eta.vercel.app';

    // Build base URL: for GitHub Pages open Vercel billboard, otherwise use current page
    const baseUrl = isGithubPages ? `${vercelPopoutBase}/billboard` : `${window.location.origin}${window.location.pathname}`;

    if (tvToken) {
      return `${baseUrl}?tv=1&token=${encodeURIComponent(tvToken)}`;
    }
    return `${baseUrl}?tv=1`;
  };

  /**
   * Open TV mode in new window with token
   */
  const openTVMode = () => {
    const tvUrl = getTVUrl();
    window.open(
      tvUrl,
      'BillboardTV',
      'width=1920,height=1080,toolbar=0,location=0,menubar=0,status=0'
    );
  };

  /**
   * Copy TV URL to clipboard
   */
  const copyTVUrl = async () => {
    const tvUrl = getTVUrl();
    try {
      await navigator.clipboard.writeText(tvUrl);
      alert('TV URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback: show the URL in a prompt
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
        value: data.serviceTracking?.completed,
        type: 'number',
      },
      {
        label: 'Service Revenue',
        value: data.serviceTracking?.completedRevenue,
        type: 'currency',
      },
      {
        label: 'Delivery Tickets',
        value: data.deliveryTickets?.totalTickets,
        type: 'number',
      },
      {
        label: 'Gallons Delivered',
        value: data.deliveryTickets?.totalGallons,
        type: 'gallons',
      },
      {
        label: 'Delivery Revenue',
        value: data.deliveryTickets?.revenue,
        type: 'currency',
      },
      {
        label: 'Week Performance',
        value: data.weekCompare?.percentChange,
        type: 'percent',
        change: data.weekCompare?.percentChange,
      },
    ];
  };

  /**
   * Prepare metrics for cards
   */
  const getMetrics = () => {
    if (!data) return {};

    const thisWeekTotal = data.weekCompare?.thisWeekTotalRevenue || 0;

    return {
      completedServices: data.serviceTracking?.completed,
      deliveryTickets: data.deliveryTickets?.totalTickets,
      totalGallons: data.deliveryTickets?.totalGallons,
      totalRevenue: thisWeekTotal,
      pipelineRevenue: data.serviceTracking?.pipelineRevenue,
    };
  };

  // Loading state
  if (loading) {
    return (
      <div className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
        <div className="billboard-loading">
          <div className="billboard-loading-spinner"></div>
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
          <button onClick={fetchData} className="billboard-retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
      {/* Header - hidden in TV mode */}
      {!isTVMode && (
        <div className="billboard-header">
          <h1 className="billboard-title">Operations Billboard</h1>
          <div className="billboard-actions">
            <button onClick={openTVMode} className="billboard-tv-button">
              📺 Pop Out TV
            </button>
            <button onClick={copyTVUrl} className="billboard-tv-button">
              📋 Copy TV URL
            </button>
            <button onClick={fetchData} className="billboard-refresh-button">
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      {/* Ticker */}
      <BillboardTicker items={getTickerItems()} speed={80} />

      {/* Main content */}
      <div className="billboard-content">
        {/* Metric Cards */}
        <BillboardCards metrics={getMetrics()} />

        {/* Week Comparison Meter */}
        <WeekCompareMeter
          thisWeek={data?.weekCompare?.thisWeekTotalRevenue}
          lastWeek={data?.weekCompare?.lastWeekTotalRevenue}
          percentChange={data?.weekCompare?.percentChange}
        />

        {/* Additional Details */}
        <div className="billboard-details">
          <div className="billboard-detail-card">
            <h3>Service Tracking</h3>
            <div className="billboard-detail-grid">
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Completed</span>
                <span className="billboard-detail-value">{data?.serviceTracking?.completed || 0}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Scheduled</span>
                <span className="billboard-detail-value">{data?.serviceTracking?.scheduled || 0}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Deferred</span>
                <span className="billboard-detail-value warning">{data?.serviceTracking?.deferred || 0}</span>
              </div>
              <div className="billboard-detail-item">
                <span className="billboard-detail-label">Pipeline</span>
                <span className="billboard-detail-value">
                  ${(data?.serviceTracking?.pipelineRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
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
