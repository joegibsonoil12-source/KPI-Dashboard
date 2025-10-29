import React, { useEffect, useState, useRef } from 'react';
import Marquee from 'react-fast-marquee';

/**
 * BillboardTicker.jsx
 * NASDAQ-style marquee that displays key metrics in a continuous scroller.
 * Polls /api/billboard-summary (or VITE_BILLBOARD_API_BASE + /api/billboard-summary) every 15s.
 */
export default function BillboardTicker({ pollInterval = 15000 }) {
  const [items, setItems] = useState([]);
  const mounted = useRef(true);

  function getApiBase() {
    try {
      // import.meta.env is available in Vite builds; fallback to '' for relative paths
      // eslint-disable-next-line no-undef
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BILLBOARD_API_BASE)
        ? String(import.meta.env.VITE_BILLBOARD_API_BASE).replace(/\/$/, '')
        : '';
      return base;
    } catch (e) {
      return '';
    }
  }

  useEffect(() => {
    mounted.current = true;

    async function fetchTicker() {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/billboard-summary`);
        if (!res.ok) {
          console.warn('[BillboardTicker] API not available; using fallback data');
          setItems([
            'Delivery Tickets 0 • Gallons Delivered 0.0 gal • Delivery Revenue $0.00',
            'Service Completed 0 • Service Revenue $0.00',
            'Week Performance 0%'
          ]);
          return;
        }
        const data = await res.json();
        const t = [];

        if (data.deliveryTickets) {
          t.push(
            `Delivery Tickets ${data.deliveryTickets.totalTickets ?? 0} • Gallons Delivered ${Number(data.deliveryTickets.totalGallons ?? 0).toFixed(1)} gal • Delivery Revenue ${Number(data.deliveryTickets.revenue ?? 0).toFixed(2)}`
          );
        }

        if (data.serviceTracking) {
          t.push(
            `Service Completed ${data.serviceTracking.completed ?? 0} • Service Revenue ${Number(data.serviceTracking.completedRevenue ?? 0).toFixed(2)}`
          );
          t.push(
            `Pipeline ${Number(data.serviceTracking.pipelineRevenue ?? 0).toFixed(2)}`
          );
        }

        if (data.weekCompare) {
          t.push(
            `Week Performance ${Number(data.weekCompare.percentChange ?? 0).toFixed(1)}%`
          );
        }

        if (mounted.current) setItems(t.length ? t : ['—']);
      } catch (err) {
        console.error('[BillboardTicker] fetch error', err);
        if (mounted.current) setItems(['(ticker unavailable)']);
      }
    }

    fetchTicker();
    const id = setInterval(fetchTicker, pollInterval);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [pollInterval]);

  const content = items.join('   •   ');

  return (
    <div className="billboard-ticker" aria-hidden={items.length === 0}>
      <Marquee gradient={false} speed={50} pauseOnHover={true}>
        <div style={{ display: 'inline-flex', gap: '2rem', alignItems: 'center', color: 'var(--bb-muted, #9fb0b8)' }}>
          {content}
        </div>
      </Marquee>
    </div>
  );
}
