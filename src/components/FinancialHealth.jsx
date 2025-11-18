/**
 * Financial Health Module
 * 
 * Main component with tabs for Uploads, KPIs, and Trends
 */

import React, { useState } from 'react';
import FinancialUploads from './FinancialUploads';
import FinancialKPIs from './FinancialKPIs';
import FinancialTrends from './FinancialTrends';

export default function FinancialHealth() {
  const [activeTab, setActiveTab] = useState('kpis');

  const tabs = [
    { key: 'uploads', label: '📤 Monthly Uploads', Component: FinancialUploads },
    { key: 'kpis', label: '💰 Financial KPIs', Component: FinancialKPIs },
    { key: 'trends', label: '📈 Trends', Component: FinancialTrends },
  ];

  const CurrentTab = tabs.find(t => t.key === activeTab);

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid #E5E7EB',
        background: 'white',
        position: 'sticky',
        top: 60,
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          gap: 8,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '16px 20px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontWeight: 500,
                borderBottom: activeTab === tab.key ? '2px solid #3B82F6' : '2px solid transparent',
                color: activeTab === tab.key ? '#3B82F6' : '#6B7280',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {CurrentTab && <CurrentTab.Component />}
    </div>
  );
}
