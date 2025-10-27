// src/tabs/Graphs.jsx
import { useEffect, useMemo, useState } from "react";
import useDateRange from "../hooks/useDateRange";
import DateRangePicker from "../components/DateRangePicker";
import { fetchMetrics } from "../lib/fetchMetrics";
import { RANGE_TYPES } from "../lib/dateRanges";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Graphs() {
  const dr = useDateRange(RANGE_TYPES.WEEK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);

  const params = useMemo(
    () => ({
      supabase,
      currentStart: dr.current.start,
      currentEnd: dr.current.end,
      previousStart: dr.previous.start,
      previousEnd: dr.previous.end,
    }),
    [dr.current.start, dr.current.end, dr.previous.start, dr.previous.end]
  );

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!params.currentStart || !params.currentEnd) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMetrics(params);
        if (!ignore) setMetrics(res);
      } catch (e) {
        if (!ignore) setError(e.message || String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [params.currentStart, params.currentEnd, params.previousStart, params.previousEnd]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Graphs</h1>
        <DateRangePicker {...dr} />
      </div>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {loading && <div className="text-sm opacity-70">Loading…</div>}

      {/* Replace the MetricCompare cards below with your existing charts,
          wiring them to the `metrics` object. */}
      {metrics && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <h2 className="font-medium mb-2">Delivery Gallons (current vs previous)</h2>
            <MetricCompare label="Gallons" data={metrics.compare?.delivery?.gallons} />
          </div>

          <div className="border rounded p-3">
            <h2 className="font-medium mb-2">Delivery Revenue (current vs previous)</h2>
            <MetricCompare label="Revenue" data={metrics.compare?.delivery?.revenue} money />
          </div>

          <div className="border rounded p-3">
            <h2 className="font-medium mb-2">Service Revenue (current vs previous)</h2>
            <MetricCompare label="Revenue" data={metrics.compare?.service?.revenue} money />
          </div>

          <div className="border rounded p-3">
            <h2 className="font-medium mb-2">Service Tickets (current vs previous)</h2>
            <MetricCompare label="Count" data={metrics.compare?.service?.count} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCompare({ label, data, money }) {
  if (!data)
    return (
      <div className="text-sm opacity-70">
        No comparison available for the selected range.
      </div>
    );
  const fmt = (v) =>
    money
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v)
      : v.toLocaleString();

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{label}:</span>
        <span>{fmt(data.value)}</span>
      </div>
      <div className="opacity-70">
        Prev: {data.previous !== null ? fmt(data.previous) : "—"}
      </div>
      <div className={data.diff >= 0 ? "text-green-700" : "text-red-700"}>
        Diff: {data.diff >= 0 ? "+" : ""}
        {money ? fmt(data.diff) : data.diff.toLocaleString()}{" "}
        {data.pct === null ? "(n/a)" : `(${data.pct.toFixed(1)}%)`}
      </div>
    </div>
  );
}
