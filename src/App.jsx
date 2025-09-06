import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/**
 * KPI Dashboard Website — Visuals + Editable Data (Fixed)
 * --------------------------------------------------
 * - Charts (line, area, bar, pie)
 * - Manual Data Entry (now editable)
 * - Targets panel (editable)
 * - View-only toggle (default ON)
 * - Save/Load/Reset (localStorage)
 * - Scenario presets (Baseline, Stretch, Downside)
 */

const sampleHistory = [
  { month: "Jan", grossMargin: 0.43, ebitdaPct: 0.11, sgaPct: 0.22, workingCapital: 180000 },
  { month: "Feb", grossMargin: 0.46, ebitdaPct: 0.12, sgaPct: 0.215, workingCapital: 192000 },
  { month: "Mar", grossMargin: 0.47, ebitdaPct: 0.135, sgaPct: 0.21, workingCapital: 205000 },
  { month: "Apr", grossMargin: 0.49, ebitdaPct: 0.14, sgaPct: 0.205, workingCapital: 212000 },
  { month: "May", grossMargin: 0.51, ebitdaPct: 0.16, sgaPct: 0.20, workingCapital: 219000 },
  { month: "Jun", grossMargin: 0.52, ebitdaPct: 0.165, sgaPct: 0.198, workingCapital: 225000 },
  { month: "Jul", grossMargin: 0.5, ebitdaPct: 0.155, sgaPct: 0.205, workingCapital: 221000 },
  { month: "Aug", grossMargin: 0.53, ebitdaPct: 0.17, sgaPct: 0.197, workingCapital: 231500 },
  { month: "Sep", grossMargin: 0.545, ebitdaPct: 0.175, sgaPct: 0.195, workingCapital: 238000 },
];

const sampleKpis = {
  revenue: 1650000,
  headcount: 21,
  revenuePerEmployee: 1650000 / 21,
  newCustomers: 42,
  salesMktgSpend: 98000,
  cac: 98000 / 42,
  currentAssets: 620000,
  currentLiabilities: 380000,
  workingCapital: 620000 - 380000,
  grossMargin: 0.545,
  sgaPct: 0.195,
  ebitdaPct: 0.175,
  trainingPct: 0.015,
  poorQualityPct: 0.022,
};

const defaultTargets = {
  grossMargin: 0.5,
  ebitdaPct: 0.18,
  sgaPct: 0.2,
  revenuePerEmployee: 120000,
  cac: 2500,
  workingCapital: 200000,
  trainingPct: 0.02,
  poorQualityPct: 0.015,
};

const STORAGE_KEY = "kpiDashboardState:v1";

const scenarios = {
  Baseline: { ...sampleKpis },
  Stretch: { ...sampleKpis, grossMargin: 0.58, ebitdaPct: 0.20, sgaPct: 0.18 },
  Downside: { ...sampleKpis, grossMargin: 0.45, ebitdaPct: 0.12, sgaPct: 0.25 },
};

