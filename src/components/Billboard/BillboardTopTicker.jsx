// src/components/Billboard/BillboardTopTicker.jsx
import React, { useEffect, useState } from 'react';
import Marquee from 'react-fast-marquee';

/**
 * BillboardTopTicker - NASDAQ-style scrolling ticker
 * Prefers server API via VITE_BILLBOARD_API_BASE or window.__ENV.BILLBOARD_API_BASE
 * Falls back to client getBillboardSummary() if no API endpoint available
 */

// Helper to get billboard data from client-side Supabase
async function getBillboardSummary() {
  try {
    const { supabase } = await import('../../lib/supabaseClient.js');
    
    // Fetch current week data
    const { data: currentWeek, error: currentError } = await supabase
      .from('billboard_metrics')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .single();
    
    if (currentError) throw currentError;
    
    // Fetch previous week for comparison
    const { data: previousWeek } = await supabase
      .from('billboard_metrics')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .range(1, 1)
      .single();
    
    return {
      revenue: currentWeek?.revenue || 0,
      gallons: currentWeek?.gallons || 0,
      deliveries: currentWeek?.deliveries || 0,
      margin: currentWeek?.margin || 0,
      revenueChange: previousWeek 
        ? ((currentWeek.revenue - previousWeek.revenue) / previousWeek.revenue * 100).toFixed(1)
        : 0,
      gallonsChange: previousWeek
        ? ((currentWeek.gallons - previousWeek.gallons) / previousWeek.gallons * 100).toFixed(1)
        : 0,
    };
  } catch (err) {
    console.error('[BillboardTopTicker] Error fetching from Supabase:', err);
    return null;
  }
}

export default function BillboardTopTicker({ pollInterval = 30000 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine API base URL from runtime config or env vars
  const getApiBase = () => {
    // Priority 1: window.__ENV (runtime injection for GitHub Pages / static hosting)
    if (typeof window !== 'undefined' && window.__ENV?.BILLBOARD_API_BASE) {
      return window.__ENV.BILLBOARD_API_BASE;
    }
    // Priority 2: Vite env var
    if (import.meta.env.VITE_BILLBOARD_API_BASE) {
      return import.meta.env.VITE_BILLBOARD_API_BASE;
    }
    // Priority 3: No API, use client-side fallback
    return null;
  };

  const fetchData = async () => {
    try {
      const apiBase = getApiBase();
      
      if (apiBase) {
        // Use server API
        const response = await fetch(`${apiBase}/api/billboard-summary`);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const json = await response.json();
        setData(json);
        setError(null);
      } else {
        // Fallback to client-side Supabase query
        const summary = await getBillboardSummary();
        if (summary) {
          setData(summary);
          setError(null);
        } else {
          throw new Error('No data available');
        }
      }
    } catch (err) {
      console.error('[BillboardTopTicker] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  if (loading) {
    return (
      <div className="billboard-top-ticker-loading">
        <span>Loading ticker data...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="billboard-top-ticker-error">
        <span>Unable to load ticker data</span>
      </div>
    );
  }

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('en-US').format(val);
  };

  const formatChange = (change) => {
    const num = parseFloat(change);
    const isPositive = num >= 0;
    return {
      value: `${isPositive ? '+' : ''}${num.toFixed(1)}%`,
      className: isPositive ? 'positive' : 'negative',
    };
  };

  const revenueChange = formatChange(data.revenueChange || 0);
  const gallonsChange = formatChange(data.gallonsChange || 0);

  return (
    <div className="billboard-top-ticker-container">
      <Marquee speed={50} gradient={false}>
        <div className="billboard-top-ticker-item">
          <span className="billboard-top-ticker-label">Revenue</span>
          <span className="billboard-top-ticker-value">{formatCurrency(data.revenue)}</span>
          <span className={`billboard-top-ticker-change ${revenueChange.className}`}>
            {revenueChange.value}
          </span>
        </div>
        
        <div className="billboard-top-ticker-item">
          <span className="billboard-top-ticker-label">Gallons</span>
          <span className="billboard-top-ticker-value">{formatNumber(data.gallons)}</span>
          <span className={`billboard-top-ticker-change ${gallonsChange.className}`}>
            {gallonsChange.value}
          </span>
        </div>
        
        <div className="billboard-top-ticker-item">
          <span className="billboard-top-ticker-label">Deliveries</span>
          <span className="billboard-top-ticker-value">{formatNumber(data.deliveries)}</span>
        </div>
        
        <div className="billboard-top-ticker-item">
          <span className="billboard-top-ticker-label">Margin</span>
          <span className="billboard-top-ticker-value">{data.margin.toFixed(2)}%</span>
        </div>
      </Marquee>
    </div>
  );
}
