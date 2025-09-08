// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import LayoutShell from "./components/LayoutShell";
import BudgetPlanner from "./components/BudgetPlanner";
import OperationalKPIs from "./components/OperationalKPIs";

const BRAND = { primary: "#21253F", secondary: "#B6BE82", accent: "#B6BE82" };
const STORAGE_KEY = "kpiDashboardState:v1";
const DATA_JSON_URL = "/data.json";
const LOGO_URL = "/site-logo.svg";

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
  revenue: 1650000, headcount: 21, revenuePerEmployee: 1650000 / 21,
  newCustomers: 42, salesMktgSpend: 98000, cac: 98000 / 42,
  currentAssets: 620000, currentLiabilities: 380000, workingCapital: 620000 - 380000,
  grossMargin: 0.545, sgaPct: 0.195, ebitdaPct: 0.175, trainingPct: 0.015, poorQualityPct: 0.022,
};

const defaultTargets = {
  grossMargin: 0.5, ebitdaPct: 0.18, sgaPct: 0.2, revenuePerEmployee: 120000,
  cac: 2500, workingCapital: 200000, trainingPct: 0.02, poorQualityPct: 0.015,
};

function formatPct(n){ return n==null||Number.isNaN(n) ? "—" : `${(n*100).toFixed(1)}%`; }
function formatMoney(n){ return n==null||Number.isNaN(n) ? "—" : n.toLocaleString(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}); }
function computeRevenuePerEmployee(revenue,headcount){ return revenue&&headcount?revenue/headcount:null; }
function computeCAC(spend,newCustomers){ return spend&&newCustomers?spend/newCustomers:null; }
function computeWorkingCapital(ca,cl){ return (ca==null||cl==null)?null:ca-cl; }
function mergeHistory(localHist=[],repoHist=[]){
  const by = new Map();
  for (const r of repoHist) { if (!r?.month) continue; by.set(r.month,{...r}); }
  for (const l of localHist) { if (!l?.month) continue; const base=by.get(l.month)||{}; by.set(l.month,{...base,...l}); }
  const ordered=[], seen=new Set();
  for (const r of repoHist) { if (!r?.month || seen.has(r.month)) continue; ordered.push(by.get(r.month)); seen.add(r.month); }
  for (const [m,v] of by.entries()) if (!seen.has(m)) ordered.push(v);
  return ordered;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");

  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [kpi, setKpi] = useState(sampleKpis);
  const [history, setHistory] = useState(sampleHistory);
  const [viewOnly, setViewOnly] = useState(true);
  const [storageError, setStorageError] = useState(null);

  // Ops data + budgets
  const [employees, setEmployees] = useState([
    { id: "E-001", name: "Driver A", role: "Driver", basePay: 58000, benefits: 12000, hours: 2080, month: "" },
    { id: "E-002", name: "Tech A", role: "Service Tech", basePay: 62000, benefits: 13000, hours: 2080, month: "" },
  ]);
  const [trucks, setTrucks] = useState([
    { id:"TRUCK-1", deliveries:420, stops:560, miles:38000, fuelCost:52000, maintenance:9000, insurance:6500, other:3000, month:"" },
    { id:"TRUCK-2", deliveries:410, stops:540, miles:36000, fuelCost:50500, maintenance:8500, insurance:6500, other:2500, month:"" },
  ]);
  const [truckBudget, setTruckBudget] = useState({
    // TRUCK-1: { perDelivery: 140, perStop: 95, perMile: 1.25 }
  });
  const [opsSettings, setOpsSettings] = useState({});

  const fileInputRef = useRef(null);

  // Restore + repo merge
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        p.kpi && setKpi(p.kpi);
        p.kpiTargets && setKpiTargets(p.kpiTargets);
        p.history && setHistory(p.history);
        p.employees && setEmployees(p.employees);
        p.trucks && setTrucks(p.trucks);
        p.truckBudget && setTruckBudget(p.truckBudget);
        p.opsSettings && setOpsSettings(p.opsSettings);
      }
    } catch { setStorageError("Could not read saved data."); }

    (async () => {
      try {
        const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
        if (!res.ok) return;
        const base = await res.json();
        base.kpi && setKpi((k) => ({ ...base.kpi, ...k }));
        base.kpiTargets && setKpiTargets((t) => ({ ...base.kpiTargets, ...t }));
        Array.isArray(base.history) && setHistory((h) => mergeHistory(h, base.history));
        base.employees && setEmployees((e) => (Array.isArray(e) ? e : base.employees));
        base.trucks && setTrucks((t) => (Array.isArray(t) ? t : base.trucks));
        base.truckBudget && setTruckBudget((b) => ({ ...base.truckBudget, ...b }));
        base.opsSettings && setOpsSettings((o) => ({ ...base.opsSettings, ...o }));
      } catch {}
    })();
  }, []);

  // Auto-save
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kpi, kpiTargets, history,
          employees, trucks, truckBudget, opsSettings,
          savedAt: new Date().toISOString(),
        })
      );
    } catch { setStorageError("Saving is blocked (localStorage)."); }
  }, [kpi, kpiTargets, history, employees, trucks, truckBudget, opsSettings]);

  // Actions
  const saveState = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        kpi, kpiTargets, history,
        employees, trucks, truckBudget, opsSettings,
        savedAt: new Date().toISOString(),
      })
    );
    alert("Saved.");
  };
  const loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return alert("No saved data.");
    try {
      const p = JSON.parse(raw);
      p.kpi && setKpi(p.kpi);
      p.kpiTargets && setKpiTargets(p.kpiTargets);
      p.history && setHistory(p.history);
      p.employees && setEmployees(p.employees);
      p.trucks && setTrucks(p.trucks);
      p.truckBudget && setTruckBudget(p.truckBudget);
      p.opsSettings && setOpsSettings(p.opsSettings);
      alert("Loaded.");
    } catch { alert("Could not load."); }
  };
  const resetDefaults = () => {
    if (!confirm("Reset KPI metrics to defaults?")) return;
    setKpi({ ...sampleKpis });
    setKpiTargets({ ...defaultTargets });
    setHistory([...sampleHistory]);
  };
  const exportJson = () => {
    const payload = {
      kpi, kpiTargets, history,
      employees, trucks, truckBudget, opsSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kpi-dashboard-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const loadRepoData = async () => {
    try {
      const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
      if (!res.ok) return alert("No data.json found.");
      const base = await res.json();
      base.kpi && setKpi(base.kpi);
      base.kpiTargets && setKpiTargets(base.kpiTargets);
      base.history && setHistory(base.history);
      base.employees && setEmployees(base.employees);
      base.trucks && setTrucks(base.trucks);
      base.truckBudget && setTruckBudget(base.truckBudget);
      base.opsSettings && setOpsSettings(base.opsSettings);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kpi: base.kpi,
          kpiTargets: base.kpiTargets,
          history: base.history,
          employees: base.employees,
          trucks: base.trucks,
          truckBudget: base.truckBudget,
          opsSettings: base.opsSettings,
          savedAt: new Date().toISOString(),
        })
      );
      alert("Loaded from repo data.json");
    } catch { alert("Could not fetch data.json"); }
  };
  const onImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result || "{}"));
        p.kpi && setKpi(p.kpi);
        p.kpiTargets && setKpiTargets(p.kpiTargets);
        p.history && setHistory(p.history);
        p.employees && setEmployees(p.employees);
        p.trucks && setTrucks(p.trucks);
        p.truckBudget && setTruckBudget(p.truckBudget);
        p.opsSettings && setOpsSettings(p.opsSettings);
        alert("Imported.");
      } catch { alert("Invalid JSON."); }
      e.target.value = "";
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

  // Update recomputes
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

  const pieData = [
    { name: "Training", value: kpi.trainingPct },
    { name: "Poor Quality", value: kpi.poorQualityPct },
    { name: "SG&A", value: kpi.sgaPct },
    { name: "EBITDA", value: kpi.ebitdaPct },
  ];
  const colors = [BRAND.secondary, "#ef4444", BRAND.primary, BRAND.accent];

  // UI
  const headerButtons = [
    { label: "Save", onClick: saveState },
    { label: "Load", onClick: loadState },
    { label: "Reset", onClick: resetDefaults },
    { label: "Import", onClick: () => fileInputRef.current?.click() },
    { label: "Export", onClick: exportJson },
    { label: "Reload Repo Data", onClick: loadRepoData },
  ];

  function KpiCard({ title, value, target, formatter = (v) => v, children }) {
    return (
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-600">{title}</h3>
        <div className="mt-2 text-2xl font-bold text-slate-900">{formatter(value)}</div>
        {target != null && <div className="mt-1 text-xs text-slate-500">Target: {formatter(target)}</div>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    );
  }

  // ===== Tabs =====
  const DashboardTab = (
    <>
      {/* Top action row inside content area */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-600">
          View-only{" "}
          <input
            type="checkbox"
            className="ml-1 align-middle"
            checked={viewOnly}
            onChange={(e) => setViewOnly(e.target.checked)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {headerButtons.map((b, i) => (
            <button
              key={i}
              onClick={b.onClick}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {b.label}
            </button>
          ))}
          <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} className="hidden" />
        </div>
      </div>
      {storageError && (
        <div className="mb-3 rounded-lg bg-yellow-100 px-3 py-2 text-xs text-yellow-900">{storageError}</div>
      )}

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
              <Bar dataKey="value" fill={BRAND.secondary} />
            </BarChart>
          </ResponsiveContainer>
        </KpiCard>
      </section>

      {/* Trends */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
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

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
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

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
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
        </div>
      </section>
    </>
  );

  const OperationsTab = (
    <OperationalKPIs
      employees={employees}
      setEmployees={setEmployees}
      trucks={trucks}
      setTrucks={setTrucks}
      truckBudget={truckBudget}
      setTruckBudget={setTruckBudget}
      opsSettings={opsSettings}
      setOpsSettings={setOpsSettings}
      revenuePerEmployee={kpi.revenuePerEmployee}
    />
  );

  const BudgetTab = (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <BudgetPlanner budgets={{}} setBudgets={() => {}} actuals={{}} />
      <p className="mt-2 text-xs text-slate-600">
        (When ready, we’ll wire your real budget model and feed Ops actuals in.)
      </p>
    </div>
  );

  const AssetsTab = (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold">Assets</h3>
      <p className="mt-2 text-sm text-slate-600">
        Coming soon: live asset table with odometer, status, and last GPS ping from Geotab export/API.
      </p>
    </div>
  );

  return (
    <LayoutShell currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {currentTab === "dashboard" && DashboardTab}
      {currentTab === "operations" && OperationsTab}
      {currentTab === "budget" && BudgetTab}
      {currentTab === "assets" && AssetsTab}
    </LayoutShell>
  );
}
