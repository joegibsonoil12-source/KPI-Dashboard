import React from 'react';

/**
 * Dashboard date range controls with quick presets
 * Supports Today / Last 7 / MTD / YTD / Custom
 */
export default function DashboardControls({ 
  preset = "30d",
  onPresetChange,
  fromDate = "",
  toDate = "",
  onDateChange,
  showCustomDates = false
}) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: 12, 
      alignItems: 'center',
      flexWrap: 'wrap',
      background: 'white',
      padding: '12px 16px',
      borderRadius: 12,
      border: '1px solid #E5E7EB'
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
        TIME PERIOD
      </div>
      
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => onPresetChange('today')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: preset === 'today' ? '#0B6E99' : 'white',
            color: preset === 'today' ? 'white' : '#6B7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Today
        </button>
        
        <button
          onClick={() => onPresetChange('7d')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: preset === '7d' ? '#0B6E99' : 'white',
            color: preset === '7d' ? 'white' : '#6B7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Last 7 Days
        </button>
        
        <button
          onClick={() => onPresetChange('30d')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: preset === '30d' ? '#0B6E99' : 'white',
            color: preset === '30d' ? 'white' : '#6B7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          Last 30 Days
        </button>
        
        <button
          onClick={() => onPresetChange('mtd')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: preset === 'mtd' ? '#0B6E99' : 'white',
            color: preset === 'mtd' ? 'white' : '#6B7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          MTD
        </button>
        
        <button
          onClick={() => onPresetChange('ytd')}
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            background: preset === 'ytd' ? '#0B6E99' : 'white',
            color: preset === 'ytd' ? 'white' : '#6B7280',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
        >
          YTD
        </button>
      </div>

      {showCustomDates && (
        <>
          <div style={{ 
            width: 1, 
            height: 24, 
            background: '#E5E7EB',
            marginLeft: 4,
            marginRight: 4
          }} />
          
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              From:
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onDateChange(e.target.value, toDate)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                fontSize: 12,
                color: '#1F2937'
              }}
            />
            
            <label style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
              To:
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onDateChange(fromDate, e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                fontSize: 12,
                color: '#1F2937'
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
