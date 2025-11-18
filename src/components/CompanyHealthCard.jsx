/**
 * Company Health Score Card Component
 * 
 * Displays overall company health based on financial metrics
 * Fetches latest financial imports and calculates composite score
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CompanyHealthCard() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ score: null, message: '' });

  useEffect(() => {
    fetchHealthScore();
  }, []);

  async function fetchHealthScore() {
    try {
      // Fetch latest financial imports
      const { data: imports, error } = await supabase
        .from('financial_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Calculate metrics
      const pl = imports?.find(i => i.type === 'profit_loss');
      const bs = imports?.find(i => i.type === 'balance_sheet');
      const ar = imports?.find(i => i.type === 'ar_aging_summary');

      if (!pl && !bs) {
        setHealth({ score: null, message: 'No financial data available' });
        setLoading(false);
        return;
      }

      const metrics = {
        revenue: {
          totalIncome: pl?.summary?.totalIncome || 0,
          netIncome: pl?.summary?.netIncome || 0,
          grossMarginPct: pl?.summary?.grossMarginPct || 0,
        },
        cash: {
          balance: bs?.summary?.cash || 0,
        },
        ar: {
          total: bs?.summary?.accountsReceivable || ar?.summary?.total || 0,
          over60Pct: ar?.summary?.over60Pct || 0,
        },
        ap: {
          total: bs?.summary?.accountsPayable || 0,
        },
      };

      const score = calculateHealthScore(metrics);
      const message = getHealthMessage(score);

      setHealth({ score, message });
    } catch (error) {
      console.error('Error fetching health score:', error);
      setHealth({ score: null, message: 'Error loading data' });
    } finally {
      setLoading(false);
    }
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
    if (score >= 80) return '💪 Excellent: Strong financials';
    if (score >= 65) return '👍 Good: Solid performance';
    if (score >= 50) return '⚠️ Fair: Some areas need attention';
    return '🔴 Needs Improvement';
  }

  if (loading) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        borderRadius: 12,
        padding: 16,
        color: 'white',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, opacity: 0.9 }}>Loading...</div>
      </div>
    );
  }

  if (health.score === null) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: 12,
        padding: 16,
      }}>
        <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
          Company Health
        </div>
        <div style={{ fontSize: 14, color: '#9CA3AF' }}>
          {health.message}
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
          Upload QuickBooks reports in Financial Health tab
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: 12,
      padding: 16,
      color: 'white',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    }}
    onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
    onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
    onClick={() => {
      // Navigate to financial health tab
      window.dispatchEvent(new CustomEvent('navigateToFinancial'));
    }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 }}>
        Company Health
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>
        {health.score}/100
      </div>
      <div style={{ fontSize: 13, opacity: 0.95, marginTop: 4 }}>
        {health.message}
      </div>
    </div>
  );
}
