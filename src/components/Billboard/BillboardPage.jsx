// src/components/Billboard/BillboardPage.jsx
import React, { useEffect, useState } from 'react';
import FullscreenButton from '../../components/FullscreenButton';
import '../../styles/billboard.css';

export default function BillboardPage(props) {
  const [isTVMode, setIsTVMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tv') === '1') setIsTVMode(true);
  }, []);

  return (
    <div id="billboard-root" className={`billboard-page ${isTVMode ? 'tv-mode' : ''}`}>
      <header className="billboard-topbar">
        <div className="billboard-title">Operations Billboard</div>

        <div className="billboard-controls" role="toolbar" aria-label="Billboard controls">
          {/* Keep existing controls if present (Refresh / Popout) */}
          <button className="btn secondary" onClick={() => window.location.reload()} title="Refresh Billboard">🔄</button>

          {/* Visible fullscreen toggle */}
          <FullscreenButton targetId="billboard-root" className="btn primary billboard-fullscreen-btn" />
        </div>
      </header>

      <main className="billboard-content">
        <div className="billboard-grid">
          {/* Billboard widgets/cards rendered by existing components - keep markup location */}
        </div>
      </main>

      <footer className="billboard-footer">
        {/* Footer (last-updated, source) can remain empty or be rendered by existing code */}
      </footer>
    </div>
  );
}
