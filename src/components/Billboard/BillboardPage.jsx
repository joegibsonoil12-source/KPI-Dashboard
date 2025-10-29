// src/components/Billboard/BillboardPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { getBillboardSummary } from '../../pages/api/billboard-summary';
import BillboardTicker from './BillboardTicker';
import BillboardCards from './BillboardCards';
import WeekCompareMeter from './WeekCompareMeter';
import FullscreenButton from '../../components/FullscreenButton';
import '../../styles/billboard.css';

/**
 * Format currency value
 * @param {number} value - Value to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(value) {
  if (value === null || value === undefined) return '$0.00';
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format gallons value
 * @param {number} value - Value to format
 * @returns {string} - Formatted gallons string
 */
function formatGallons(value) {
  if (value === null || value === undefined) return '0.0';
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * BillboardPage - Main orchestrator for the Billboard feature
 * 
 * Features:
 * - Auto-refresh with configurable interval
 * - TV mode with ?tv=1 query parameter
 * - Pop-out window support
 * - Loading and error states
 * - Fullscreen toggle
 */
export default function BillboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isTVMode, setIsTVMode] = useState(false);

  // Get refresh interval from env or query param with validation
  const getRefreshInterval = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRefresh = params.get('refresh');
    if (queryRefresh) {
      const parsed = parseInt(queryRefresh, 10);
      // Clamp between 5 and 300 seconds
      const clamped = Math.max(5, Math.min(300, isNaN(parsed) ? 30 : parsed));
      return clamped * 1000;
    }
    const envRefresh = import.meta.env.VITE_BILLBOARD_REFRESH_SEC || 30;
    const parsed = parseInt(envRefresh, 10);
    // Clamp between 5 and 300 seconds
    const clamped = Math.max(5, Math.min(300, isNaN(parsed) ? 30 : parsed));
    return clamped * 1000;
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const result = await getBillboardSummary();
      if (result.error) {
        setError(result.error);
      } else {
        setData(result.data);
        setLastUpdated(new Date().toISOString());
        setError(null);
      }
    } catch (err) {
      console.error('[BillboardPage] Error fetching data:', err);
      setError(err.message || 'Failed to fetch billboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for TV mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1') {
      setIsTVMode(true);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set up polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, getRefreshInterval());

    return () => clearInterval(interval);
  }, [fetchData, getRefreshInterval]);

  // Open TV mode in new window
  const openTVMode = () => {
    const currentUrl = window.location.href;
    const tvUrl = currentUrl.includes('?') 
      ? `${currentUrl}&tv=1` 
      : `${currentUrl}?tv=1`;
    window.open(tvUrl, 'BillboardTV', 'width=1920,height=1080');
  };

  // Format metrics for ticker
  const getTickerItems = () => {
    if (!data) return [];
    
    return [
      {
        label: 'Completed Services',
        value: data.serviceTracking?.completed || 0,
        type: 'number',
      },
      {
        label: 'Service Revenue',
        value: data.serviceTracking?.completedRevenue || 0,
        type: 'currency',
      },
      {
        label: 'Delivery Tickets',
        value: data.deliveryTickets?.totalTickets || 0,
        type: 'number',
      },
      {
        label: 'Gallons Delivered',
        value: data.deliveryTickets?.totalGallons || 0,
        type: 'gallons',
      },
      {
        label: 'Total Revenue',
        value: data.weekCompare?.thisWeekTotalRevenue || 0,
        type: 'currency',
        change: data.weekCompare?.percentChange || null,
      },
    ];
  };

  // Format metrics for cards
  const getCardMetrics = () => {
    if (!data) return {};
    
    return {
      completedServices: data.serviceTracking?.completed || 0,
      deliveryTickets: data.deliveryTickets?.totalTickets || 0,
      totalGallons: data.deliveryTickets?.totalGallons || 0,
      totalRevenue: data.weekCompare?.thisWeekTotalRevenue || 0,
      pipelineRevenue: data.serviceTracking?.pipelineRevenue || 0,
    };
  };

  // Format last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return '—';
    try {
      const date = new Date(lastUpdated);
      return date.toLocaleTimeString();
    } catch (e) {
      return '—';
    }
  };

  if (loading) {
    return (
      <div id="billboard-root" className="billboard-page billboard-loading">
        <div className="billboard-loading-message">
          <div className="billboard-spinner"></div>
          <p>Loading Billboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="billboard-root" className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
      {!isTVMode && (
        <header className="billboard-topbar">
          <div className="billboard-title">🏢 Operations Billboard</div>

          <div className="billboard-controls" role="toolbar" aria-label="Billboard controls">
            <button 
              className="btn secondary billboard-btn" 
              onClick={() => fetchData()} 
              title="Refresh Billboard"
            >
              🔄 Refresh
            </button>

            <button 
              className="btn secondary billboard-btn" 
              onClick={openTVMode} 
              title="Open in TV Mode"
            >
              📺 TV Mode
            </button>

            <FullscreenButton 
              targetId="billboard-root" 
              className="btn primary billboard-fullscreen-btn" 
            />
          </div>
        </header>
      )}

      <main className="billboard-content">
        {error && (
          <div className="billboard-error">
            <p>⚠️ {error}</p>
            <button onClick={() => fetchData()}>Retry</button>
          </div>
        )}

        {/* Scrolling Ticker */}
        <BillboardTicker items={getTickerItems()} speed={80} />

        {/* Metric Cards */}
        <BillboardCards metrics={getCardMetrics()} />

        {/* Week Comparison Meter */}
        <WeekCompareMeter 
          thisWeek={data?.weekCompare?.thisWeekTotalRevenue || 0}
          lastWeek={data?.weekCompare?.lastWeekTotalRevenue || 0}
          percentChange={data?.weekCompare?.percentChange || 0}
        />

        {/* Service Tracking Summary */}
        <div className="billboard-summary-section">
          <h3 className="billboard-section-title">Service Tracking</h3>
          <div className="billboard-summary-row">
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Completed:</span>
              <span className="billboard-summary-value">{data?.serviceTracking?.completed || 0}</span>
            </div>
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Scheduled:</span>
              <span className="billboard-summary-value">{data?.serviceTracking?.scheduled || 0}</span>
            </div>
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Deferred:</span>
              <span className="billboard-summary-value">{data?.serviceTracking?.deferred || 0}</span>
            </div>
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Pipeline:</span>
              <span className="billboard-summary-value">
                {formatCurrency(data?.serviceTracking?.pipelineRevenue || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Summary */}
        <div className="billboard-summary-section">
          <h3 className="billboard-section-title">Delivery Summary</h3>
          <div className="billboard-summary-row">
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Tickets:</span>
              <span className="billboard-summary-value">{data?.deliveryTickets?.totalTickets || 0}</span>
            </div>
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Gallons Delivered:</span>
              <span className="billboard-summary-value">
                {formatGallons(data?.deliveryTickets?.totalGallons || 0)} gal
              </span>
            </div>
            <div className="billboard-summary-item">
              <span className="billboard-summary-label">Delivery Revenue:</span>
              <span className="billboard-summary-value">
                {formatCurrency(data?.deliveryTickets?.revenue || 0)}
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="billboard-footer">
        <div className="billboard-footer-left">
          Last Updated: {formatLastUpdated()}
        </div>
        <div className="billboard-footer-center">
          📊 Source: Service Jobs & Delivery Tickets
        </div>
        <div className="billboard-footer-right">
          Auto-refresh: {getRefreshInterval() / 1000}s
        </div>
      </footer>
    </div>
  );
}
