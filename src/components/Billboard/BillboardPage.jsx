// src/components/Billboard/BillboardPage.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import FullscreenButton from '../../components/FullscreenButton';
import '../../styles/billboard.css';
import BillboardTopTicker from './BillboardTopTicker';
// import BillboardTicker from './BillboardTicker'; // Removed duplicate ticker
import WeekCompareBar from './WeekCompareBar';
import MetricsGrid from './MetricsGrid';
import { getBillboardSummary } from '../../lib/fetchMetricsClient';
import { readRefreshSec, secondsToMs } from '../../lib/readRefreshSec';

/**
 * BillboardPage:
 * - id="billboard-root" ensures fullscreen target
 * - Renders the NASDAQ-style top ticker above the header
 * - Renders the existing ticker below the header
 * - Renders WeekCompareBar under the marquee
 * - Adds Refresh and Fullscreen controls
 * - Keeps placeholders for existing card components to render into
 */
export default function BillboardPage(props) {
  const [isTVMode, setIsTVMode] = useState(false);
  const [weekCompareData, setWeekCompareData] = useState({
    thisWeekTotalRevenue: 0,
    lastWeekTotalRevenue: 0,
    percentChange: 0,
  });
  const mounted = useRef(true);

  // Read refresh interval for the week bar (default 10s)
  const weekBarRefreshInterval = secondsToMs(readRefreshSec(10));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1') setIsTVMode(true);
  }, []);

  const fetchWeekCompareData = useCallback(async () => {
    try {
      const result = await getBillboardSummary();
      if (result.data && result.data.weekCompare) {
        const { thisWeekTotalRevenue, lastWeekTotalRevenue, percentChange } = result.data.weekCompare;
        if (mounted.current) {
          setWeekCompareData({
            thisWeekTotalRevenue: thisWeekTotalRevenue || 0,
            lastWeekTotalRevenue: lastWeekTotalRevenue || 0,
            percentChange: percentChange || 0,
          });
        }
      }
    } catch (err) {
      console.error('[BillboardPage] Error fetching week compare data:', err);
    }
  }, [mounted]);

  useEffect(() => {
    mounted.current = true;

    // Initial fetch
    fetchWeekCompareData();

    // Set up polling for week compare bar
    const intervalId = setInterval(fetchWeekCompareData, weekBarRefreshInterval);

    // Listen for forced refresh events (e.g., after markCustomerCompleted)
    const handleBillboardRefresh = (event) => {
      console.log('[BillboardPage] Forced refresh triggered:', event.detail);
      fetchWeekCompareData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('billboard-refresh', handleBillboardRefresh);
    }

    return () => {
      mounted.current = false;
      clearInterval(intervalId);
      if (typeof window !== 'undefined') {
        window.removeEventListener('billboard-refresh', handleBillboardRefresh);
      }
    };
  }, [fetchWeekCompareData, weekBarRefreshInterval, mounted]);

  const handleRefresh = () => {
    fetchWeekCompareData();
    window.location.reload();
  };

  return (
    <div id="billboard-root" className="billboard-page">
      {/* NASDAQ-style top ticker */}
      <BillboardTopTicker />
      
      {!isTVMode && (
        <header className="billboard-header">
          <h1>Operations Billboard</h1>
          <div className="billboard-controls">
            <button onClick={handleRefresh}>Refresh</button>
            <FullscreenButton targetId="billboard-root" />
          </div>
        </header>
      )}

      {/* Removed duplicate BillboardTicker - keeping only BillboardTopTicker at top */}

      {/* Week Compare Bar - placed under the marquee */}
      <div className="billboard-week-compare-wrapper" style={{ padding: '12px 16px' }}>
        <WeekCompareBar
          thisWeekTotalRevenue={weekCompareData.thisWeekTotalRevenue}
          lastWeekTotalRevenue={weekCompareData.lastWeekTotalRevenue}
          percentChange={weekCompareData.percentChange}
        />
      </div>

      {/* Live Metrics Grid with KPI cards, sparklines, and status ticks */}
      <MetricsGrid />
    </div>
  );
}
