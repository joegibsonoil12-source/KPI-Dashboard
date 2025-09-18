import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/*
Props:
- metric: string (e.g. "production", "revenue", "downtime")
- title: string to show above the chart
- chartType: "line" | "bar"
- refreshIntervalMs: optional number (defaults to 60000)
*/
export default function KpiChart({
  metric,
  title,
  chartType = "line",
  refreshIntervalMs = 60000,
}) {
  const [dataPoints, setDataPoints] = useState({ labels: [], values: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set REACT_APP_API_BASE in .env if you have an API, e.g. REACT_APP_API_BASE=https://api.mycompany.com
  const apiBase = process.env.REACT_APP_API_BASE || "";
  // Optional: REACT_APP_API_TOKEN (Bearer token) for auth
  const apiToken = process.env.REACT_APP_API_TOKEN || "";

  async function parsePayload(payload) {
    // payload can be { labels: [...], values: [...] } OR [{date, value}, ...] OR metric keyed object from sample file
    if (!payload) throw new Error("Empty payload");

    // If payload has metric keys (sample-kpis.json), get the metric
    if (payload[metric]) {
      const metricPayload = payload[metric];
      if (Array.isArray(metricPayload)) {
        const labels = metricPayload.map((p) => p.date || p.label);
        const values = metricPayload.map((p) => p.value ?? p.y ?? 0);
        return { labels, values };
      } else if (metricPayload.labels && metricPayload.values) {
        return { labels: metricPayload.labels, values: metricPayload.values };
      }
    }

    if (Array.isArray(payload)) {
      const labels = payload.map((p) => p.date || p.label);
      const values = payload.map((p) => p.value ?? p.y ?? 0);
      return { labels, values };
    } else if (payload.labels && payload.values) {
      return { labels: payload.labels, values: payload.values };
    }

    throw new Error("Unexpected payload shape");
  }

  async function fetchFromApi() {
    const url = `${apiBase}/api/kpis?metric=${encodeURIComponent(metric)}`;
    const headers = {};
    if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API fetch error ${res.status}`);
    return res.json();
  }

  async function fetchFromSampleFile() {
    const res = await fetch("/sample-kpis.json");
    if (!res.ok) throw new Error("Failed to load sample-kpis.json");
    return res.json();
  }

  async function fetchKpi() {
    try {
      setError(null);
      setLoading(true);

      // Try real API first (only if REACT_APP_API_BASE is set); otherwise go to sample.
      let payload;
      if (apiBase) {
        try {
          payload = await fetchFromApi();
        } catch (err) {
          console.warn("Primary API fetch failed, falling back to sample:", err);
          payload = await fetchFromSampleFile();
        }
      } else {
        payload = await fetchFromSampleFile();
      }

      const parsed = await parsePayload(payload);
      setDataPoints(parsed);
    } catch (err) {
      console.error("KPI fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKpi();
    const t = setInterval(fetchKpi, refreshIntervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, refreshIntervalMs, apiBase, apiToken]);

  if (loading && dataPoints.labels.length === 0)
    return (
      <div className="gibson-card" style={{ padding: 18 }}>
        Loading {title}…
      </div>
    );
  if (error)
    return (
      <div className="gibson-card" style={{ padding: 18 }}>
        Error loading {title}: {error}
      </div>
    );

  const chartData = {
    labels: dataPoints.labels,
    datasets: [
      {
        label: title,
        data: dataPoints.values,
        fill: true,
        backgroundColor: "rgba(182,190,130,0.12)",
        borderColor: "rgba(182,190,130,0.9)",
        tension: 0.2,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false, text: title },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { display: true },
      y: { display: true, beginAtZero: true },
    },
  };

  return (
    <div className="gibson-card" style={{ padding: 18 }}>
      <h3 style={{ margin: "0 0 12px 0" }}>{title}</h3>
      {chartType === "bar" ? (
        <Bar data={chartData} options={options} />
      ) : (
        <Line data={chartData} options={options} />
      )}
    </div>
  );
}
