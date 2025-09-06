// src/App.jsx
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

/** =========================================================
 *  Constants & Fallback Sample Data (used if no data.json)
 * =======================================================*/
const STORAGE_KEY = "kpiDashboardState:v1";
const DATA_JSON_URL = "/data.json"; // served from /public/data.json on GitHub Pages

const sampleHistory = [
  { month: "Jan", grossMargin: 0.43, ebitdaPct: 0.11, sgaPct: 0.22, workingCapital: 180000 },
  { month: "Feb", grossMargin: 0.46, ebitdaPct: 0.12, sgaPct: 0.215, workingCapital: 192000 },
  { month: "Mar", grossMargin: 0.47, ebitdaPct: 0.135, sgaPct: 0.21, workingCapital: 205000 },
];

const sampleKpis = {
  revenue: 1000000,
  headcount: 10,
  revenuePerEmployee: 100000,
  newCustomers: null,
  salesMktgSpend: null,
  cac: null,
  currentAssets: 500000,
  currentLiabilities: 300000,
  workingCapital: 200000,
  grossMargin: 0.45,
  sgaPct: 0.22,
  ebitdaPct: 0.14,
  trainingPct: null,
  poorQualityPct: null,
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

/** =========================
 *  Helper functions
 * ========================*/
function formatPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function computeRevenuePerEmployee(revenue, headcount) {
  return revenue && headcount ? revenue / headcount : null;
}
function computeCAC(spend, newCustomers) {
  return spend && newCustomers ? spend / newCustomers : null;
}
function computeWorkingCapital(currentAssets, currentLiabilities) {
  if (currentAssets == null || currentLiabilities == null) return null;
  return currentAssets - currentLiabilities;
}

// Deep-merge: fill any missing fields from repo history into local history, matching by month.
function mergeHistory(localHist = [], repoHist = []) {
  const byMonth = new Map();
  // seed with repo (acts as base truth)
  for (const r of repoHist || []) {
    if (r && r.month) byMonth.set(r.month, { ...r });
  }
  // overlay local (local wins for conflicts; repo fills gaps)
  for (const l of localHist || []) {
    if (!l || !l.month) continue;
    const base = byMonth.get(l.month) || {};
    byMonth.set(l.month, { ...base, ...l });
  }
  // keep repo order, then any extra local months
  const ordered = [];
  const seen = new Set();
  for (const r of repoHist || []) {
    if (r && r.month && !seen.has(r.month)) {
      ordered.push(byMonth.get(r.month));
      seen.add(r.month);
    }
  }
  for (const [m, v] of byMonth.entries()) {
    if (!seen.has(m)) ordered.push(v);
  }
  return ordered;
}

/** =========================
 *  Small UI components
 * ========================*/
function KpiCard({ title, value, target, formatter = (v) => v, children }) {
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

/** =========================
 *  Main Dashboard Component
 * ========================*/
export default function App() {
  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [kpi, setKpi] = useState(sampleKpis);
  const [history, setHistory] = useState(sampleHistory);
  const [viewOnly, setViewOnly] = useState(true);
  const fileInputRef = useRef(null);

  // Load local save first, then merge in repo data.json so new fields appear automatically.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
      }
    } catch {}

    (async () => {
      try {
        const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
        if (!res.ok) return; // no data.json yet
        const base = await res.json();
        if (base.kpi) setKpi((k) => ({ ...base.kpi, ...k }));                 // local wins
        if (base.kpiTargets) setKpiTargets((t) => ({ ...base.kpiTargets, ...t }));
        if (Array.isArray(base.history)) setHistory((h) => mergeHistory(h, base.history));
      } catch {}
    })();
  }, []);

  // Actions
  const saveState = () => {
    const payload = { kpi, kpiTargets, history, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      alert("Saved.");
    } catch {
      alert("Could not save (browser storage blocked).");
    }
  };
  const loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return alert("No saved data.");
    try {
      const parsed = JSON.parse(raw);
      if (parsed.kpi) setKpi(parsed.kpi);
      if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
      if (parsed.history) setHistory(parsed.history);
      alert("Loaded from your browser.");
    } catch {
      alert("Could not load (corrupt save).");
    }
  };
  const resetDefaults = () => {
    if (!confirm("Reset to defaults?")) return;
    setKpi({ ...sampleKpis });
    setKpiTargets({ ...defaultTargets });
    setHistory([...sampleHistory]);
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
  const loadRepoData = async () => {
    try {
      const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
      if (!res.ok) return alert("No data.json found in repo. Add public/data.json and redeploy.");
      const base = await res.json();
      if (base.kpi) setKpi(base.kpi);
      if (base.kpiTargets) setKpiTargets(base.kpiTargets);
      if (base.history) setHistory(base.history);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            kpi: base.kpi,
            kpiTargets: base.kpiTargets,
            history: base.history,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}
      alert("Reloaded from repo data.json");
    } catch {
      alert("Could not fetch data.json");
    }
  };

  // Derived series
  const marginSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: d.grossMargin })),
    [history]
  );
  const ebitdaSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: d.ebitdaPct })),
    [history]
  );
  const revPerEmpSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: kpi.revenuePerEmployee })),
    [history, kpi.revenuePerEmployee]
  );

  // Recompute dependents when manual edits happen
  const updateKpiField = (key, val) => {
    const v = Number(val);
    const next = { ...kpi, [key]: Number.isNaN(v) ? null : v };

    if (key === "revenue" || key === "headcount") {
      const rev = key === "revenue" ? v : kpi.revenue;
      const hc = key === "headcount" ? v : kpi.headcount;
      next.revenuePerEmployee = computeRevenuePerEmployee(rev, hc);
    }
    if (key === "salesMktgSpend" || key === "newCustomers") {
      const spend = key === "salesMktgSpend" ? v : kpi.salesMktgSpend;
      const newc = key === "newCustomers" ? v : kpi.newCustomers;
      next.cac = computeCAC(spend, newc);
    }
    if (key === "currentAssets" || key === "currentLiabilities") {
      const ca = key === "currentAssets" ? v : kpi.currentAssets;
      const cl = key === "currentLiabilities" ? v : kpi.currentLiabilities;
      next.workingCapital = computeWorkingCapital(ca, cl);
    }
    setKpi(next);
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
            <select
              onChange={(e) => setViewOnly(e.target.value === "View")}
              className="rounded-xl border px-2 py-1 text-sm"
              defaultValue="View"
              title="Switch between view-only and edit"
            >
              <option value="View">View-only</option>
              <option value="Edit">Edit</option>
            </select>

            {[
              ["Save", saveState],
              ["Load", loadState],
              ["Reset", resetDefaults],
              ["Import", () => fileInputRef.current?.click()],
              ["Export", exportJson],
              ["Reload Repo Data", loadRepoData],
            ].map(([label, fn]) => (
              <button
                key={label}
                onClick={fn}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              >
                {label}
              </button>
            ))}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={onImportFile}
              className="hidden"
            />
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
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Area type="monotone" dataKey="value" />
              </AreaChart>
            </ResponsiveContainer>
          </KpiCard>

          <KpiCard title="EBITDA %" value={kpi.ebitdaPct} target={kpiTargets.ebitdaPct} formatter={formatPct}>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={ebitdaSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </KpiCard>

          <KpiCard
            title="Revenue per Employee"
            value={kpi.revenuePerEmployee}
            target={kpiTargets.revenuePerEmployee}
            formatter={formatMoney}
          >
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={revPerEmpSeries}>
                <XAxis dataKey="month" hide />
                <YAxis hide />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </KpiCard>
        </section>

        {/* Trends & Breakdown */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Profitability Trend</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                {/* auto domain handles negatives and >100% cases */}
                <YAxis domain={["auto", "auto"]} />
                <Tooltip formatter={(v) => formatPct(v)} />
                <Legend />
                <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ebitdaPct"   name="EBITDA %"      stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sgaPct"      name="SG&A %"        stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Cost Breakdown</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={[
                    { name: "Training", value: kpi.trainingPct },
                    { name: "Poor Quality", value: kpi.poorQualityPct },
                    { name: "SG&A", value: kpi.sgaPct },
                    { name: "EBITDA", value: kpi.ebitdaPct },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                >
                  {[0,1,2,3].map((i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatPct(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Working Capital Trend */}
        <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Working Capital Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => formatMoney(v)} />
              <Area type="monotone" dataKey="workingCapital" name="Working Capital" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        {/* Manual Data Entry */}
        <section className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Manual Data Entry</h3>
            <span className="text-xs text-slate-500">{viewOnly ? "Toggle Edit to enable changes" : "Editing enabled"}</span>
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
                  className="w-40 rounded-lg border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Percentages are decimals (e.g., 0.53 = 53%). Money as plain numbers.</p>
        </section>

        {/* Targets & Settings */}
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
                  className="w-40 rounded-lg border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-10 border-t py-6 text-center text-xs text-slate-500">
        Built for Joe's Workspace — on-page storage + repo data.json. Refresh-safe.
      </footer>
    </div>
  );
}
