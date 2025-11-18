/**
 * Financial Health - Trends Dashboard
 * 
 * Shows time-series trends for key financial metrics
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FinancialTrends() {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState([]);

  useEffect(() => {
    fetchTrends();
  }, []);

  async function fetchTrends() {
    try {
      // Fetch all P&L imports ordered by period
      const { data: plImports, error: plError } = await supabase
        .from('financial_imports')
        .select('*')
        .eq('type', 'profit_loss')
        .order('period', { ascending: true });

      if (plError) throw plError;

      // Fetch all balance sheet imports
      const { data: bsImports, error: bsError } = await supabase
        .from('financial_imports')
        .select('*')
        .eq('type', 'balance_sheet')
        .order('period', { ascending: true });

      if (bsError) throw bsError;

      // Merge data by period
      const periodData = {};

      plImports?.forEach(pl => {
        if (!periodData[pl.period]) {
          periodData[pl.period] = { period: pl.period };
        }
        periodData[pl.period].revenue = pl.summary?.totalIncome || 0;
        periodData[pl.period].netIncome = pl.summary?.netIncome || 0;
        periodData[pl.period].grossMargin = pl.summary?.grossMarginPct || 0;
      });

      bsImports?.forEach(bs => {
        if (!periodData[bs.period]) {
          periodData[bs.period] = { period: bs.period };
        }
        periodData[bs.period].cash = bs.summary?.cash || 0;
        periodData[bs.period].ar = bs.summary?.accountsReceivable || 0;
        periodData[bs.period].ap = bs.summary?.accountsPayable || 0;
      });

      // Convert to array and sort
      const trends = Object.values(periodData).sort((a, b) => 
        a.period.localeCompare(b.period)
      );

      setTrendData(trends);
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18 }}>Loading trends...</div>
      </div>
    );
  }

  if (trendData.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📈 Financial Trends</h1>
        <div style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          padding: 40,
          textAlign: 'center',
          color: '#6B7280',
        }}>
          No trend data available yet. Upload QuickBooks reports for multiple periods to see trends.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📈 Financial Trends</h1>
      <p style={{ color: '#6B7280', marginBottom: 24 }}>
        Month-over-month trends from QuickBooks imports
      </p>

      {/* Simple table view for now - can be enhanced with charts later */}
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 24,
        overflowX: 'auto',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 600 }}>Period</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Revenue</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Net Income</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Gross Margin %</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>Cash</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>AR</th>
              <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 600 }}>AP</th>
            </tr>
          </thead>
          <tbody>
            {trendData.map((row, idx) => (
              <tr
                key={row.period}
                style={{
                  borderBottom: idx < trendData.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{row.period}</td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {row.revenue ? `$${(row.revenue / 1000).toFixed(1)}k` : '-'}
                </td>
                <td style={{
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: row.netIncome >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {row.netIncome !== undefined ? `$${(row.netIncome / 1000).toFixed(1)}k` : '-'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {row.grossMargin !== undefined ? `${row.grossMargin.toFixed(1)}%` : '-'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {row.cash ? `$${(row.cash / 1000).toFixed(1)}k` : '-'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {row.ar ? `$${(row.ar / 1000).toFixed(1)}k` : '-'}
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  {row.ap ? `$${(row.ap / 1000).toFixed(1)}k` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 24 }}>
        <div style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Latest Period</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#3B82F6' }}>
            {trendData[trendData.length - 1]?.period || '-'}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Periods Tracked</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>
            {trendData.length}
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>Avg Monthly Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#8B5CF6' }}>
            {trendData.length > 0
              ? `$${(trendData.reduce((sum, d) => sum + (d.revenue || 0), 0) / trendData.length / 1000).toFixed(1)}k`
              : '-'
            }
          </div>
        </div>
      </div>
    </div>
  );
}
