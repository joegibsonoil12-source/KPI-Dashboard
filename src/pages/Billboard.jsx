import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import WeeklyTicker from "../components/WeeklyTicker";
// Fixed import casing to match actual filename on disk (src/components/rollingticker.jsx)
import RollingTicker from "../components/rollingticker";

/**
 * Billboard - extended:
 * - robust service table handling (tries fallbacks)
 * - popup/kiosk URL builder that respects GitHub Pages base path
 * - unobtrusive service notice when missing
 * - integrated RollingTicker (NASDAQ-like roller)
 */

export default function Billboard() {
  const [deliveryData, setDeliveryData] = useState({
    thisWeek: { tickets: 0, gallons: 0, revenue: 0 },
    lastWeek: { tickets: 0, gallons: 0, revenue: 0 }
  });

  const [serviceData, setServiceData] = useState({
    thisWeek: { tickets: 0, gallons: 0, revenue: 0 },
    lastWeek: { tickets: 0, gallons: 0, revenue: 0 }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [serviceTableExists, setServiceTableExists] = useState(true);
  const [serviceNotice, setServiceNotice] = useState(null);

  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const intervalRef = useRef(null);

  // kiosk detection: ?kiosk=1
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const kiosk = params.get("kiosk") === "1";

  const getWeekBounds = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    weekEnd.setHours(0, 0, 0, 0);
    return { weekStart, weekEnd };
  };

  // try multiple tables, return first that works or empty data
  async function tryFetchFromTables(tables, gteField, ltField, startISO, endISO) {
    const attempts = [];
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .gte(gteField, startISO)
          .lt(ltField, endISO)
          .limit(10000);
        if (error) {
          attempts.push({ table, error });
          // continue trying other table names for missing relation or permission
          continue;
        }
        return { table, data: data || [], attempts };
      } catch (e) {
        attempts.push({ table, exception: e });
        continue;
      }
    }
    return { table: null, data: [], attempts, error: new Error("no-table-found") };
  }

  // delivery metrics (keeps your field names)
  const fetchDeliveryMetrics = async () => {
    const now = new Date();
    const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getWeekBounds(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const { data: thisWeekTickets, error: thisWeekError } = await supabase
      .from("delivery_tickets")
      .select("*")
      .gte("delivery_date", thisWeekStart.toISOString())
      .lt("delivery_date", thisWeekEnd.toISOString());

    if (thisWeekError) throw thisWeekError;

    const { data: lastWeekTickets, error: lastWeekError } = await supabase
      .from("delivery_tickets")
      .select("*")
      .gte("delivery_date", lastWeekStart.toISOString())
      .lt("delivery_date", lastWeekEnd.toISOString());

    if (lastWeekError) throw lastWeekError;

    const thisWeek = {
      tickets: thisWeekTickets?.length || 0,
      gallons: thisWeekTickets?.reduce((s, t) => s + (parseFloat(t.gallons) || 0), 0) || 0,
      revenue: thisWeekTickets?.reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0) || 0
    };

    const lastWeek = {
      tickets: lastWeekTickets?.length || 0,
      gallons: lastWeekTickets?.reduce((s, t) => s + (parseFloat(t.gallons) || 0), 0) || 0,
      revenue: lastWeekTickets?.reduce((s, t) => s + (parseFloat(t.total_amount) || 0), 0) || 0
    };

    setDeliveryData({ thisWeek, lastWeek });
  };

  // service metrics with fallback table names and graceful handling
  const fetchServiceMetrics = async () => {
    const now = new Date();
    const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getWeekBounds(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);

    const startISO = thisWeekStart.toISOString();
    const endISO = thisWeekEnd.toISOString();
    const lastStartISO = lastWeekStart.toISOString();
    const lastEndISO = lastWeekEnd.toISOString();

    const possible = ["service_tickets", "service_jobs", "service_orders"];
    const res = await tryFetchFromTables(possible, "date", "date", startISO, endISO);

    if (res.error || !res.table) {
      // show unobtrusive notice, keep placeholders
      setServiceTableExists(false);
      setServiceNotice("Service tracking not available — showing placeholders.");
      console.warn("Billboard service fetch attempts:", res.attempts);
      return;
    }

    setServiceTableExists(true);
    setServiceNotice(null);

    const thisWeekTickets = res.data || [];

    // fetch last week from the same table
    let lastWeekTickets = [];
    try {
      const { data: lwData, error: lwErr } = await supabase
        .from(res.table)
        .select("*")
        .gte("date", lastStartISO)
        .lt("date", lastEndISO)
        .limit(10000);
      if (lwErr) {
        console.warn("Billboard: error fetching last-week service rows:", lwErr);
      } else lastWeekTickets = lwData || [];
    } catch (e) {
      console.warn("Billboard: exception fetching last-week service rows:", e);
    }

    const thisWeek = {
      tickets: thisWeekTickets?.length || 0,
      gallons: 0,
      revenue: thisWeekTickets?.reduce((s, t) => s + (parseFloat(t.total) || 0), 0) || 0
    };
    const lastWeek = {
      tickets: lastWeekTickets?.length || 0,
      gallons: 0,
      revenue: lastWeekTickets?.reduce((s, t) => s + (parseFloat(t.total) || 0), 0) || 0
    };

    setServiceData({ thisWeek, lastWeek });
  };

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchDeliveryMetrics();
      await fetchServiceMetrics();
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error loading metrics:", err);
      setError(err?.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    intervalRef.current = setInterval(loadMetrics, intervalSeconds * 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalSeconds]);

  // Build kiosk URL that respects GitHub Pages base path (prevents 404)
  function buildKioskUrl() {
    if (typeof window === "undefined") return "/billboard?kiosk=1";
    const origin = window.location.origin;
    const pathname = window.location.pathname || "/";
    // If the pathname already contains /billboard, strip that part to get base
    const base = pathname.split("/billboard")[0].replace(/\/$/, "");
    return origin + (base || "") + "/billboard?kiosk=1";
  }

  // Popout for kiosk
  function openKiosk() {
    const url = buildKioskUrl();
    const features = "toolbar=0,location=0,status=0,menubar=0,scrollbars=1,resizable=1,width=1280,height=720";
    window.open(url, "Billboard", features);
  }

  // prepare rolling ticker items (NASDAQ style)
  function buildRollerItems() {
    const items = [];
    const dT = deliveryData.thisWeek;
    const dL = deliveryData.lastWeek;
    const sT = serviceData.thisWeek;
    const sL = serviceData.lastWeek;

    // deliveries
    items.push({ label: "Deliveries - Tickets (this wk)", value: dT.tickets, change: dT.tickets - dL.tickets });
    items.push({ label: "Deliveries - Gallons (this wk)", value: Math.round(dT.gallons), change: Math.round(dT.gallons - dL.gallons) });
    items.push({ label: "Deliveries - Revenue (this wk)", value: `$${Math.round(dT.revenue)}`, change: Math.round(dT.revenue - dL.revenue) });

    // service (placeholders if missing)
    items.push({ label: "Service - Tickets (this wk)", value: sT.tickets, change: sT.tickets - sL.tickets });
    items.push({ label: "Service - Revenue (this wk)", value: `$${Math.round(sT.revenue)}`, change: Math.round(sT.revenue - sL.revenue) });

    // some quick ratios (guard div by zero)
    const onTimePct = dL.tickets ? Math.round(((dT.tickets / (dL.tickets || 1)) - 1) * 100) : 0;
    items.push({ label: "Deliveries - Week % vs last", value: `${onTimePct}%`, change: onTimePct });

    return items;
  }

  if (loading && !lastUpdate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-2xl font-semibold">Loading metrics...</p>
        </div>
      </div>
    );
  }

  const pageWrapper = kiosk ? "min-h-screen bg-black text-white p-6" : "min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8";

  return (
    <div className={pageWrapper}>
      {/* header (hidden in kiosk) */}
      {!kiosk && (
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-5xl font-bold text-white mb-2">Weekly Performance Dashboard</h1>
            <p className="text-lg text-gray-300">This Week vs Last Week</p>
          </div>

          <div className="flex flex-col items-end">
            {lastUpdate && <p className="text-sm text-gray-400">Last updated: {lastUpdate.toLocaleTimeString()}</p>}
            <div className="mt-3 flex items-center gap-3">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white" onClick={openKiosk}>Pop out (Kiosk)</button>
              <label className="text-gray-300">Auto-refresh:</label>
              <select value={intervalSeconds} onChange={(e) => setIntervalSeconds(Number(e.target.value))} className="rounded px-2 py-1 bg-gray-800 text-white">
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={120}>2m</option>
                <option value={300}>5m</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* rolling/nasdaq style ticker */}
      <div className="mb-4">
        <RollingTicker items={buildRollerItems()} kiosk={kiosk} />
      </div>

      {/* small service notice (non-blocking) */}
      {!kiosk && serviceNotice && (
        <div className="mb-6 p-3 rounded bg-yellow-50 text-yellow-800 border border-yellow-100">
          {serviceNotice}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 mb-8 rounded-lg">
          <p className="font-bold text-xl">Error</p>
          <p className="text-lg">{error}</p>
        </div>
      )}

      {/* metrics */}
      <div className={`grid gap-8 ${kiosk ? "grid-cols-1" : "grid-cols-2"}`}>
        <WeeklyTicker
          title="Deliveries"
          thisWeek={deliveryData.thisWeek}
          lastWeek={deliveryData.lastWeek}
          unitLabels={{ tickets: "stops", gallons: "gal", revenue: "$" }}
        />

        {serviceTableExists ? (
          <WeeklyTicker
            title="Service"
            thisWeek={serviceData.thisWeek}
            lastWeek={serviceData.lastWeek}
            unitLabels={{ tickets: "jobs", gallons: "", revenue: "$" }}
          />
        ) : (
          <div className="rounded-xl border p-6 bg-white shadow-md">
            <h3 className="text-2xl font-bold mb-4">Service</h3>
            <div className="py-12 text-center text-gray-500">
              <p className="text-xl">Service tracking not configured</p>
              <p className="text-sm mt-2 text-gray-400">Showing placeholders — contact your administrator if you expect service data.</p>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      {!kiosk && (
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Auto-refreshes every {intervalSeconds} seconds • Week starts on Sunday</p>
        </div>
      )}
    </div>
  );
}
