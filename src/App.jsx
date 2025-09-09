import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

/* ===== Brand ===== */
const BRAND = {
  primary: "#21253F",
  secondary: "#B6BE82",
  accent: "#B6BE82",
  neutral: "#111827",
  surface: "#FFFFFF",
  bg: "#F6F8FB",
};
const LOGO_URL = "/site-logo.svg"; // optional

/* ===== Safe defaults (used as fallbacks) ===== */
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

const STORAGE_KEY = "kpiDashboardState:v1";
const DATA_JSON_URL = "/data.json";

/* ===== Helpers (safe) ===== */
const formatPct = (n) => (typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—");
const formatMoney = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

function computeRevenuePerEmployee(revenue, headcount) {
  return typeof revenue === "number" && typeof headcount === "number" && headcount !== 0
    ? revenue / headcount
    : null;
}
function computeCAC(spend, newCustomers) {
  return typeof spend === "number" && typeof newCustomers === "number" && newCustomers !== 0
    ? spend / newCustomers
    : null;
}
function computeWorkingCapital(currentAssets, currentLiabilities) {
  if (typeof currentAssets !== "number" || typeof currentLiabilities !== "number") return null;
  return currentAssets - currentLiabilities;
}
function mergeHistory(localHist = [], repoHist = []) {
  const l = Array.isArray(localHist) ? localHist : [];
  const r = Array.isArray(repoHist) ? repoHist : [];
  const byMonth = new Map();
  for (const row of r) if (row && row.month) byMonth.set(row.month, { ...row });
  for (const row of l) if (row && row.month) byMonth.set(row.month, { ...(byMonth.get(row.month) || {}), ...row });
  const ordered = [];
  const seen = new Set();
  for (const row of r) if (row && row.month && !seen.has(row.month)) { ordered.push(byMonth.get(row.month)); seen.add(row.month); }
  for (const [m, v] of byMonth) if (!seen.has(m)) ordered.push(v);
  return ordered;
}

/* ===== Minimal styles for the new shell ===== */
const styles = `
  .app-shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh;background:${BRAND.bg}}
  .sidebar{background:${BRAND.primary};color:#fff;display:flex;flex-direction:column}
  .brand{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.15)}
  .nav a{display:flex;align-items:center;gap:10px;padding:10px 16px;color:#dbeafe;text-decoration:none;border-left:4px solid transparent}
  .nav a.active{background:rgba(255,255,255,.08);border-left-color:${BRAND.secondary};color:#fff}
  .topbar{background:#fff;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:10px 16px}
  .page{padding:16px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .grid{display:grid;gap:16px}
  .grid-3{grid-template-columns:repeat(3,minmax(0,1fr))}
  .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
  @media (max-width: 1100px){.grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width: 800px){.app-shell{grid-template-columns:1fr}.sidebar{display:none}.grid-3,.grid-2{grid-template-columns:1fr}}
  .btn{border:1px solid #e5e7eb;border-radius:12px;padding:8px 12px;background:#fff;cursor:pointer}
  .btn:active{transform:translateY(1px)}
  .muted{color:#6b7280;font-size:12px}
  .headline{font-weight:600;margin-bottom:8px}
`;

/* ===== Reusable card ===== */
function KpiCard({ title, value, target, formatter = (v) => v, children }) {
  return (
    <div className="card">
      <div className="muted">{title}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{formatter(value)}</div>
      {typeof target === "number" && <div className="muted">Target: {formatter(target)}</div>}
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

/* ===== Pages ===== */
function DashboardPage({ kpi, kpiTargets, history }) {
  const safeHistory = Array.isArray(history) ? history : [];

  const revPerEmpSeries = useMemo(
    () => safeHistory.map((d) => ({ month: d.month, value: kpi?.revenuePerEmployee ?? null })),
    [safeHistory, kpi?.revenuePerEmployee]
  );
  const marginSeries = useMemo(
    () => safeHistory.map((d) => ({ month: d.month, value: d?.grossMargin ?? null })),
    [safeHistory]
  );
  const ebitdaSeries = useMemo(
    () => safeHistory.map((d) => ({ month: d.month, value: d?.ebitdaPct ?? null })),
    [safeHistory]
  );
  const pieData = [
    { name: "Training", value: kpi?.trainingPct ?? 0 },
    { name: "Poor Quality", value: kpi?.poorQualityPct ?? 0 },
    { name: "SG&A", value: kpi?.sgaPct ?? 0 },
    { name: "EBITDA", value: kpi?.ebitdaPct ?? 0 },
  ];
  const colors = [BRAND.secondary, "#ef4444", BRAND.primary, BRAND.accent];

  return (
    <div className="page">
      <div className="grid grid-3">
        <KpiCard title="Gross Margin %" value={kpi?.grossMargin} target={kpiTargets?.grossMargin} formatter={formatPct}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={marginSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={formatPct} />
              <Area type="monotone" dataKey="value" stroke={BRAND.primary} fill={BRAND.secondary} fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="EBITDA %" value={kpi?.ebitdaPct} target={kpiTargets?.ebitdaPct} formatter={formatPct}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={ebitdaSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={formatPct} />
              <Line type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="Revenue per Employee" value={kpi?.revenuePerEmployee} target={kpiTargets?.revenuePerEmployee} formatter={formatMoney}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={revPerEmpSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide />
              <Tooltip formatter={formatMoney} />
              <Bar dataKey="value" fill={BRAND.secondary} />
            </BarChart>
          </ResponsiveContainer>
        </KpiCard>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="headline">Profitability Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={safeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip formatter={formatPct} />
              <Legend />
              <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke={BRAND.primary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ebitdaPct" name="EBITDA %" stroke={BRAND.secondary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="sgaPct" name="SG&A %" stroke="#9CA3AF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="headline">Cost Breakdown</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
                {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip formatter={formatPct} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="headline">Working Capital Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={safeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={formatMoney} />
              <Legend />
              <Line type="monotone" dataKey="workingCapital" name="Working Capital" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="muted" style={{ marginTop: 8 }}>
            Latest WC comes from your Balance Sheet import. Months without values will show a gap until provided.
          </div>
        </div>
      </div>
    </div>
  );
}

function BudgetPage() {
  return (
    <div className="page">
      <div className="card">
        <div className="headline">Budget Planner</div>
        <div className="muted">Budget planning module coming soon. (We’ll add uploads, categories, and variance tracking here.)</div>
      </div>
    </div>
  );
}

function OpsKpisPage() {
  return (
    <div className="page">
      <div className="grid grid-2">
        <div className="card">
          <div className="headline">Revenue per Employee vs Cost per Employee</div>
          <div className="muted">Hook up payroll/employee cost data here; we’ll chart Rev/Emp vs Cost/Emp and a margin.</div>
        </div>
        <div className="card">
          <div className="headline">Truck Cost per Delivery / per Stop</div>
          <div className="muted">Wire to Geotab, Suburban, Housecall Pro: cost per mile, per route, per stop.</div>
        </div>
      </div>
    </div>
  );
}

/* ===== Shell + App ===== */
export default function App() {
  const [active, setActive] = useState("dashboard"); // 'dashboard' | 'budget' | 'ops'
  const [kpiTargets, setKpiTargets] = useState({ ...defaultTargets });
  const [kpi, setKpi] = useState({ ...sampleKpis });
  const [history, setHistory] = useState([...sampleHistory]);
  const [viewOnly, setViewOnly] = useState(true);
  const [storageError, setStorageError] = useState(null);
  const fileInputRef = useRef(null);

  // Restore + fetch
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.kpi) setKpi((k) => ({ ...k, ...parsed.kpi }));
        if (parsed?.kpiTargets) setKpiTargets((t) => ({ ...t, ...parsed.kpiTargets }));
        if (Array.isArray(parsed?.history)) setHistory((h) => mergeHistory(h, parsed.history));
      }
    } catch {
      setStorageError("Could not read saved data (localStorage).");
    }
    (async () => {
      try {
        const res = await fetch(DATA_JSON_URL, { cache: "no-store" });
        if (res.ok) {
          const base = await res.json().catch(() => null);
          if (base?.kpi) setKpi((k) => ({ ...base.kpi, ...k }));
          if (base?.kpiTargets) setKpiTargets((t) => ({ ...base.kpiTargets, ...t }));
          if (Array.isArray(base?.history)) setHistory((h) => mergeHistory(h, base.history));
        }
      } catch {}
    })();
  }, []);

  // Auto-save
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          kpi: kpi || {},
          kpiTargets: kpiTargets || {},
          history: Array.isArray(history) ? history : [],
          savedAt: new Date().toISOString(),
        })
      );
    } catch {
      setStorageError("Saving is blocked by your browser (localStorage unavailable).");
    }
  }, [kpi, kpiTargets, history]);

  const exportJson = () => {
    const payload = { kpi: kpi || {}, kpiTargets: kpiTargets || {}, history: Array.isArray(history) ? history : [] };
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
      if (!res.ok) return alert("No data.json found in repo. Add public/data.json and redeploy.");
      const base = await res.json().catch(() => null);
      if (!base) return alert("Invalid data.json");
      if (base.kpi) setKpi(base.kpi);
      if (base.kpiTargets) setKpiTargets(base.kpiTargets);
      if (base.history) setHistory(base.history);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          kpi: base.kpi || {}, kpiTargets: base.kpiTargets || {}, history: base.history || [], savedAt: new Date().toISOString(),
        }));
      } catch {}
      alert("Loaded from repo data.json");
    } catch {
      alert("Could not fetch data.json");
    }
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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            kpi: parsed.kpi ?? kpi,
            kpiTargets: parsed.kpiTargets ?? kpiTargets,
            history: parsed.history ?? history,
            savedAt: new Date().toISOString(),
          }));
        } catch {}
        alert("Imported and saved.");
      } catch {
        alert("Invalid JSON.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(f);
  };

  const content =
    active === "dashboard" ? (
      <DashboardPage kpi={kpi} kpiTargets={kpiTargets} history={history} />
    ) : active === "budget" ? (
      <BudgetPage />
    ) : (
      <OpsKpisPage />
    );

  return (
    <>
      <style>{styles}</style>
      <div className="app-shell">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <img
              src={LOGO_URL}
              alt=""
              width="28"
              height="28"
              onError={(e) => (e.currentTarget.style.display = "none")}
              style={{ borderRadius: 6 }}
            />
            <div style={{ fontWeight: 600 }}>Gibson Oil & Gas</div>
          </div>
          <nav className="nav">
            <a className={active === "dashboard" ? "active" : ""} href="#" onClick={(e) => { e.preventDefault(); setActive("dashboard"); }}>
              Dashboard
            </a>
            <a className={active === "budget" ? "active" : ""} href="#" onClick={(e) => { e.preventDefault(); setActive("budget"); }}>
              Budget
            </a>
            <a className={active === "ops" ? "active" : ""} href="#" onClick={(e) => { e.preventDefault(); setActive("ops"); }}>
              Operational KPIs
            </a>
          </nav>
          <div style={{ marginTop: "auto", padding: 12, fontSize: 12, color: "#cbd5e1" }}>
            © {new Date().getFullYear()}
          </div>
        </aside>

        {/* Main column */}
        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: "100vh" }}>
          {/* Top bar */}
          <div className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>
                {active === "dashboard" ? "KPI Dashboard" : active === "budget" ? "Budget Planner" : "Operational KPIs"}
              </div>
              <div className="muted">— View-only:&nbsp;</div>
              <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={viewOnly} onChange={(e) => setViewOnly(e.target.checked)} /> {viewOnly ? "on" : "off"}
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="btn" onClick={() => fileInputRef.current?.click()}>Import</button>
              <button className="btn" onClick={exportJson}>Export</button>
              <button className="btn" onClick={loadRepoData}>Reload Repo Data</button>
              <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} style={{ display: "none" }} />
            </div>
          </div>

          {/* Page content */}
          {storageError && (
            <div className="page">
              <div className="card" style={{ background: "#FEF3C7", borderColor: "#FCD34D" }}>
                <div style={{ color: "#92400E", fontSize: 14 }}>{storageError}</div>
              </div>
            </div>
          )}
          {content}
        </div>
      </div>
    </>
  );
}
