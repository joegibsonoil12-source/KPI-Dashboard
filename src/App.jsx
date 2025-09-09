import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

/** ================= Brand ================= */
const BRAND = {
  primary: "#21253F",   // navy from logo
  secondary: "#B6BE82", // green from logo
  neutral: "#111827",
  surface: "#FFFFFF",
  border: "#E5E7EB",
};
const LOGO_URL = "/site-logo.svg"; // keep in /public

/** ================ Data Defaults ================= */
const sampleHistory = [
  { month: "Jan", grossMargin: 0.43, ebitdaPct: 0.11, sgaPct: 0.22, workingCapital: 180000 },
  { month: "Feb", grossMargin: 0.46, ebitdaPct: 0.12, sgaPct: 0.215, workingCapital: 192000 },
  { month: "Mar", grossMargin: 0.47, ebitdaPct: 0.135, sgaPct: 0.21, workingCapital: 205000 },
  { month: "Apr", grossMargin: 0.49, ebitdaPct: 0.14, sgaPct: 0.205, workingCapital: 212000 },
  { month: "May", grossMargin: 0.51, ebitdaPct: 0.16, sgaPct: 0.2, workingCapital: 219000 },
  { month: "Jun", grossMargin: 0.52, ebitdaPct: 0.165, sgaPct: 0.198, workingCapital: 225000 },
  { month: "Jul", grossMargin: 0.5,  ebitdaPct: 0.155, sgaPct: 0.205, workingCapital: 221000 },
  { month: "Aug", grossMargin: 0.53, ebitdaPct: 0.17,  sgaPct: 0.197, workingCapital: 231500 },
  { month: "Sep", grossMargin: 0.545,ebitdaPct: 0.175, sgaPct: 0.195, workingCapital: 238000 },
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

/** NEW: starter rows so the forms aren’t empty on first load */
const sampleStationReports = [
  { id: cryptoId(), date: todayStr(), store: "Corner Pantry #1", unleadedLvl: 38, midLvl: 21, premiumLvl: 19, dieselLvl: 42, uPrice: 3.19, mPrice: 3.49, pPrice: 3.79, dPrice: 3.59, comments: "Normal usage" },
];
const sampleDriverLogs = [
  { id: cryptoId(), date: todayStr(), truck: "LP-7", route: "North", stopName: "123 Farm Rd", product: "Propane", gallons: 450, miles: 62, hours: 3.2, notes: "No issues" },
];
const sampleCustomers = [
  { id: cryptoId(), name: "Acme Farms", type: "Commercial", city: "Laurel Hill", product: "Propane", tankSize: 1000, typicalOrder: 600, active: true },
  { id: cryptoId(), name: "Smith Residence", type: "Residential", city: "Rockingham", product: "Propane", tankSize: 250, typicalOrder: 150, active: true },
];

const STORAGE_KEY = "kpiDashboardState:v2"; // bump to v2 to avoid mixing with very old
const DATA_JSON_URL = "/data.json";

/** ================ Helpers ================= */
function formatPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function cryptoId() {
  // good-enough id for client app
  return (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
}

function mergeHistory(localHist = [], repoHist = []) {
  const byMonth = new Map();
  for (const r of repoHist) if (r?.month) byMonth.set(r.month, { ...r });
  for (const l of localHist) if (l?.month) byMonth.set(l.month, { ...(byMonth.get(l.month) || {}), ...l });
  const order = [];
  const seen = new Set();
  for (const r of repoHist) if (r?.month && !seen.has(r.month)) { order.push(byMonth.get(r.month)); seen.add(r.month); }
  for (const [m, v] of byMonth.entries()) if (!seen.has(m)) order.push(v);
  return order;
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

/** small UI bits */
function KpiCard({ title, value, target, formatter = (v) => v, children }) {
  return (
    <div className="rounded-2xl border p-4 shadow-sm" style={{ backgroundColor: BRAND.surface, borderColor: BRAND.border }}>
      <h3 className="text-sm font-semibold" style={{ color: "#475569" }}>{title}</h3>
      <div className="mt-2 text-2xl font-bold" style={{ color: "#0f172a" }}>{formatter(value)}</div>
      {target != null && <div className="mt-1 text-xs" style={{ color: "#64748b" }}>Target: {formatter(target)}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="rounded-2xl border p-4 shadow-sm" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "#334155" }}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, type="text", disabled=false, placeholder, className }) {
  return (
    <label className={`text-sm ${className || ""}`} style={{ color: "#334155" }}>
      <div className="mb-1">{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e)=>onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-lg border px-2 py-1 text-sm"
        style={{ borderColor: BRAND.border }}
      />
    </label>
  );
}

function NumberInput(props) {
  return <TextInput {...props} type="number" />;
}

/** ================ Main App ================= */
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [kpiTargets, setKpiTargets] = useState(defaultTargets);
  const [kpi, setKpi] = useState(sampleKpis);
  const [history, setHistory] = useState(sampleHistory);
  const [viewOnly, setViewOnly] = useState(true);
  const [storageError, setStorageError] = useState(null);
  const fileInputRef = useRef(null);

  /** NEW: operational state */
  const [stationReports, setStationReports] = useState(sampleStationReports);
  const [driverLogs, setDriverLogs] = useState(sampleDriverLogs);
  const [customers, setCustomers] = useState(sampleCustomers);

  // restore & hydrate from repo data.json
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.kpi) setKpi(parsed.kpi);
        if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
        if (parsed.history) setHistory(parsed.history);
        if (Array.isArray(parsed.stationReports)) setStationReports(parsed.stationReports);
        if (Array.isArray(parsed.driverLogs)) setDriverLogs(parsed.driverLogs);
        if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
      }
    } catch {
      setStorageError("Could not read saved data (localStorage blocked).");
    }
    (async () => {
      try {
        const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
        if (!res.ok) return;
        const base = await res.json();
        if (base.kpi) setKpi((k) => ({ ...base.kpi, ...k }));
        if (base.kpiTargets) setKpiTargets((t) => ({ ...base.kpiTargets, ...t }));
        if (Array.isArray(base.history)) setHistory((h) => mergeHistory(h, base.history));
        // optional: if you later add ops data to data.json, merge here the same way
      } catch {}
    })();
  }, []);

  // persist
  useEffect(() => {
    try {
      const payload = { kpi, kpiTargets, history, stationReports, driverLogs, customers, savedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      setStorageError("Saving blocked (localStorage).");
    }
  }, [kpi, kpiTargets, history, stationReports, driverLogs, customers]);

  // actions
  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ kpi, kpiTargets, history, stationReports, driverLogs, customers, savedAt: new Date().toISOString() }));
      alert("Saved.");
    } catch { alert("Save failed."); }
  };
  const loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return alert("No saved data.");
    try {
      const parsed = JSON.parse(raw);
      if (parsed.kpi) setKpi(parsed.kpi);
      if (parsed.kpiTargets) setKpiTargets(parsed.kpiTargets);
      if (parsed.history) setHistory(parsed.history);
      if (Array.isArray(parsed.stationReports)) setStationReports(parsed.stationReports);
      if (Array.isArray(parsed.driverLogs)) setDriverLogs(parsed.driverLogs);
      if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
      alert("Loaded.");
    } catch { alert("Could not load."); }
  };
  const resetDefaults = () => {
    if (!confirm("Reset to defaults?")) return;
    setKpi({ ...sampleKpis });
    setKpiTargets({ ...defaultTargets });
    setHistory([...sampleHistory]);
    setStationReports([...sampleStationReports]);
    setDriverLogs([...sampleDriverLogs]);
    setCustomers([...sampleCustomers]);
  };
  const exportJson = () => {
    const payload = { kpi, kpiTargets, history, stationReports, driverLogs, customers };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gibson-ops-data.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const loadRepoData = async () => {
    try {
      const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
      if (!res.ok) return alert("No data.json found (add public/data.json).");
      const base = await res.json();
      if (base.kpi) setKpi(base.kpi);
      if (base.kpiTargets) setKpiTargets(base.kpiTargets);
      if (base.history) setHistory(base.history);
      // optionally set ops data when you add it to data.json in the future
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ kpi: base.kpi, kpiTargets: base.kpiTargets, history: base.history, stationReports, driverLogs, customers, savedAt: new Date().toISOString() })); } catch {}
      alert("Loaded from repo data.json");
    } catch { alert("Could not fetch data.json"); }
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
        if (Array.isArray(parsed.stationReports)) setStationReports(parsed.stationReports);
        if (Array.isArray(parsed.driverLogs)) setDriverLogs(parsed.driverLogs);
        if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ kpi: parsed.kpi ?? kpi, kpiTargets: parsed.kpiTargets ?? kpiTargets, history: parsed.history ?? history, stationReports: parsed.stationReports ?? stationReports, driverLogs: parsed.driverLogs ?? driverLogs, customers: parsed.customers ?? customers, savedAt: new Date().toISOString() })); } catch {}
        alert("Imported and saved.");
      } catch { alert("Invalid JSON."); }
      e.target.value = "";
    };
    reader.readAsText(f);
  };

  // derived series
  const revPerEmpSeries = useMemo(
    () => history.map((d) => ({ month: d.month, value: kpi.revenuePerEmployee })),
    [history, kpi.revenuePerEmployee]
  );
  const marginSeries = useMemo(() => history.map((d) => ({ month: d.month, value: d.grossMargin })), [history]);
  const ebitdaSeries = useMemo(() => history.map((d) => ({ month: d.month, value: d.ebitdaPct })), [history]);

  // field updater (recompute dependents)
  const updateKpiField = (key, val) => {
    const v = Number(val);
    const next = { ...kpi, [key]: Number.isNaN(v) ? null : v };
    if (key === "revenue" || key === "headcount") {
      const rev = key === "revenue" ? v : kpi.revenue;
      const hc  = key === "headcount" ? v : kpi.headcount;
      next.revenuePerEmployee = computeRevenuePerEmployee(rev, hc);
    }
    if (key === "salesMktgSpend" || key === "newCustomers") {
      const spend = key === "salesMktgSpend" ? v : kpi.salesMktgSpend;
      const newc  = key === "newCustomers"  ? v : kpi.newCustomers;
      next.cac = computeCAC(spend, newc);
    }
    if (key === "currentAssets" || key === "currentLiabilities") {
      const ca = key === "currentAssets" ? v : kpi.currentAssets;
      const cl = key === "currentLiabilities" ? v : kpi.currentLiabilities;
      next.workingCapital = computeWorkingCapital(ca, cl);
    }
    setKpi(next);
  };

  const scenarios = {
    Baseline: { ...kpi },
    Stretch:  { ...kpi, grossMargin: 0.58, ebitdaPct: 0.20, sgaPct: 0.18 },
    Downside: { ...kpi, grossMargin: 0.45, ebitdaPct: 0.12, sgaPct: 0.25 },
  };

  const pieData = [
    { name: "Training", value: kpi.trainingPct },
    { name: "Poor Quality", value: kpi.poorQualityPct },
    { name: "SG&A", value: kpi.sgaPct },
    { name: "EBITDA", value: kpi.ebitdaPct },
  ];
  const colors = [BRAND.secondary, "#ef4444", BRAND.primary, "#94a3b8"];

  /** =============== Layout ================= */
  const TopBar = (
    <header className="border-b p-3" style={{ backgroundColor: BRAND.primary, color: "white", borderColor: BRAND.primary }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_URL} alt="Company Logo" className="h-8 w-8 rounded" onError={(e)=>{e.currentTarget.style.display='none';}} />
          <h1 className="text-base font-semibold">Gibson Oil & Gas — Operations Portal</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => { const s = scenarios[e.target.value]; if (s) setKpi({ ...s }); }}
            className="rounded-xl border px-2 py-1 text-sm"
            style={{ backgroundColor: BRAND.surface, color: BRAND.neutral, borderColor: BRAND.surface }}
            defaultValue="Baseline"
            title="Scenario"
          >
            <option>Baseline</option>
            <option>Stretch</option>
            <option>Downside</option>
          </select>
          <label className="inline-flex items-center gap-2 text-xs" title="Toggle editing" style={{ color: "#E5E7EB" }}>
            <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} />
            View-only
          </label>

          <button onClick={saveState}  className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Save</button>
          <button onClick={loadState}  className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Load</button>
          <button onClick={resetDefaults} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Reset</button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Import</button>
          <button onClick={exportJson} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Export</button>
          <button onClick={loadRepoData} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.5)" }}>Reload Repo Data</button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} className="hidden" />
        </div>
      </div>
      {storageError && (
        <div className="mx-auto mt-2 max-w-7xl rounded-lg px-3 py-2 text-xs" style={{ background: "#FDE68A", color: "#78350F" }}>
          {storageError}
        </div>
      )}
    </header>
  );

  const Sidebar = (
    <aside className="h-[calc(100vh-60px)] w-64 shrink-0 border-r" style={{ borderColor: BRAND.border, background: "#f8fafc" }}>
      <nav className="p-3">
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "finops", label: "Financial Operations" },
          { id: "fuelops", label: "Fuel Ops" },           // NEW
          { id: "customers", label: "Customers" },        // NEW
          { id: "budget", label: "Budget" },
          { id: "ops", label: "Ops KPIs" },
          { id: "settings", label: "Settings" },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="mb-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium"
            style={{
              background: activeTab === item.id ? BRAND.secondary : "transparent",
              color: activeTab === item.id ? "#0f172a" : "#334155",
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );

  /** ---------- TAB: Dashboard ---------- */
  const ViewDashboard = (
    <div className="mx-auto grid max-w-7xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Revenue" value={kpi.revenue} formatter={formatMoney} />
        <KpiCard title="Headcount" value={kpi.headcount} formatter={(v)=>v?.toLocaleString() ?? "—"} />
        <KpiCard title="Rev / Employee" value={kpi.revenuePerEmployee} formatter={formatMoney} target={kpiTargets.revenuePerEmployee} />
        <KpiCard title="Working Capital" value={kpi.workingCapital} formatter={formatMoney} target={kpiTargets.workingCapital} />
      </div>

      <Section title="At a Glance">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <h4 className="text-sm font-semibold mb-2">Profitability Trend</h4>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip formatter={(v)=>typeof v==="number"?formatPct(v):v} />
                <Legend />
                <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke={BRAND.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ebitdaPct"   name="EBITDA %"       stroke={BRAND.secondary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sgaPct"       name="SG&A %"         stroke="#9CA3AF" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <h4 className="text-sm font-semibold mb-2">Cost Breakdown</h4>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
                  {pieData.map((e,i)=> <Cell key={i} fill={colors[i%colors.length]} />)}
                </Pie>
                <Tooltip formatter={(v)=>typeof v==="number"?formatPct(v):v} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="Shortcuts">
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setActiveTab("fuelops")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Fuel Ops</button>
          <button onClick={()=>setActiveTab("customers")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Customers</button>
          <button onClick={()=>setActiveTab("finops")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Financial Ops</button>
          <button onClick={()=>setActiveTab("budget")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Budget</button>
        </div>
      </Section>
    </div>
  );

  /** ---------- TAB: Financial Operations ---------- */
  const ViewFinOps = (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Gross Margin %" value={kpi.grossMargin} target={kpiTargets.grossMargin} formatter={formatPct}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={marginSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={(v)=>formatPct(v)} />
              <Area type="monotone" dataKey="value" stroke={BRAND.primary} fill={BRAND.secondary} fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="EBITDA %" value={kpi.ebitdaPct} target={kpiTargets.ebitdaPct} formatter={formatPct}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={ebitdaSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={(v)=>formatPct(v)} />
              <Line type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="Revenue per Employee" value={kpi.revenuePerEmployee} target={kpiTargets.revenuePerEmployee} formatter={formatMoney}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={revPerEmpSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip formatter={(v)=>formatMoney(v)} />
              <Bar dataKey="value" fill={BRAND.secondary} />
            </BarChart>
          </ResponsiveContainer>
        </KpiCard>
      </div>

      <Section title="Profitability Trend">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={["auto","auto"]} />
            <Tooltip formatter={(v)=>formatPct(v)} />
            <Legend />
            <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ebitdaPct"   name="EBITDA %"       stroke={BRAND.secondary} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sgaPct"       name="SG&A %"         stroke="#9CA3AF" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Working Capital Trend">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v)=>formatMoney(v)} />
            <Legend />
            <Line type="monotone" dataKey="workingCapital" name="Working Capital" stroke={BRAND.primary} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs" style={{ color: "#64748b" }}>
          Latest WC comes from your Balance Sheet import. Months without values will be empty until provided.
        </p>
      </Section>

      <Section
        title="Manual Data Entry"
        right={<span className="text-xs" style={{ color: "#64748b" }}>{viewOnly ? "Toggle off View-only to edit" : "Editing enabled"}</span>}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(kpi).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
              <label className="text-sm font-medium capitalize" style={{ color: "#334155" }}>{key}</label>
              <input
                type="number"
                value={val ?? ""}
                disabled={viewOnly}
                onChange={(e) => updateKpiField(key, e.target.value)}
                className="w-36 rounded-lg border px-2 py-1 text-sm"
                style={{ borderColor: BRAND.border }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "#64748b" }}>Percentages are decimals (e.g., 0.53 = 53%). Money as plain numbers.</p>
      </Section>

      <Section title="Targets & Settings">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(kpiTargets).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
              <label className="text-sm font-semibold capitalize" style={{ color: "#334155" }}>{key}</label>
              <input
                type="number"
                value={val ?? ""}
                disabled={viewOnly}
                onChange={(e) => setKpiTargets((t) => ({ ...t, [key]: Number(e.target.value) }))}
                className="w-36 rounded-lg border px-2 py-1 text-sm"
                style={{ borderColor: BRAND.border }}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );

  /** ---------- TAB: Fuel Ops (NEW) ---------- */
  const [srDraft, setSrDraft] = useState({ date: todayStr(), store: "", unleadedLvl: "", midLvl: "", premiumLvl: "", dieselLvl: "", uPrice: "", mPrice: "", pPrice: "", dPrice: "", comments: "" });
  const [dlDraft, setDlDraft] = useState({ date: todayStr(), truck: "", route: "", stopName: "", product: "Propane", gallons: "", miles: "", hours: "", notes: "" });

  const addStationReport = () => {
    const rec = { id: cryptoId(), ...srDraft,
      unleadedLvl: numOr(srDraft.unleadedLvl), midLvl: numOr(srDraft.midLvl), premiumLvl: numOr(srDraft.premiumLvl), dieselLvl: numOr(srDraft.dieselLvl),
      uPrice: numOr(srDraft.uPrice), mPrice: numOr(srDraft.mPrice), pPrice: numOr(srDraft.pPrice), dPrice: numOr(srDraft.dPrice)
    };
    if (!rec.store) return alert("Store name required.");
    setStationReports((rows)=>[rec, ...rows]);
    setSrDraft({ date: todayStr(), store: "", unleadedLvl: "", midLvl: "", premiumLvl: "", dieselLvl: "", uPrice: "", mPrice: "", pPrice: "", dPrice: "", comments: "" });
  };
  const removeStationReport = (id) => setStationReports((rows)=>rows.filter(r=>r.id!==id));

  const addDriverLog = () => {
    const rec = { id: cryptoId(), ...dlDraft, gallons: numOr(dlDraft.gallons), miles: numOr(dlDraft.miles), hours: numOr(dlDraft.hours) };
    if (!rec.truck || !rec.stopName) return alert("Truck and Stop are required.");
    setDriverLogs((rows)=>[rec, ...rows]);
    setDlDraft({ date: todayStr(), truck: "", route: "", stopName: "", product: "Propane", gallons: "", miles: "", hours: "", notes: "" });
  };
  const removeDriverLog = (id) => setDriverLogs((rows)=>rows.filter(r=>r.id!==id));

  function numOr(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

  const exportCsv = (rows, columns, filename) => {
    const header = columns.map(c=>c.label).join(",");
    const body = rows.map(r => columns.map(c => csvEscape(r[c.key])).join(",")).join("\n");
    const csv = header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };
  function csvEscape(val) {
    if (val == null) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const stationCols = [
    { key: "date", label: "Date" }, { key: "store", label: "Store" },
    { key: "unleadedLvl", label: "Unleaded %"}, { key: "midLvl", label: "Mid %"}, { key: "premiumLvl", label: "Premium %"}, { key: "dieselLvl", label: "Diesel %"},
    { key: "uPrice", label: "U $/gal"}, { key: "mPrice", label: "M $/gal"}, { key: "pPrice", label: "P $/gal"}, { key: "dPrice", label: "D $/gal"},
    { key: "comments", label: "Comments" },
  ];
  const driverCols = [
    { key: "date", label: "Date" }, { key: "truck", label: "Truck" }, { key: "route", label: "Route" }, { key: "stopName", label: "Stop" },
    { key: "product", label: "Product" }, { key: "gallons", label: "Gallons" }, { key: "miles", label: "Miles" }, { key: "hours", label: "Hours" }, { key: "notes", label: "Notes" },
  ];

  const ViewFuelOps = (
    <div className="mx-auto grid max-w-7xl gap-6">
      <Section
        title="Gas Station Inventory Report"
        right={
          <div className="flex gap-2">
            <button onClick={()=>exportCsv(stationReports, stationCols, "station-inventory.csv")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Export CSV</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Date" value={srDraft.date} onChange={(v)=>setSrDraft(s=>({...s, date:v}))} type="date" />
          <TextInput label="Store" value={srDraft.store} onChange={(v)=>setSrDraft(s=>({...s, store:v}))} placeholder="Corner Pantry #1" />
          <NumberInput label="Unleaded Tank %" value={srDraft.unleadedLvl} onChange={(v)=>setSrDraft(s=>({...s, unleadedLvl:v}))} />
          <NumberInput label="Mid Tank %" value={srDraft.midLvl} onChange={(v)=>setSrDraft(s=>({...s, midLvl:v}))} />
          <NumberInput label="Premium Tank %" value={srDraft.premiumLvl} onChange={(v)=>setSrDraft(s=>({...s, premiumLvl:v}))} />
          <NumberInput label="Diesel Tank %" value={srDraft.dieselLvl} onChange={(v)=>setSrDraft(s=>({...s, dieselLvl:v}))} />
          <NumberInput label="Unleaded Price/gal" value={srDraft.uPrice} onChange={(v)=>setSrDraft(s=>({...s, uPrice:v}))} />
          <NumberInput label="Mid Price/gal" value={srDraft.mPrice} onChange={(v)=>setSrDraft(s=>({...s, mPrice:v}))} />
          <NumberInput label="Premium Price/gal" value={srDraft.pPrice} onChange={(v)=>setSrDraft(s=>({...s, pPrice:v}))} />
          <NumberInput label="Diesel Price/gal" value={srDraft.dPrice} onChange={(v)=>setSrDraft(s=>({...s, dPrice:v}))} />
          <TextInput label="Comments" value={srDraft.comments} onChange={(v)=>setSrDraft(s=>({...s, comments:v}))} placeholder="Notes…" className="sm:col-span-2 lg:col-span-4" />
        </div>
        <div className="mt-3">
          <button disabled={viewOnly} onClick={addStationReport} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border, opacity: viewOnly?0.5:1 }}>
            Add Report
          </button>
          {viewOnly && <span className="ml-2 text-xs" style={{ color:"#64748b" }}>Toggle off View-only to add</span>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color:"#475569" }}>
                {stationCols.map(c=><th key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{c.label}</th>)}
                <th className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stationReports.map(r=>(
                <tr key={r.id} className="align-top">
                  {stationCols.map(c=><td key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{String(r[c.key] ?? "")}</td>)}
                  <td className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>
                    <button disabled={viewOnly} onClick={()=>removeStationReport(r.id)} className="rounded border px-2 py-1" style={{ borderColor:BRAND.border, opacity:viewOnly?0.5:1 }}>Delete</button>
                  </td>
                </tr>
              ))}
              {stationReports.length===0 && (
                <tr><td colSpan={stationCols.length+1} className="px-2 py-3 text-center text-xs" style={{ color:"#64748b" }}>No reports yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Driver Delivery Log"
        right={
          <div className="flex gap-2">
            <button onClick={()=>exportCsv(driverLogs, driverCols, "driver-logs.csv")} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Export CSV</button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Date" value={dlDraft.date} onChange={(v)=>setDlDraft(s=>({...s, date:v}))} type="date" />
          <TextInput label="Truck" value={dlDraft.truck} onChange={(v)=>setDlDraft(s=>({...s, truck:v}))} placeholder="LP-7" />
          <TextInput label="Route" value={dlDraft.route} onChange={(v)=>setDlDraft(s=>({...s, route:v}))} placeholder="North" />
          <TextInput label="Stop" value={dlDraft.stopName} onChange={(v)=>setDlDraft(s=>({...s, stopName:v}))} placeholder="123 Farm Rd" />
          <label className="text-sm" style={{ color:"#334155" }}>
            <div className="mb-1">Product</div>
            <select value={dlDraft.product} onChange={(e)=>setDlDraft(s=>({...s, product:e.target.value}))} className="w-full rounded-lg border px-2 py-1 text-sm" style={{ borderColor:BRAND.border }}>
              <option>Propane</option>
              <option>Unleaded</option>
              <option>Midgrade</option>
              <option>Premium</option>
              <option>Diesel</option>
              <option>Fuel Oil</option>
            </select>
          </label>
          <NumberInput label="Gallons" value={dlDraft.gallons} onChange={(v)=>setDlDraft(s=>({...s, gallons:v}))} />
          <NumberInput label="Miles" value={dlDraft.miles} onChange={(v)=>setDlDraft(s=>({...s, miles:v}))} />
          <NumberInput label="Hours" value={dlDraft.hours} onChange={(v)=>setDlDraft(s=>({...s, hours:v}))} />
          <TextInput label="Notes" value={dlDraft.notes} onChange={(v)=>setDlDraft(s=>({...s, notes:v}))} className="sm:col-span-2 lg:col-span-4" />
        </div>
        <div className="mt-3">
          <button disabled={viewOnly} onClick={addDriverLog} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border, opacity: viewOnly?0.5:1 }}>
            Add Log
          </button>
          {viewOnly && <span className="ml-2 text-xs" style={{ color:"#64748b" }}>Toggle off View-only to add</span>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color:"#475569" }}>
                {driverCols.map(c=><th key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{c.label}</th>)}
                <th className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {driverLogs.map(r=>(
                <tr key={r.id} className="align-top">
                  {driverCols.map(c=><td key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{String(r[c.key] ?? "")}</td>)}
                  <td className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>
                    <button disabled={viewOnly} onClick={()=>removeDriverLog(r.id)} className="rounded border px-2 py-1" style={{ borderColor:BRAND.border, opacity:viewOnly?0.5:1 }}>Delete</button>
                  </td>
                </tr>
              ))}
              {driverLogs.length===0 && (
                <tr><td colSpan={driverCols.length+1} className="px-2 py-3 text-center text-xs" style={{ color:"#64748b" }}>No logs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );

  /** ---------- TAB: Customers (NEW) ---------- */
  const [custDraft, setCustDraft] = useState({ name:"", type:"Residential", city:"", product:"Propane", tankSize:"", typicalOrder:"", active:true });
  const addCustomer = () => {
    if (!custDraft.name) return alert("Customer name required.");
    const rec = { id: cryptoId(), ...custDraft, tankSize: numOr(custDraft.tankSize), typicalOrder: numOr(custDraft.typicalOrder) };
    setCustomers((rows)=>[rec, ...rows]);
    setCustDraft({ name:"", type:"Residential", city:"", product:"Propane", tankSize:"", typicalOrder:"", active:true });
  };
  const removeCustomer = (id) => setCustomers((rows)=>rows.filter(r=>r.id!==id));

  const customerCols = [
    { key:"name", label:"Name" }, { key:"type", label:"Type" }, { key:"city", label:"City" }, { key:"product", label:"Product" }, { key:"tankSize", label:"Tank" }, { key:"typicalOrder", label:"Typical Gal" }, { key:"active", label:"Active" }
  ];

  const ViewCustomers = (
    <div className="mx-auto grid max-w-7xl gap-6">
      <Section title="Customer Master">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Name" value={custDraft.name} onChange={(v)=>setCustDraft(s=>({...s, name:v}))} />
          <label className="text-sm" style={{ color:"#334155" }}>
            <div className="mb-1">Type</div>
            <select value={custDraft.type} onChange={(e)=>setCustDraft(s=>({...s, type:e.target.value}))} className="w-full rounded-lg border px-2 py-1 text-sm" style={{ borderColor:BRAND.border }}>
              <option>Residential</option>
              <option>Commercial</option>
            </select>
          </label>
          <TextInput label="City" value={custDraft.city} onChange={(v)=>setCustDraft(s=>({...s, city:v}))} />
          <label className="text-sm" style={{ color:"#334155" }}>
            <div className="mb-1">Product</div>
            <select value={custDraft.product} onChange={(e)=>setCustDraft(s=>({...s, product:e.target.value}))} className="w-full rounded-lg border px-2 py-1 text-sm" style={{ borderColor:BRAND.border }}>
              <option>Propane</option><option>Unleaded</option><option>Midgrade</option><option>Premium</option><option>Diesel</option><option>Fuel Oil</option>
            </select>
          </label>
          <NumberInput label="Tank Size (gal)" value={custDraft.tankSize} onChange={(v)=>setCustDraft(s=>({...s, tankSize:v}))} />
          <NumberInput label="Typical Order (gal)" value={custDraft.typicalOrder} onChange={(v)=>setCustDraft(s=>({...s, typicalOrder:v}))} />
          <label className="text-sm flex items-center gap-2 mt-6">
            <input type="checkbox" checked={custDraft.active} onChange={(e)=>setCustDraft(s=>({...s, active:e.target.checked}))} />
            Active
          </label>
        </div>
        <div className="mt-3">
          <button disabled={viewOnly} onClick={addCustomer} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border, opacity: viewOnly?0.5:1 }}>
            Add Customer
          </button>
          {viewOnly && <span className="ml-2 text-xs" style={{ color:"#64748b" }}>Toggle off View-only to add</span>}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color:"#475569" }}>
                {customerCols.map(c=><th key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{c.label}</th>)}
                <th className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(r=>(
                <tr key={r.id} className="align-top">
                  {customerCols.map(c=><td key={c.key} className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>{String(r[c.key])}</td>)}
                  <td className="border-b px-2 py-2" style={{ borderColor:BRAND.border }}>
                    <button disabled={viewOnly} onClick={()=>removeCustomer(r.id)} className="rounded border px-2 py-1" style={{ borderColor:BRAND.border, opacity:viewOnly?0.5:1 }}>Delete</button>
                  </td>
                </tr>
              ))}
              {customers.length===0 && (
                <tr><td colSpan={customerCols.length+1} className="px-2 py-3 text-center text-xs" style={{ color:"#64748b" }}>No customers yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );

  /** ---------- TAB: Budget (placeholder) ---------- */
  const ViewBudget = (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Section title="Budget Planner">
        <p className="text-sm" style={{ color: "#475569" }}>
          We’ll attach a CSV/JSON uploader and monthly budget grid here (Revenue, COGS, SG&A, CapEx).
        </p>
      </Section>
    </div>
  );

  /** ---------- TAB: Ops KPIs (placeholder) ---------- */
  const ViewOps = (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Section title="Operational KPIs">
        <ul className="list-disc pl-5 text-sm" style={{ color: "#475569" }}>
          <li>Employee cost vs. Revenue per employee (by role)</li>
          <li>Truck operating cost per delivery/stop (fuel, maintenance, driver)</li>
          <li>Service tech productivity (calls/day, first-time fix rate)</li>
        </ul>
        <p className="mt-2 text-xs" style={{ color: "#64748b" }}>
          Next step: we’ll add uploaders for Housecall Pro/Suburban exports and calculate these KPIs.
        </p>
      </Section>
    </div>
  );

  /** ---------- TAB: Settings ---------- */
  const ViewSettings = (
    <div className="mx-auto grid max-w-7xl gap-4">
      <Section title="Brand & Data">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <h4 className="text-sm font-semibold mb-2">Logo Preview</h4>
            <img src={LOGO_URL} alt="Logo" className="h-12 w-12 rounded border" style={{ borderColor: BRAND.border }}
                 onError={(e)=>{e.currentTarget.style.display='none';}} />
            <p className="mt-2 text-xs" style={{ color: "#64748b" }}>Place file at <code>/public/site-logo.svg</code>.</p>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <h4 className="text-sm font-semibold mb-2">Data Controls</h4>
            <div className="flex flex-wrap gap-2">
              <button onClick={saveState} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Save</button>
              <button onClick={loadState} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Load</button>
              <button onClick={resetDefaults} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Reset</button>
              <button onClick={()=>fileInputRef.current?.click()} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Import</button>
              <button onClick={exportJson} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Export</button>
              <button onClick={loadRepoData} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>Reload Repo Data</button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} className="hidden" />
          </div>
        </div>
      </Section>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#f1f5f9" }}>
      {TopBar}
      <div className="flex">
        {Sidebar}
        <main className="flex-1 p-4">
          {activeTab === "dashboard" && ViewDashboard}
          {activeTab === "finops" && ViewFinOps}
          {activeTab === "fuelops" && ViewFuelOps}
          {activeTab === "customers" && ViewCustomers}
          {activeTab === "budget" && ViewBudget}
          {activeTab === "ops" && ViewOps}
          {activeTab === "settings" && ViewSettings}
          <footer className="mt-8 text-center text-xs" style={{ color: "#94a3b8" }}>
            Built for Joe’s Workspace • Editable data, charts, scenarios & persistence
          </footer>
        </main>
      </div>
    </div>
  );
}
