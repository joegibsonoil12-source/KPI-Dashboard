// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import OperationalKPIs from "./components/OperationalKPIs.jsx";
import BudgetPlanner from "./components/BudgetPlanner.jsx";

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

// ===== Brand / Theme (matches current site) =====
const BRAND = {
  primary: "#21253F",   // navy
  secondary: "#B6BE82", // green
  accent: "#B6BE82",
  neutral: "#111827",
  surface: "#FFFFFF",
};
const LOGO_URL = "/site-logo.svg"; // drop a small SVG into /public

// ===== Demo / initial data (same shape you had) =====
const sampleHistory = [
  { month: "Jan", grossMargin: 0.43, ebitdaPct: 0.11, sgaPct: 0.22, workingCapital: 180000 },
  { month: "Feb", grossMargin: 0.46, ebitdaPct: 0.12, sgaPct: 0.215, workingCapital: 192000 },
  { month: "Mar", grossMargin: 0.47, ebitdaPct: 0.135, sgaPct: 0.21, workingCapital: 205000 },
  { month: "Apr", grossMargin: 0.49, ebitdaPct: 0.14, sgaPct: 0.205, workingCapital: 212000 },
  { month: "May", grossMargin: 0.51, ebitdaPct: 0.16, sgaPct: 0.2, workingCapital: 219000 },
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
const DATA_JSON_URL = "/data.json";

// ===== Helpers =====
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

// ===== Reusable card =====
function KpiCard({ title, value, target, formatter = (v) => v, children }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: "#E2E8F0" }}>
      <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
      <div className="mt-2 text-2xl font-bold text-slate-900">{formatter(value)}</div>
      {target != null && <div className="mt-1 text-xs text-slate-500">Target: {formatter(target)}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ===== Small components for new tabs =====
function StoreInvoicing() {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Store Invoicing</h2>
      <p className="mt-2 text-sm text-slate-600">
        A home for end-of-day store totals, invoice generation, and status checks. We can wire this to your
        POS exports later. For now, use the quick checklist below:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>Import daily registers or CSV from the store(s).</li>
        <li>Review exceptions (missing tender, tax mismatch).</li>
        <li>Generate invoice PDFs and mark as sent.</li>
        <li>Post to A/R and lock the day.</li>
      </ul>
    </div>
  );
}