function formatPct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function formatMoney(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function KpiCard({ title, value, target, invert = false, formatter = (v) => v, children }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
      <div className="mt-2 text-2xl font-bold text-slate-900">{formatter(value)}</div>
      {target != null && (
        <div className="mt-1 text-xs text-slate-500">Target: {formatter(target)}</div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function KpiDashboardSite() {
  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [kpi, setKpi] = useState(sampleKpis);
  const [history, setHistory] = useState(sampleHistory);
  const [viewOnly, setViewOnly] = useState(true);
  const fileInputRef = useRef(null);

  // Persistence
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.kpi) setKpi(parsed.kpi);
      if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
      if (parsed.history) setHistory(parsed.history);
    } catch {}
  }, []);
  const saveState = () => {
    const payload = { kpi, kpiTargets, history, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    alert("Saved.");
  };
  const loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return alert("No saved data.");
    try {
      const parsed = JSON.parse(raw);
      if (parsed.kpi) setKpi(parsed.kpi);
      if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
      if (parsed.history) setHistory(parsed.history);
      alert("Loaded.");
    } catch {
      alert("Could not load.");
    }
  };
  const resetDefaults = () => {
    if (!confirm("Reset to defaults?")) return;
    setKpi(sampleKpis);
    setKpiTargets(defaultTargets);
    setHistory(sampleHistory);
  };
  const exportJson = () => {
    const payload = { kpi, kpiTargets, history };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kpi-dashboard-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
        alert("Imported.");
      } catch {
        alert("Invalid JSON.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(f);
  };

  // Derived series
  const revPerEmpSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: kpi.revenuePerEmployee })),
    [history, kpi.revenuePerEmployee]
  );
  const marginSeries = useMemo(() => history.map((d) => ({ month: d.month, value: d.grossMargin })), [history]);
  const ebitdaSeries = useMemo(() => history.map((d) => ({ month: d.month, value: d.ebitdaPct })), [history]);

  // Helpers for dependent KPI recompute
  const updateKpiField = (key, val) => {
    const v = Number(val);
    const next = { ...kpi, [key]: isNaN(v) ? null : v };
    if (key === "revenue" || key === "headcount") {
      const rev = key === "revenue" ? v : kpi.revenue;
      const hc = key === "headcount" ? v : kpi.headcount;
      next.revenuePerEmployee = rev && hc ? rev / hc : next.revenuePerEmployee;
    }
    if (key === "salesMktgSpend" || key === "newCustomers") {
      const spend = key === "salesMktgSpend" ? v : kpi.salesMktgSpend;
      const newc = key === "newCustomers" ? v : kpi.newCustomers;
      next.cac = spend && newc ? spend / newc : next.cac;
    }
    if (key === "currentAssets" || key === "currentLiabilities") {
      const ca = key === "currentAssets" ? v : kpi.currentAssets;
      const cl = key === "currentLiabilities" ? v : kpi.currentLiabilities;
      next.workingCapital = (ca != null && cl != null) ? (ca - cl) : next.workingCapital;
    }
    setKpi(next);
  };

  const applyScenario = (name) => {
    const s = scenarios[name];
    if (s) setKpi(s);
  };

  const pieData = [
    { name: "Training", value: kpi.trainingPct },
    { name: "Poor Quality", value: kpi.poorQualityPct },
    { name: "SG&A", value: kpi.sgaPct },
    { name: "EBITDA", value: kpi.ebitdaPct },
  ];
  const colors = ["#10b981", "#ef4444", "#3b82f6", "#f59e0b"];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white p-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold">Company KPI Dashboard</h1>
          <div className="flex items-center gap-2">
            <select onChange={(e) => applyScenario(e.target.value)} className="rounded-xl border px-2 py-1 text-sm">
              <option>Baseline</option>
              <option>Stretch</option>
              <option>Downside</option>
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
              View-only
            </label>
            <button onClick={saveState} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Save</button>
            <button onClick={loadState} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Load</button>
            <button onClick={resetDefaults} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Reset</button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Import</button>
            <button onClick={exportJson} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Export</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard title="Gross Margin %" value={kpi.grossMargin} target={kpiTargets.grossMargin} formatter={formatPct}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={marginSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide domain={[0, 1]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Area type="monotone" dataKey="value" fill="#10b981" stroke="#059669" />
              </AreaChart>
            </ResponsiveContainer>
          </KpiCard>

          <KpiCard title="EBITDA %" value={kpi.ebitdaPct} target={kpiTargets.ebitdaPct} formatter={formatPct}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={ebitdaSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide domain={[0, 1]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </KpiCard>

          <KpiCard title="Revenue per Employee" value={kpi.revenuePerEmployee} target={kpiTargets.revenuePerEmployee} formatter={formatMoney}>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={revPerEmpSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </KpiCard>
        </section>

        {/* Trends & Breakdown */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Profitability Trend</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 1]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Legend />
                <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke="#10b981" />
                <Line type="monotone" dataKey="ebitdaPct" name="EBITDA %" stroke="#f59e0b" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatPct(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Manual Data Entry (EDITABLE) */}
        <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Manual Data Entry</h3>
            <span className="text-xs text-slate-500">{viewOnly ? "Toggle off View-only to edit" : "Editing enabled"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(kpi).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <label className="text-sm font-medium capitalize text-slate-700">{key}</label>
                <input
                  type="number"
                  value={val ?? ""}
                  disabled={viewOnly}
                  onChange={(e) => updateKpiField(key, e.target.value)}
                  className="w-36 rounded-lg border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Percentages are decimals (e.g., 0.53 = 53%). Money as plain numbers.</p>
        </section>

        {/* Targets & Settings (EDITABLE) */}
        <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Targets & Settings</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(kpiTargets).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <label className="text-sm font-semibold capitalize text-slate-700">{key}</label>
                <input
                  type="number"
                  value={val ?? ""}
                  disabled={viewOnly}
                  onChange={(e) => setKpiTargets((t) => ({ ...t, [key]: Number(e.target.value) }))}
                  className="w-36 rounded-lg border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t py-6 text-center text-xs text-slate-500">
          Built for Joe's Workspace — visuals + editable data, with scenarios & persistence.
        </footer>
      </main>
    </div>
  );
}
