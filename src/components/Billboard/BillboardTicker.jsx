import React, { useEffect, useState, useRef, useCallback } from 'react';
import Marquee from 'react-fast-marquee';
import { supabase } from '../../lib/supabaseClient';
import { getBillboardSummary } from '../../lib/fetchMetricsClient';
import { readRefreshSec, secondsToMs } from '../../lib/readRefreshSec';

/**
 * BillboardTicker.jsx
 * 
 * Polls the server for billboard summary with fallback to client-side Supabase.
 * Features:
 * - Prefers runtime API (window.__ENV.BILLBOARD_API_BASE or VITE_BILLBOARD_API_BASE)
 * - Falls back to client-side getBillboardSummary() if API unavailable
 * - Uses Supabase realtime subscription for instant updates
 * - Configurable refresh interval via VITE_BILLBOARD_REFRESH_SEC
 */
export default function BillboardTicker({ pollInterval = null }) {
  const [items, setItems] = useState([]);
  const [weekCompare, setWeekCompare] = useState(null);
  const mounted = useRef(true);
  const channelRef = useRef(null);

  // Read refresh interval from runtime or build env, default to 30 seconds
  const refreshInterval = pollInterval || secondsToMs(readRefreshSec(30));

  function getApiBase() {
    try {
      // Priority 1: Runtime window.__ENV
      if (typeof window !== 'undefined' && window.__ENV?.BILLBOARD_API_BASE) {
        return String(window.__ENV.BILLBOARD_API_BASE).replace(/\/$/, '');
      }
      // Priority 2: Build-time import.meta.env
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BILLBOARD_API_BASE) {
        return String(import.meta.env.VITE_BILLBOARD_API_BASE).replace(/\/$/, '');
      }
      return '';
    } catch (e) {
      return '';
    }
  }

  function safeNum(v, decimals = 0) {
    const n = Number(v);
    if (!isFinite(n)) return decimals === 0 ? 0 : Number(0).toFixed(decimals);
    return decimals === 0 ? Math.round(n) : Number(n).toFixed(decimals);
  }

  const fetchTicker = useCallback(async () => {
    try {
      const base = getApiBase();
      
      // Try server API first if configured
      if (base) {
        const url = `${base}/api/billboard-summary`;
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            updateTickerFromData(data);
            console.log('[BillboardTicker] Fetched from server API');
            return;
          }
        } catch (apiErr) {
          console.warn('[BillboardTicker] Server API unavailable, falling back to client:', apiErr.message);
        }
      }

      // Fallback to client-side Supabase aggregator
      console.log('[BillboardTicker] Using client-side Supabase aggregator');
      const result = await getBillboardSummary();
      
      if (result.error) {
        console.error('[BillboardTicker] Client aggregator error:', result.error);
        if (mounted.current) setItems(['(data unavailable)']);
        return;
      }

      if (result.data) {
        updateTickerFromData(result.data);
        console.log('[BillboardTicker] Fetched from client aggregator');
      } else {
        console.warn('[BillboardTicker] No data available');
        if (mounted.current) setItems(['(no data)']);
      }
    } catch (err) {
      console.error('[BillboardTicker] fetch error', err);
      if (mounted.current) setItems(['(ticker error)']);
    }
  }, []);

  function updateTickerFromData(data) {
    const delivery = data.deliveryTickets || {};
    const service = data.serviceTracking || {};
    const week = data.weekCompare || {};

    const totalTickets = safeNum(delivery.totalTickets || 0, 0);
    const totalGallons = safeNum(delivery.totalGallons || 0, 1);
    const deliveryRevenue = safeNum(delivery.revenue || 0, 2);

    const completedServices = safeNum(service.completed || 0, 0);
    const serviceRevenue = safeNum(service.completedRevenue || service.revenue || 0, 2);
    const pipeline = safeNum(service.pipelineRevenue || 0, 2);

    const percentChange = Number(week.percentChange ?? 0).toFixed(1);

    const t = [];
    t.push(`Delivery Tickets ${totalTickets} • Gallons Delivered ${totalGallons} gal • Delivery Revenue $${deliveryRevenue}`);
    t.push(`Service Completed ${completedServices} • Service Revenue $${serviceRevenue}`);
    t.push(`Pipeline $${pipeline}`);
    t.push(`Week Performance ${percentChange}%`);

    if (mounted.current) {
      setItems(t);
      setWeekCompare(week);
    }
  }

  useEffect(() => {
    mounted.current = true;

    // Initial fetch
    fetchTicker();

    // Set up polling fallback
    const pollId = setInterval(fetchTicker, refreshInterval);

    // Set up Supabase realtime subscription
    const setupRealtimeSubscription = async () => {
      if (!supabase) {
        console.warn('[BillboardTicker] Supabase not configured, skipping realtime subscription');
        return;
      }

      try {
        // Create a channel for billboard updates
        const channel = supabase
          .channel('public:billboard-updates')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'delivery_tickets' },
            (payload) => {
              console.log('[BillboardTicker] Realtime update from delivery_tickets:', payload);
              fetchTicker();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'service_jobs' },
            (payload) => {
              console.log('[BillboardTicker] Realtime update from service_jobs:', payload);
              fetchTicker();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('[BillboardTicker] Realtime subscription active');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn('[BillboardTicker] Realtime subscription failed, continuing with polling:', status);
            }
          });

        channelRef.current = channel;
      } catch (err) {
        console.warn('[BillboardTicker] Error setting up realtime subscription:', err);
      }
    };

    setupRealtimeSubscription();

    // Listen for forced refresh events (e.g., after markCustomerCompleted)
    const handleBillboardRefresh = (event) => {
      console.log('[BillboardTicker] Forced refresh triggered:', event.detail);
      fetchTicker();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('billboard-refresh', handleBillboardRefresh);
    }

    // Cleanup
    return () => {
      mounted.current = false;
      clearInterval(pollId);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('billboard-refresh', handleBillboardRefresh);
      }
    };
  }, [refreshInterval, fetchTicker]);

  const content = items.join('   •   ');

  return (
    <div>
      <Marquee speed={50} gradient={false} pauseOnHover={false} role="marquee" aria-label="Billboard ticker">
        <div style={{ padding: '0 2rem', fontSize: '1.2rem', whiteSpace: 'nowrap' }}>
          {content}
        </div>
      </Marquee>
    </div>
  );
}

// Export the fetchTicker callback for external use (e.g., forced refresh after RPC)
export { BillboardTicker };