function DeliveryTickets() {
  // Lightweight checklist state
  const [steps, setSteps] = useState([
    {
      key: "print_edit",
      title: "Print/Edit Sales & Receipts (Daily Ops)",
      details:
        "Run the Print/Edit listing for today’s Sales & Receipts. Verify driver, product, gallons, amounts.",
      done: false,
    },
    {
      key: "transfer",
      title: "Transaction Transfer → Posting File",
      details:
        "Transfer transactions to the posting file (include LIMBO if required). This stages tickets for posting.",
      done: false,
    },
    {
      key: "pps_interface",
      title: "PPS Truck Interface",
      details:
        "Export customers & routes back to the trucks for tomorrow’s runs. Confirm device sync completes.",
      done: false,
    },
    {
      key: "verify_edit",
      title: "Verify Edit Listing Totals",
      details:
        "Re-run the Edit Listing to confirm control totals match (gallons, quantities, dollar totals). Resolve any errors.",
      done: false,
    },
  ]);

  const toggle = (k) =>
    setSteps((s) => s.map((x) => (x.key === k ? { ...x, done: !x.done } : x)));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-slate-900/90" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Delivery Tickets — Daily Flow</h2>
            <p className="text-xs text-slate-500">
              Streamlined from your Suburban workflow (Print/Edit, Transaction Transfer, PPS, Edit Listing).
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y rounded-xl border">
          {steps.map((s) => (
            <div key={s.key} className="flex items-start justify-between gap-4 p-3">
              <div>
                <p className="font-medium text-slate-800">{s.title}</p>
                <p className="text-sm text-slate-600">{s.details}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={s.done} onChange={() => toggle(s.key)} />
                <span className="text-sm text-slate-600">{s.done ? "Done" : "Mark done"}</span>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="text-sm font-medium text-slate-800">Notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
              <li>“Include LIMBO” if you used a workstation to stage corrections.</li>
              <li>After PPS export, confirm tablets show new routes.</li>
              <li>If Edit Listing is off, re-run Transfer or fix ticket errors, then re-verify totals.</li>
            </ul>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-sm font-medium text-slate-800">Attachments</p>
            <p className="mt-2 text-xs text-slate-600">
              You can drop screenshots/PDFs here later when we hook up upload storage (e.g., S3/Drive).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Main App =====
export default function KpiDashboardSite() {
  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [kpi, setKpi] = useState(sampleKpis);
  const [history, setHistory] = useState(sampleHistory);
  const [viewOnly, setViewOnly] = useState(true);
  const [storageError, setStorageError] = useState(null);
  const [activeTab, setActiveTab] = useState("Dashboard"); // Dashboard | Financial Ops | Store Invoicing | Delivery Tickets
  const fileInputRef = useRef(null);

  // Load saved state first, then optionally merge /public/data.json
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
      }
    } catch (e) {
      setStorageError("Could not read saved data. Your browser may be blocking storage.");
    }

    (async () => {
      try {
        const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
        if (!res.ok) return;
        const base = await res.json();
        if (base.kpi) setKpi((k) => ({ ...base.kpi, ...k }));
        if (base.kpiTargets) setKpiTargets((t) => ({ ...base.kpiTargets, ...t }));
        if (Array.isArray(base.history)) {
          setHistory((h) => {
            // simple merge-by-month (prefer existing)
            const map = new Map();
            for (const r of base.history) if (r?.month) map.set(r.month, r);
            for (const l of h) if (l?.month) map.set(l.month, { ...map.get(l.month), ...l });
            return Array.from(map.values());
          });
        }
      } catch {}
    })();
  }, []);

  // Auto-save
  useEffect(() => {
    try {
      const payload = { kpi, kpiTargets, history, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      setStorageError("Saving is blocked by your browser (localStorage unavailable).");
    }
  }, [kpi, kpiTargets, history]);

  // Derived series
  const revPerEmpSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: kpi.revenuePerEmployee })),
    [history, kpi.revenuePerEmployee]
  );
  const marginSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: d.grossMargin })),
    [history]
  );
  const ebitdaSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: d.ebitdaPct })),
    [history]
  );

  // Update handler with cascades
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
      const nc = key === "newCustomers" ? v : kpi.newCustomers;
      next.cac = computeCAC(spend, nc);
    }
    if (key === "currentAssets" || key === "currentLiabilities") {
      const ca = key === "currentAssets" ? v : kpi.currentAssets;
      const cl = key === "currentLiabilities" ? v : kpi.currentLiabilities;
      next.workingCapital = computeWorkingCapital(ca, cl);
    }
    setKpi(next);
  };

  // Header actions
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
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
        alert("Imported. Auto-saved.");
      } catch {
        alert("Invalid JSON.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(f);
  };

  // Pie data
  const pieData = [
    { name: "Training", value: kpi.trainingPct },
    { name: "Poor Quality", value: kpi.poorQualityPct },
    { name: "SG&A", value: kpi.sgaPct },
    { name: "EBITDA", value: kpi.ebitdaPct },
  ];
  const colors = [BRAND.secondary, "#ef4444", BRAND.primary, BRAND.accent];

  const headerButtons = [
    { label: "Save", onClick: saveState },
    { label: "Load", onClick: loadState },
    { label: "Reset", onClick: resetDefaults },
    { label: "Import", onClick: () => fileInputRef.current?.click() },
    { label: "Export", onClick: exportJson },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b p-3" style={{ backgroundColor: BRAND.primary, color: "white", borderColor: BRAND.primary }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={LOGO_URL}
                alt="Company Logo"
                className="h-8 w-8 rounded"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <h1 className="text-lg font-semibold">Gibson Oil & Gas — KPI Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <nav className="hidden gap-1 sm:flex">
                {["Dashboard", "Financial Ops", "Store Invoicing", "Delivery Tickets"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      activeTab === tab ? "bg-white/10" : ""
                    }`}
                    style={{ borderColor: "rgba(255,255,255,0.6)", color: "white" }}
                  >
                    {tab}
                  </button>
                ))}
              </nav>

              <label className="ml-2 inline-flex items-center gap-2 text-xs" style={{ color: "#E5E7EB" }}>
                <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
                View-only
              </label>

              {headerButtons.map((b, i) => (
                <button
                  key={i}
                  onClick={b.onClick}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(255,255,255,0.6)", color: "white" }}
                >
                  {b.label}
                </button>
              ))}
              <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} className="hidden" />
            </div>
          </div>

          {/* Small-screen tab selector */}
          <div className="sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full rounded-lg border bg-white/95 px-2 py-2 text-sm text-slate-800"
            >
              <option>Dashboard</option>
              <option>Financial Ops</option>
              <option>Store Invoicing</option>
              <option>Delivery Tickets</option>
            </select>
          </div>

          {storageError && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "#FDE68A", color: "#78350F" }}>
              {storageError}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === "Dashboard" && (
          <>
            {/* KPI Cards */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Gross Margin %" value={kpi.grossMargin} target={kpiTargets.grossMargin} formatter={formatPct}>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={marginSeries}>
                    <XAxis dataKey="month" hide />
                    <YAxis hide domain={[0, 1]} />
                    <Tooltip formatter={(v) => formatPct(v)} />
                    <Area type="monotone" dataKey="value" stroke={BRAND.primary} fill={BRAND.secondary} fillOpacity={0.35} />
                  </AreaChart>
                </ResponsiveContainer>
              </KpiCard>

              <KpiCard title="EBITDA %" value={kpi.ebitdaPct} target={kpiTargets.ebitdaPct} formatter={formatPct}>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={ebitdaSeries}>
                    <XAxis dataKey="month" hide />
                    <YAxis hide domain={[0, 1]} />
                    <Tooltip formatter={(v) => formatPct(v)} />
                    <Line type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </KpiCard>

              <KpiCard title="Revenue per Employee" value={kpi.revenuePerEmployee} target={kpiTargets.revenuePerEmployee} formatter={formatMoney}>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={revPerEmpSeries}>
                    <XAxis dataKey="month" hide />
                    <YAxis hide />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Bar dataKey="value" fill={BRAND.secondary} />
                  </BarChart>
                </ResponsiveContainer>
              </KpiCard>
            </section>

            {/* Trends & Breakdown */}
            <section className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: "#E2E8F0" }}>
                <h3 className="text-sm font-semibold">Profitability Trend</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip formatter={(v) => formatPct(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="ebitdaPct" name="EBITDA %" stroke={BRAND.secondary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sgaPct" name="SG&A %" stroke="#9CA3AF" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: "#E2E8F0" }}>
                <h3 className="text-sm font-semibold">Cost Breakdown</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatPct(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: "#E2E8F0" }}>
                <h3 className="text-sm font-semibold">Working Capital Trend</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="workingCapital" name="Working Capital" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-slate-500">
                  Latest WC comes from your Balance Sheet import. Months without values will show a gap until provided.
                </p>
              </div>
            </section>

            {/* Manual Data Entry */}
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

            {/* Targets */}
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
          </>
        )}

        {activeTab === "Financial Ops" && (
          <div className="space-y-6">
            <OperationalKPIs />
            <BudgetPlanner />
          </div>
        )}

        {activeTab === "Store Invoicing" && <StoreInvoicing />}

        {activeTab === "Delivery Tickets" && <DeliveryTickets />}
      </main>

      <footer className="mt-10 border-t py-6 text-center text-xs text-slate-500">
        Built for Joe — visuals + editable data, with scenarios & workflows.
      </footer>
    </div>
  );
}
