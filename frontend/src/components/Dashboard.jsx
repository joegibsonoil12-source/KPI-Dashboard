import React from 'react';
import DataUploader from './DataUploader';
import Charts from './Charts';
import '../../styles/gibson.css';

export default function Dashboard() {
  return (
    <div className="gibson-bg" style={{ padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <img src="/gibson-logo.svg" alt="Gibson Logo" style={{ height: 48 }} />
        <div>
          <h2 style={{ margin: 0, color: 'var(--gibson-foreground, #fff)' }}>KPI Dashboard</h2>
          <div style={{ color: 'rgba(255,255,255,0.75)' }}>Overview and quick import</div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 420px) 1fr', gap: 18 }}>
        <div style={{ background: 'rgba(0,0,0,0.12)', padding: 12, borderRadius: 8 }}>
          <DataUploader apiBase={process.env.REACT_APP_KPI_PARSER_API || 'http://localhost:4000'} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Charts />
        </div>
      </div>
    </div>
  );
}