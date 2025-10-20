import React, { useEffect, useMemo, useState } from "react";

/*
WeeklyTicker (updated)
- Props:
  - title: string
  - thisWeek: { tickets, gallons, revenue }
  - lastWeek: { tickets, gallons, revenue }
  - highlight: "gallons" | "revenue" | "tickets"
  - unitLabels: { tickets, gallons, revenue }
- Features:
  - Animated progress bar behind each metric (fills toward beating last week)
  - Smooth count-up for metric numbers
  - Entrance fade/scale animation on mount
  - Tolerant of missing data (coerces to 0)
*/

function useCountUp(value = 0, duration = 750) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let raf = null;
    const start = performance.now();
    const from = Number(display) || 0;
    const to = Number(value) || 0;
    if (from === to) {
      setDisplay(to);
      return;
    }
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = from + (to - from) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else raf = null;
    }
    raf = requestAnimationFrame(tick);
    return () => { if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return display;
}

export default function WeeklyTicker({
  title = "Deliveries",
  thisWeek = { tickets: 0, gallons: 0, revenue: 0 },
  lastWeek = { tickets: 0, gallons: 0, revenue: 0 },
  highlight = "gallons",
  unitLabels = { tickets: "stops", gallons: "gal", revenue: "$" },
}) {
  // Coerce to numbers and guard null/undefined
  const TW = {
    tickets: Number(thisWeek?.tickets || 0),
    gallons: Number(thisWeek?.gallons || 0),
    revenue: Number(thisWeek?.revenue || 0),
  };
  const LW = {
    tickets: Number(lastWeek?.tickets || 0),
    gallons: Number(lastWeek?.gallons || 0),
    revenue: Number(lastWeek?.revenue || 0),
  };

  const delta = {
    tickets: TW.tickets - LW.tickets,
    gallons: TW.gallons - LW.gallons,
    revenue: TW.revenue - LW.revenue,
  };

  const pctChange = (k) =>
    LW[k] === 0 ? (TW[k] === 0 ? 0 : 100) : ((delta[k] / Math.abs(LW[k])) * 100);

  const percentComplete = (k) => {
    // If last week is zero: treat as complete if this week > 0 (so bar shows full)
    if (LW[k] === 0) return TW[k] > 0 ? 100 : 0;
    const p = Math.round((TW[k] / LW[k]) * 100);
    return Math.max(0, Math.min(100, p));
  };

  // animated values
  const displayTickets = useCountUp(TW.tickets, 750);
  const displayGallons = useCountUp(TW.gallons, 750);
  const displayRevenue = useCountUp(TW.revenue, 750);

  // mount animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(id);
  }, []);

  const metrics = useMemo(() => ([
    { key: "tickets", label: "Tickets", val: TW.tickets, display: displayTickets, unit: unitLabels.tickets },
    { key: "gallons", label: "Gallons", val: TW.gallons, display: displayGallons, unit: unitLabels.gallons },
    { key: "revenue", label: "Revenue", val: TW.revenue, display: displayRevenue, unit: unitLabels.revenue },
  ]), [TW, displayTickets, displayGallons, displayRevenue, unitLabels]);

  return (
    <div
      className={`rounded-lg border p-6 bg-white shadow-lg transform transition duration-500 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      style={{ minWidth: 420 }}
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="text-sm text-slate-500">This week vs Last week</div>
      </div>

      <div className="mt-4 space-y-6">
        {metrics.map((m) => {
          const key = m.key;
          const isHighlight = key === highlight;
          const pct = percentComplete(key);
          const lastVal = LW[key];
          const dimLast = lastVal || 0;
          const deltaValue = delta[key];

          return (
            <div key={key} className="relative">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-xs text-slate-600">{m.label}</div>
                  <div className={`mt-1 ${isHighlight ? "text-4xl font-extrabold" : "text-3xl font-semibold"}`}>
                    {/* formatted display */}
                    {key === "revenue" ? (
                      <span>{(Number(m.display) || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</span>
                    ) : (
                      <span>{Math.round(m.display).toLocaleString()}</span>
                    )}
                    {key !== "revenue" && <span className="text-sm text-slate-500"> {m.unit}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg ${deltaValue < 0 ? "text-red-600" : "text-green-600"} font-medium`}>
                    {deltaValue < 0 ? "-" : "+"}{Math.abs(Math.round(deltaValue)).toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-500">
                    Last: {key === "revenue" ? `$${Number(dimLast || 0).toFixed(0)}` : Number(dimLast || 0).toLocaleString()} · ({pctChange(key).toFixed(0)}%)
                  </div>
                </div>
              </div>

              {/* Progress bar background */}
              <div className="mt-3 h-3 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${m.label} progress`}>
                <div
                  className="h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg,#34d399 0%,#60a5fa 100%)"
                  }}
                />
              </div>

              {/* small goal text */}
              <div className="mt-2 text-sm">
                {Math.max(0, (LW[key] || 0) - (TW[key] || 0)) > 0 ? (
                  <span className="text-orange-600">Need {key === "revenue" ? `$${(Math.max(0, (LW[key] || 0) - (TW[key] || 0))).toFixed(0)}` : (Math.max(0, (LW[key] || 0) - (TW[key] || 0))).toLocaleString()} more to beat last week</span>
                ) : (
                  <span className="text-green-600 font-medium">On track — beat last week!</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
