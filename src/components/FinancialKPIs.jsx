/**
 * Financial Health - KPIs Dashboard
 * 
 * Displays key financial metrics calculated from QuickBooks imports
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function FinancialKPIs() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    revenue: { totalIncome: 0, grossProfit: 0, grossMarginPct: 0, netIncome: 0 },
    cash: { balance: 0, operatingCashFlow: 0 },
    ar: { total: 0, over60Pct: 0 },
    ap: { total: 0 },
    payroll: { total: 0, asPercentOfRevenue: 0 },
    segments: {},
  });
  const [selectedPeriod, setSelectedPeriod] = useState('latest');
  const [availablePeriods, setAvailablePeriods] = useState([]);

  useEffect(() => {
    fetchMetrics();
  }, [selectedPeriod]);

  async function fetchMetrics() {
    try {
      setLoading(true);

      // Fetch all imports for latest period or specific period
      const query = supabase
        .from('financial_imports')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedPeriod !== 'latest') {
        query.eq('period', selectedPeriod);
      }

      const { data: imports, error } = await query;

      if (error) throw error;

      // Extract unique periods for dropdown
      const periods = [...new Set(imports.map(i => i.period))].filter(Boolean);
      setAvailablePeriods(periods);

      // Calculate metrics from imports
      const newMetrics = calculateMetrics(imports);
      setMetrics(newMetrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateMetrics(imports) {
    const metrics = {
      revenue: { totalIncome: 0, grossProfit: 0, grossMarginPct: 0, netIncome: 0 },
      cash: { balance: 0, operatingCashFlow: 0 },
      ar: { total: 0, over60Pct: 0 },
      ap: { total: 0 },
      payroll: { total: 0, asPercentOfRevenue: 0 },
      segments: {},
    };

    // Find latest P&L
    const pl = imports.find(i => i.type === 'profit_loss');
    if (pl?.summary) {
      metrics.revenue.totalIncome = pl.summary.totalIncome || 0;
      metrics.revenue.grossProfit = pl.summary.grossProfit || 0;
      metrics.revenue.grossMarginPct = pl.summary.grossMarginPct || 0;
      metrics.revenue.netIncome = pl.summary.netIncome || 0;
    }

    // Find latest P&L by Class for segment data
    const plByClass = imports.find(i => i.type === 'profit_loss_by_class');
    if (plByClass?.summary?.byClass) {
      metrics.segments = plByClass.summary.byClass;
    }

    // Find latest Balance Sheet
    const bs = imports.find(i => i.type === 'balance_sheet');
    if (bs?.summary) {
      metrics.cash.balance = bs.summary.cash || 0;
      metrics.ar.total = bs.summary.accountsReceivable || 0;
      metrics.ap.total = bs.summary.accountsPayable || 0;
    }

    // Find latest AR Aging
    const ar = imports.find(i => i.type === 'ar_aging_summary');
    if (ar?.summary) {
      metrics.ar.total = ar.summary.total || metrics.ar.total;
      metrics.ar.over60Pct = ar.summary.over60Pct || 0;
    }

    return metrics;
  }

  function MetricCard({ title, value, subtitle, color = '#3B82F6' }) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 32, fontWeight: 700, color, marginBottom: 4 }}>
          {typeof value === 'number' ? (
            value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`
          ) : value}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: '#6B7280' }}>{subtitle}</div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Loading financial metrics...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>💰 Financial KPIs</h1>
          <p style={{ color: '#6B7280' }}>Key financial metrics from QuickBooks reports</p>
        </div>

        <div>
          <label style={{ fontSize: 14, fontWeight: 500, marginRight: 8 }}>Period:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
            }}
          >
            <option value="latest">Latest</option>
            {availablePeriods.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Revenue & Profit */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Revenue & Profit</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <MetricCard
            title="Total Revenue"
            value={metrics.revenue.totalIncome}
            color="#10B981"
          />
          <MetricCard
            title="Gross Profit"
            value={metrics.revenue.grossProfit}
            subtitle={`${metrics.revenue.grossMarginPct.toFixed(1)}% margin`}
            color="#3B82F6"
          />
          <MetricCard
            title="Net Income"
            value={metrics.revenue.netIncome}
            color={metrics.revenue.netIncome >= 0 ? '#10B981' : '#EF4444'}
          />
        </div>
      </div>

      {/* Segment Profitability */}
      {Object.keys(metrics.segments).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Segment Profitability</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
            {Object.entries(metrics.segments).map(([name, data]) => (
              <MetricCard
                key={name}
                title={name}
                value={data.revenue || 0}
                subtitle={`${(data.marginPct || 0).toFixed(1)}% margin`}
                color="#8B5CF6"
              />
            ))}
          </div>
        </div>
      )}

      {/* Cash & Liquidity */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Cash & Liquidity</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <MetricCard
            title="Cash Balance"
            value={metrics.cash.balance}
            color="#10B981"
          />
          <MetricCard
            title="Accounts Receivable"
            value={metrics.ar.total}
            subtitle={`${metrics.ar.over60Pct.toFixed(1)}% over 60 days`}
            color="#F59E0B"
          />
          <MetricCard
            title="Accounts Payable"
            value={metrics.ap.total}
            color="#EF4444"
          />
        </div>
      </div>

      {/* Company Health Score */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 24,
        color: 'white',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>🎯 Company Health Score</h2>
        <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 8 }}>
          {calculateHealthScore(metrics)}/100
        </div>
        <div style={{ fontSize: 16, opacity: 0.9 }}>
          {getHealthMessage(calculateHealthScore(metrics))}
        </div>
      </div>
    </div>
  );
}

function calculateHealthScore(metrics) {
  let score = 0;
  
  // Profitability (30 points)
  if (metrics.revenue.netIncome > 0) {
    const netMargin = metrics.revenue.totalIncome > 0 
      ? (metrics.revenue.netIncome / metrics.revenue.totalIncome) * 100 
      : 0;
    score += Math.min(30, netMargin * 3);
  }
  
  // Liquidity (25 points)
  const cashToAP = metrics.ap.total > 0 ? metrics.cash.balance / metrics.ap.total : 1;
  score += Math.min(25, cashToAP * 25);
  
  // AR Health (25 points) - lower over60 is better
  const arScore = Math.max(0, 25 - (metrics.ar.over60Pct * 0.5));
  score += arScore;
  
  // Gross Margin (20 points)
  score += Math.min(20, metrics.revenue.grossMarginPct * 0.5);
  
  return Math.round(Math.min(100, score));
}

function getHealthMessage(score) {
  if (score >= 80) return '💪 Excellent: Strong financials across all metrics';
  if (score >= 65) return '👍 Good: Solid performance with room for improvement';
  if (score >= 50) return '⚠️ Fair: Some areas need attention';
  return '🔴 Needs Improvement: Review key metrics closely';
}
