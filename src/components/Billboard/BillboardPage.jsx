// src/components/Billboard/BillboardPage.jsx
import React, { useEffect, useState } from 'react';
import FullscreenButton from '../../components/FullscreenButton';
import '../../styles/billboard.css';
import BillboardTicker from './BillboardTicker';

/**
 * Restored BillboardPage:
 * - id="billboard-root" ensures fullscreen target
 * - Renders the ticker at the top
 * - Adds Refresh and Fullscreen controls
 * - Keeps placeholders for existing card components to render into
 */
export default function BillboardPage(props) {
  const [isTVMode, setIsTVMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1') setIsTVMode(true);
  }, []);

  return (
    <div id="billboard-root" className="billboard-page">
      {!isTVMode && (
        <header className="billboard-header">
          <h1>Operations Billboard</h1>
          <div className="billboard-controls">
            <button onClick={() => window.location.reload()}>Refresh</button>
            <FullscreenButton targetId="billboard-root" />
          </div>
        </header>
      )}

      <div className="billboard-ticker-wrapper">
        <BillboardTicker pollInterval={15000} />
      </div>

      <div className="billboard-cards-placeholder">
        {/* Existing BillboardCards component will render here if imported */}
      </div>
    </div>
  );
}
