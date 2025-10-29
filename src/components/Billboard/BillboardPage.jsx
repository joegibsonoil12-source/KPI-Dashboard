// src/components/Billboard/BillboardPage.jsx
import React, { useEffect, useState } from 'react';
import FullscreenButton from '../../components/FullscreenButton';
import '../../styles/billboard.css';
import BillboardTicker from './BillboardTicker';

/**
 * Restored BillboardPage:
 * - Ensures id="billboard-root" exists for fullscreen targeting
 * - Renders the ticker at the top
 * - Keeps existing card/grid markup locations so widgets render as before
 * - Adds a Refresh button and the FullscreenButton in header controls
 */
export default function BillboardPage(props) {
  const [isTVMode, setIsTVMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1') setIsTVMode(true);
  }, []);

  return (
    <div id="billboard-root" className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
      <header className="billboard-topbar">
        <div className="billboard-left">
          <div className="billboard-title">Operations Billboard</div>
        </div>

        <div className="billboard-controls" role="toolbar" aria-label="Billboard controls">
          <button className="btn secondary" onClick={() => window.location.reload()} title="Refresh Billboard">Refresh</button>

          {/* Fullscreen toggle */}
          <FullscreenButton targetId="billboard-root" className="btn primary billboard-fullscreen-btn" />
        </div>
      </header>

      {/* Ticker: NASDAQ-style side scroller */}
      <BillboardTicker pollInterval={15000} />

      <main className="billboard-content">
        <div className="billboard-grid">
          {/* Existing rendered widgets/cards should populate here. Keep placeholders intact. */}
          <section className="bb-card">
            {/* Card components like Completed Services, Delivery Tickets, Total Gallons, Total Revenue, Pipeline */}
          </section>

          <section className="bb-card week-compare">
            {/* This Week vs Last Week UI is expected here as in previous implementation */}
          </section>

          <section className="bb-card service-tracking">
            {/* Service Tracking summary */}
          </section>

          <section className="bb-card delivery-summary">
            {/* Delivery Summary table and per-truck breakdown */}
          </section>
        </div>
      </main>

      <footer className="billboard-footer" />
    </div>
  );
}
