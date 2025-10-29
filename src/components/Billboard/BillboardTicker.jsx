import React, { useEffect, useState, useRef } from 'react';
import Marquee from 'react-fast-marquee';

/**
 * BillboardTicker.jsx
 * Polls the server for billboard summary and always emits items (zero defaults when no data).
 */
export default function BillboardTicker({ pollInterval = 15000 }) {
  const [items, setItems] = useState([]);
  const mounted = useRef(true);

  function getApiBase() {
    try {
      // import.meta.env is available in Vite builds
      // eslint-disable-next-line no-undef
      const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BILLBOARD_API_BASE)
        ? String(import.meta.env.VITE_BILLBOARD_API_BASE).replace(/\/$/, '')
        : '';
      return base;
    } catch (e) {
      return '';
    }
  }

  function safeNum(v, decimals = 0) {
    const n = Number(v);
    if (!isFinite(n)) return decimals === 0 ? 0 : Number(0).toFixed(decimals);
    return decimals === 0 ? Math.round(n) : Number(n).toFixed(decimals);
  }

  useEffect(() => {
    mounted.current = true;

    async function fetchTicker() {
      try {
        const base = getApiBase();
        const url = `${base}/api/billboard-summary`;
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) {
          console.warn('[BillboardTicker] API not available; using fallback zeros');
          setItems([
            'Delivery Tickets 0 • Gallons Delivered 0.0 gal • Delivery Revenue $0.00',
            'Service Completed 0 • Service Revenue $0.00',
            'Week Performance 0%'
          ]);
          return;
        }

        const data = await res.json();
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
        t.push(`Delivery Tickets ${totalTickets} • Gallons Delivered ${totalGallons} gal • Delivery Revenue ${deliveryRevenue}`);
        t.push(`Service Completed ${completedServices} • Service Revenue ${serviceRevenue}`);
        t.push(`Pipeline ${pipeline}`);
        t.push(`Week Performance ${percentChange}%`);

        if (mounted.current) setItems(t);
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
    <Marquee speed={50} gradient={false} pauseOnHover={false}>
      <div style={{ padding: '0 2rem', fontSize: '1.2rem', whiteSpace: 'nowrap' }}>
        {content}
      </div>
    </Marquee>
  );
}
