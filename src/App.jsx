import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

/* ---------- Brand ---------- */
const BRAND = {
  primary: "#21253F",
  secondary: "#B6BE82",
  accent: "#B6BE82",
  neutral: "#111827",
  surface: "#FFFFFF",
};
const LOGO_URL = "/site-logo.svg";

/* ---------- Sample KPI data (you can overwrite via the form) ---------- */
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

const STORAGE_KEY = "kpiDashboardState:v2";

/* ---------- Helpers ---------- */
const fmtPct = (n) => (n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`);
const fmtMoney = (n) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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

/* ---------- Small UI bits ---------- */
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

function StepItem({ step, toggle, updateNote, addFile, removeFile }) {
  const inputRef = useRef(null);
  return (
    <div className="rounded-xl border p-3 mb-3 bg-white">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={!!step.done} onChange={() => toggle(step.id)} className="mt-1 h-4 w-4" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-800">{step.title}</h4>
            {step.link && (
              <a className="text-xs underline text-slate-600" href={step.link} target="_blank" rel="noreferrer">
                open
              </a>
            )}
          </div>
          {step.subtitle && <p className="text-xs text-slate-500 mt-1">{step.subtitle}</p>}
          <textarea
            placeholder="Notes (optional)"
            value={step.note || ""}
            onChange={(e) => updateNote(step.id, e.target.value)}
            className="mt-2 w-full rounded-lg border px-2 py-1 text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="border px-2 py-1 rounded-lg text-xs hover:bg-slate-50"
            >
              Attach file…
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => addFile(step.id, { name: f.name, data: reader.result });
                reader.readAsDataURL(f);
                e.target.value = "";
              }}
            />
            {Array.isArray(step.files) &&
              step.files.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                  {f.name}
                  <button className="text-slate-400" onClick={() => removeFile(step.id, i)}>✕</button>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Delivery Tickets (Suburban) steps ---------- */
/* Summarized flow:
   1) Print Sales & Receipts Report (Daily menu)
   2) Transaction Transfer → Transfer transactions to the posting file
   3) PPS Truck Interface → export customers & routes to trucks
   4) Edit Listing → review totals / variances before posting
   (These are the labeled actions shown in your screenshots.) */
const deliveryTicketStepsTemplate = [
  {
    id: "s1",
    title: "Print Sales & Receipts Report",
    subtitle: "Daily → Print Sales & Receipts Report (confirm printer, page codes as needed).",
  },
  {
    id: "s2",
    title: "Transaction Transfer",
    subtitle: "Transfer transactions to the posting file (include LIMBO if instructed).",
  },
  {
    id: "s3",
    title: "PPS Truck Interface",
    subtitle: "Export customers and routes to trucks after transfer.",
  },
  {
    id: "s4",
    title: "Edit Listing – Review Totals",
    subtitle: "Check control vs. trans qty and highlighted totals before posting.",
  },
];

/* ---------- Main App ---------- */
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | finops | delivery
  const [viewOnly, setViewOnly] = useState(true);

  const [kpi, setKpi] = useState(sampleKpis);
  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [history, setHistory] = useState(sampleHistory);

  const [deliverySteps, setDeliverySteps] = useState(deliveryTicketStepsTemplate);

  // Restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
        if (parsed.deliverySteps) setDeliverySteps(parsed.deliverySteps);
      }
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ kpi, kpiTargets, history, deliverySteps, savedAt: new Date().toISOString() })
      );
    } catch {}
  }, [kpi, kpiTargets, history, deliverySteps]);

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

  // KPI updates keep dependents in sync
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

  // Delivery steps helpers
  const toggleStep = (id) =>
    setDeliverySteps((arr) => arr.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  const updateNote = (id, note) =>
    setDeliverySteps((arr) => arr.map((s) => (s.id === id ? { ...s, note } : s)));
  const addFile = (id, file) =>
    setDeliverySteps((arr) => arr.map((s) => (s.id === id ? { ...s, files: [...(s.files || []), file] } : s)));
  const removeFile = (id, idx) =>
    setDeliverySteps((arr) => arr.map((s) => (s.id === id ? { ...s, files: (s.files || []).filter((_, i) => i !== idx) } : s)));
  const resetChecklist = () => setDeliverySteps(deliveryTicketStepsTemplate);

  // Pie data
  const pieData = [
    { name: "Training", value: kpi.trainingPct },
    { name: "Poor Quality", value: kpi.poorQualityPct },
    { name: "SG&A", value: kpi.sgaPct },
    { name: "EBITDA", value: kpi.ebitdaPct },
  ];
  const colors = [BRAND.secondary, "#ef4444", BRAND.primary, BRAND.accent];

  const NavItem = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
        activeTab === id ? "bg-white shadow font-semibold" : "hover:bg-white/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b p-3" style={{ backgroundColor: BRAND.primary, color: "white", borderColor: BRAND.primary }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Company Logo" className="h-8 w-8 rounded" onError={(e)=>{e.currentTarget.style.display='none';}} />
            <h1 className="text-lg font-semibold">Gibson Oil & Gas — KPI Dashboard</h1>
          </div>
          <label className="inline-flex items-center gap-2 text-xs" style={{ color: "#E5E7EB" }}>
            <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
            View-only
          </label>
        </div>
      </header>

      {/* Body with left nav */}
      <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-6">
        <aside className="col-span-12 sm:col-span-3 lg:col-span-2">
          <div className="sticky top-4 space-y-2">
            <NavItem id="dashboard" label="Dashboard" />
            <NavItem id="finops" label="Financial Ops" />
            <NavItem id="delivery" label="Delivery Tickets" />
          </div>
        </aside>

        <main className="col-span-12 sm:col-span-9 lg:col-span-10">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <KpiCard title="Gross Margin %" value={kpi.grossMargin} target={kpiTargets.grossMargin} formatter={fmtPct}>
                  <ResponsiveContainer width="100%" height={120}>
                    <AreaChart data={marginSeries}>
                      <XAxis dataKey="month" hide />
                      <YAxis hide domain={[0, 1]} />
                      <Tooltip formatter={(v) => fmtPct(v)} />
                      <Area type="monotone" dataKey="value" stroke={BRAND.primary} fill={BRAND.secondary} fillOpacity={0.35} />
                    </AreaChart>
                  </ResponsiveContainer>
                </KpiCard>

                <KpiCard title="EBITDA %" value={kpi.ebitdaPct} target={kpiTargets.ebitdaPct} formatter={fmtPct}>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={ebitdaSeries}>
                      <XAxis dataKey="month" hide />
                      <YAxis hide domain={[0, 1]} />
                      <Tooltip formatter={(v) => fmtPct(v)} />
                      <Line type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </KpiCard>

                <KpiCard title="Revenue per Employee" value={kpi.revenuePerEmployee} target={kpiTargets.revenuePerEmployee} formatter={fmtMoney}>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={revPerEmpSeries}>
                      <XAxis dataKey="month" hide />
                      <YAxis hide />
                      <Tooltip formatter={(v) => fmtMoney(v)} />
                      <Bar dataKey="value" fill={BRAND.secondary} />
                    </BarChart>
                  </ResponsiveContainer>
                </KpiCard>
              </section>

              <section className="mt-8 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: "#E2E8F0" }}>
                  <h3 className="text-sm font-semibold">Profitability Trend</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis domain={["auto", "auto"]} />
                      <Tooltip formatter={(v) => fmtPct(v)} />
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
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmtPct(v)} />
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
                      <Tooltip formatter={(v) => fmtMoney(v)} />
                      <Legend />
                      <Line type="monotone" dataKey="workingCapital" name="Working Capital" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-xs text-slate-500">Latest WC comes from your Balance Sheet import or manual entry.</p>
                </div>
              </section>
            </>
          )}

          {/* FINANCIAL OPS (editables) */}
          {activeTab === "finops" && (
            <>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
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
              </div>

              <div className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
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
              </div>
            </>
          )}

          {/* DELIVERY TICKETS (Suburban) */}
          {activeTab === "delivery" && (
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-800">Delivery Tickets — Daily Flow</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Follow the steps below. Your progress, notes, and attachments are saved in your browser.
                  </p>
                </div>
                <button onClick={resetChecklist} className="border px-3 py-2 rounded-lg text-xs hover:bg-slate-50">
                  Reset checklist
                </button>
              </div>

              <div className="mt-4">
                {deliverySteps.map((s) => (
                  <StepItem
                    key={s.id}
                    step={s}
                    toggle={toggleStep}
                    updateNote={updateNote}
                    addFile={addFile}
                    removeFile={removeFile}
                  />
                ))}
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                Tip: you can attach the printed Sales & Receipts PDF, export receipts, or an Edit Listing screenshot to the step.
              </div>
            </div>
          )}
        </main>
      </div>

      <footer className="mt-10 border-t py-6 text-center text-xs text-slate-500">
        Built for operational visibility — KPIs, Financial Ops, and Delivery Tickets workflow.
      </footer>
    </div>
  );
}
