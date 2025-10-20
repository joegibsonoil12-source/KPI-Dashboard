import React, { useEffect, useMemo, useState } from "react";

/*
Animated WeeklyTicker
- Props:
  - title
  - thisWeek: { tickets, gallons, revenue }
  - lastWeek: { tickets, gallons, revenue }
  - unitLabels (optional)
- Features:
  - smooth count-up for numbers (useCountUp)
  - progress bar that fills to percentComplete (transition-all duration-1000 ease-out)
  - entrance fade/scale
  - tolerant of missing/null values
*/

function useCountUp(value = 0, duration = 750) {
  const [display, setDisplay] = useState(Number(value || 0));
  useEffect(() => {
    const from = Number(display || 0);
    const to = Number(value || 0);
    if (from === to) {
      setDisplay(to);
      return;
    }
    let raf = null;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (to - from) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
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
  unitLabels = { tickets: "stops", gallons: "gal", revenue: "$" },
}) {
  // normalize values
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

  const pctChange = (k) => (LW[k] === 0 ? (TW[k] === 0 ? 0 : 100) : ((delta[k] / Math.abs(LW[k])) * 100));

  const percentComplete = (k) => {
    if (LW[k] === 0) return TW[k] > 0 ? 100 : 0;
    const p = Math.round((TW[k] / LW[k]) * 100);
    return Math.max(0, Math.min(100, p));
  };

  // animated displays
  const displayTickets = useCountUp(TW.tickets, 750);
  const displayGallons = useCountUp(TW.gallons, 750);
  const displayRevenue = useCountUp(TW.revenue, 750);

  // entrance
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 15);
    return () => clearTimeout(id);
  }, []);

  const metrics = useMemo(() => ([
    { key: "tickets", label: "Tickets", val: TW.tickets, display: displayTickets, unit: unitLabels.tickets },
    { key: "gallons",  label: "Gallons",  val: TW.gallons,  display: displayGallons,  unit: unitLabels.gallons },
    { key: "revenue",  label: "Revenue",  val: TW.revenue,  display: displayRevenue,  unit: unitLabels.revenue },
  ]), [TW, displayTickets, displayGallons, displayRevenue, unitLabels]);

  return (
    <div
      className={`rounded-xl border p-6 bg-white shadow-md transform transition duration-500 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      style={{ minWidth: 360 }}
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-2xl font-bold">{title}</h3>
        <div className="text-sm text-slate-500">This week vs Last</div>
      </div>

      <div className="space-y-6">
        {metrics.map((m) => {
          const pct = percentComplete(m.key);
          const d = Math.round(m.display);
          const lastVal = LW[m.key] || 0;
          const deltaVal = delta[m.key] || 0;
          return (
            <div key={m.key} className="relative">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-slate-600">{m.label}</div>
                  <div className={`mt-1 ${m.key === "gallons" ? "text-3xl" : "text-3xl"} font-extrabold`}>
                    {m.key === "revenue"
                      ? (Number(d).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }))
                      : d.toLocaleString()
                    }
                    {m.key !== "revenue" && <span className="text-sm text-slate-500"> {m.unit}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-lg ${deltaVal < 0 ? "text-red-600" : "text-green-600"} font-medium`}>
                    {deltaVal < 0 ? "-" : "+"}{Math.abs(Math.round(deltaVal)).toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-500">
                    Last: {m.key === "revenue" ? `$${Number(lastVal).toFixed(0)}` : Number(lastVal).toLocaleString()} · ({pctChange(m.key).toFixed(0)}%)
                  </div>
                </div>
              </div>

              {/* progress bar */}
              <div
                className="mt-3 h-3 rounded-full bg-slate-200 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label={`${m.label} progress`}
              >
                <div
                  className="h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg,#60a5fa 0%,#34d399 100%)"
                  }}
                />
              </div>

              <div className="mt-2 text-sm">
                {Math.max(0, (lastVal || 0) - (m.val || 0)) > 0 ? (
                  <span className="text-orange-600">
                    Need {m.key === "revenue" ? `$${(Math.max(0, (lastVal || 0) - (m.val || 0))).toFixed(0)}` : (Math.max(0, (lastVal || 0) - (m.val || 0))).toLocaleString()} more to beat last week
                  </span>
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
