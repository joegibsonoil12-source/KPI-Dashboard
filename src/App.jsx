import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

/* ============================
   Brand + assets (logo is optional)
   ============================ */
const BRAND = {
  primary: "#21253F",     // dark navy from your logo
  secondary: "#B6BE82",   // olive/green from your logo
  surface: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
};
const LOGO_URL = "/site-logo.svg"; // put this in /public to avoid 404

/* ============================
   Local storage keys
   ============================ */
const STORAGE = {
  APP: "kpiDashboard:v2",
  DELIVERY: "kpiDashboard:deliveryTickets:v1",
};

/* ============================
   Minimal demo KPI data (keeps the dashboard alive)
   ============================ */
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
  grossMargin: 0.545,
  ebitdaPct: 0.175,
  sgaPct: 0.195,
  revenue: 1650000,
  headcount: 21,
  revenuePerEmployee: 1650000 / 21,
  trainingPct: 0.015,
  poorQualityPct: 0.022,
  currentAssets: 620000,
  currentLiabilities: 380000,
  workingCapital: 620000 - 380000,
};

/* ============================
   Helpers
   ============================ */
const fmtPct = (n) => (n == null || isNaN(n) ? "—" : `${(n * 100).toFixed(1)}%`);
const fmtMoney = (n) =>
  n == null || isNaN(n) ? "—" : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function KpiCard({ title, value, target, formatter = (v) => v, children }) {
  return (
    <div style={{ background: BRAND.surface, border: `1px solid ${BRAND.border}` }} className="rounded-2xl p-4 shadow-sm">
      <h3 style={{ color: "#475569" }} className="text-sm font-semibold">{title}</h3>
      <div style={{ color: BRAND.text }} className="mt-2 text-2xl font-bold">{formatter(value)}</div>
      {target != null && <div className="mt-1 text-xs" style={{ color: "#6B7280" }}>Target: {formatter(target)}</div>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* ============================
   Delivery Tickets – page groups + worksheet (from PDFs)
   ============================ */

/** Page groups that mirror the paper “Sales Page Control Totals Log”
 *  - PP: 1..31
 *  - Stores: 401..431
 *  - Sales & Service: 501..531
 */
function buildRange(start, end) {
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

const DEFAULT_GROUPS = [
  { id: "pp", name: "Portable Propane (PP)", pages: buildRange(1, 31) },
  { id: "stores", name: "Stores", pages: buildRange(401, 431) },
  { id: "svc", name: "Sales & Service", pages: buildRange(501, 531) },
];

const DEFAULT_WORKSHEET = {
  date: "",
  debits: { cash: "", charge: "" },
  credits: {
    driver1: { label: "Driver One (MARTIN Trk 9)", dollars: "", units: "" },
    driver2: { label: "Driver Two (TONY Trk 7)", dollars: "", units: "" },
    driver3: { label: "Driver Three (ROD Trk 6)", dollars: "", units: "" },
    driver4: { label: "Driver Four (Trk 10)", dollars: "", units: "" },
    driver5: { label: "Driver Five", dollars: "", units: "" },
    tankRental: { label: "Tank Rental", dollars: "", units: "" },
    stores: { label: "Other Sales: STORES", dollars: "", units: "" },
    gf1: { label: "GF1", dollars: "", units: "" },
    fo1: { label: "FO1", dollars: "", units: "" },
  },
};

function useDeliveryStore() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.DELIVERY);
      return raw ? JSON.parse(raw) : { groups: DEFAULT_GROUPS, checks: {}, worksheet: DEFAULT_WORKSHEET };
    } catch {
      return { groups: DEFAULT_GROUPS, checks: {}, worksheet: DEFAULT_WORKSHEET };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE.DELIVERY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const setCheck = (page, field, value) =>
    setState((s) => ({
      ...s,
      checks: {
        ...s.checks,
        [page]: { ...(s.checks[page] || {}), [field]: value },
      },
    }));

  const setWorksheet = (path, value) =>
    setState((s) => {
      const next = structuredClone(s);
      const keys = path.split(".");
      let cur = next.worksheet;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
      cur[keys[keys.length - 1]] = value;
      return next;
    });

  const resetAll = () => setState({ groups: DEFAULT_GROUPS, checks: {}, worksheet: DEFAULT_WORKSHEET });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "delivery-tickets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    // Checklist CSV
    const lines = [["Page", "Date", "Ready", "Keyed"]];
    for (const g of state.groups) {
      for (const p of g.pages) {
        const c = state.checks[p] || {};
        lines.push([p, c.date || "", c.ready ? "Yes" : "", c.keyed ? "Yes" : ""]);
      }
    }
    lines.push([]);
    // Worksheet CSV
    lines.push(["Worksheet", ""]);
    lines.push(["Date", state.worksheet.date || ""]);
    lines.push(["Total Cash Sales", state.worksheet.debits.cash || ""]);
    lines.push(["Total Charge Sales", state.worksheet.debits.charge || ""]);
    for (const key of Object.keys(state.worksheet.credits)) {
      const r = state.worksheet.credits[key];
      lines.push([r.label, r.dollars || "", r.units || ""]);
    }
    const csv = lines.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "delivery-tickets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return { state, setCheck, setWorksheet, resetAll, exportJson, exportCsv, setState };
}

function GroupTable({ title, pages, checks, onSet }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
      <h4 className="font-semibold mb-2">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th className="text-left p-2 border" style={{ borderColor: BRAND.border }}>Page #</th>
              <th className="text-left p-2 border" style={{ borderColor: BRAND.border }}>Date</th>
              <th className="text-left p-2 border" style={{ borderColor: BRAND.border }}>Ready</th>
              <th className="text-left p-2 border" style={{ borderColor: BRAND.border }}>Keyed</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const c = checks[p] || {};
              return (
                <tr key={p}>
                  <td className="p-2 border" style={{ borderColor: BRAND.border }}>{p}</td>
                  <td className="p-2 border" style={{ borderColor: BRAND.border }}>
                    <input
                      type="date"
                      value={c.date || ""}
                      onChange={(e) => onSet(p, "date", e.target.value)}
                      className="rounded border px-2 py-1"
                      style={{ borderColor: BRAND.border }}
                    />
                  </td>
                  <td className="p-2 border" style={{ borderColor: BRAND.border }}>
                    <input
                      type="checkbox"
                      checked={!!c.ready}
                      onChange={(e) => onSet(p, "ready", e.target.checked)}
                    />
                  </td>
                  <td className="p-2 border" style={{ borderColor: BRAND.border }}>
                    <input
                      type="checkbox"
                      checked={!!c.keyed}
                      onChange={(e) => onSet(p, "keyed", e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Worksheet({ data, onSet }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: BRAND.border }}>
      <h4 className="font-semibold mb-2">Sales Page Control Totals Worksheet</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border p-3" style={{ borderColor: BRAND.border }}>
          <h5 className="font-semibold mb-2">Debits</h5>
          <label className="block text-sm mb-1">Date</label>
          <input type="date" value={data.date || ""} onChange={(e) => onSet("date", e.target.value)} className="w-full rounded border px-2 py-1 mb-3" style={{ borderColor: BRAND.border }} />
          <label className="block text-sm mb-1">Total Cash Sales</label>
          <input type="number" value={data.debits.cash || ""} onChange={(e) => onSet("debits.cash", e.target.value)} className="w-full rounded border px-2 py-1 mb-3" style={{ borderColor: BRAND.border }} />
          <label className="block text-sm mb-1">Total Charge Sales</label>
          <input type="number" value={data.debits.charge || ""} onChange={(e) => onSet("debits.charge", e.target.value)} className="w-full rounded border px-2 py-1" style={{ borderColor: BRAND.border }} />
        </div>

        <div className="rounded border p-3" style={{ borderColor: BRAND.border }}>
          <h5 className="font-semibold mb-2">Credits</h5>
          {Object.keys(data.credits).map((k) => {
            const row = data.credits[k];
            return (
              <div key={k} className="mb-3">
                <div className="text-xs mb-1">{row.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Dollars"
                    value={row.dollars || ""}
                    onChange={(e) => onSet(`credits.${k}.dollars`, e.target.value)}
                    className="rounded border px-2 py-1"
                    style={{ borderColor: BRAND.border }}
                  />
                  <input
                    type="number"
                    placeholder="Units"
                    value={row.units || ""}
                    onChange={(e) => onSet(`credits.${k}.units`, e.target.value)}
                    className="rounded border px-2 py-1"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeliveryTicketsView() {
  const { state, setCheck, setWorksheet, resetAll, exportJson, exportCsv, setState } = useDeliveryStore();
  const fileInput = useRef(null);

  const progress = useMemo(() => {
    let total = 0, done = 0;
    for (const g of state.groups) {
      for (const p of g.pages) {
        total++;
        const c = state.checks[p] || {};
        if (c.ready && c.keyed) done++;
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [state]);

  const doImport = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { setState(JSON.parse(r.result)); } catch { alert("Invalid JSON"); }
    };
    r.readAsText(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Delivery Tickets</h2>
          <span className="text-xs rounded-full px-2 py-1" style={{ background: "#EEF2FF", color: BRAND.primary }}>
            Progress: {progress.done}/{progress.total} ({progress.pct}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="rounded border px-3 py-1 text-sm" style={{ borderColor: BRAND.border }}>Export CSV</button>
          <button onClick={exportJson} className="rounded border px-3 py-1 text-sm" style={{ borderColor: BRAND.border }}>Export JSON</button>
          <button onClick={() => fileInput.current?.click()} className="rounded border px-3 py-1 text-sm" style={{ borderColor: BRAND.border }}>Import JSON</button>
          <input ref={fileInput} type="file" accept="application/json" className="hidden" onChange={doImport} />
          <button onClick={() => { if (confirm("Clear all Delivery Tickets data?")) resetAll(); }} className="rounded border px-3 py-1 text-sm" style={{ borderColor: BRAND.border }}>
            Reset
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="grid gap-4 lg:grid-cols-2">
        {state.groups.map((g) => (
          <GroupTable key={g.id} title={g.name} pages={g.pages} checks={state.checks} onSet={setCheck} />
        ))}
      </div>

      {/* Worksheet */}
      <Worksheet data={state.worksheet} onSet={setWorksheet} />
    </div>
  );
}

/* ============================
   Store Invoicing (placeholder)
   ============================ */
function StoreInvoicingView() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Store Invoicing</h2>
      <p className="text-sm text-slate-600">
        We’ll connect this to your weekly store totals next. For now, you can continue using the Delivery Tickets → CSV export
        and paste numbers into Suburban until we add a small upload parser here.
      </p>
    </div>
  );
}

/* ============================
   Financial Ops (placeholder controls)
   ============================ */
function FinancialOpsView() {
  const [rev, setRev] = useState(1650000);
  const [headcount, setHeadcount] = useState(21);
  const rpe = useMemo(() => (headcount ? rev / headcount : 0), [rev, headcount]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Financial Ops</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border p-3" style={{ borderColor: BRAND.border }}>
          <label className="block text-sm">Revenue</label>
          <input type="number" value={rev} onChange={(e) => setRev(Number(e.target.value))} className="w-full rounded border px-2 py-1" style={{ borderColor: BRAND.border }} />
        </div>
        <div className="rounded border p-3" style={{ borderColor: BRAND.border }}>
          <label className="block text-sm">Headcount</label>
          <input type="number" value={headcount} onChange={(e) => setHeadcount(Number(e.target.value))} className="w-full rounded border px-2 py-1" style={{ borderColor: BRAND.border }} />
        </div>
        <div className="rounded border p-3" style={{ borderColor: BRAND.border }}>
          <div className="text-sm font-semibold mb-1">Revenue per Employee</div>
          <div className="text-xl">{fmtMoney(rpe)}</div>
        </div>
      </div>
      <p className="text-xs text-slate-500">We’ll extend this with cost per employee / per truck once you drop those inputs.</p>
    </div>
  );
}

/* ============================
   Operational KPIs (placeholder)
   ============================ */
function OperationalKPIsView() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Operational KPIs</h2>
      <p className="text-sm text-slate-600">Bring me your export from Housecall Pro / Geotab and we’ll add per-stop fuel cost & route metrics here.</p>
    </div>
  );
}

/* ============================
   Budget (placeholder)
   ============================ */
function BudgetView() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Budget Planner</h2>
      <p className="text-sm text-slate-600">We’ll bolt the budget grid in after the ticketing flow is settled.</p>
    </div>
  );
}

/* ============================
   Dashboard – keeps the original KPI visuals
   ============================ */
function DashboardView() {
  const [kpi] = useState(sampleKpis);
  const marginSeries = useMemo(() => sampleHistory.map((d) => ({ month: d.month, value: d.grossMargin })), []);
  const ebitdaSeries = useMemo(() => sampleHistory.map((d) => ({ month: d.month, value: d.ebitdaPct })), []);
  const revPerEmpSeries = useMemo(() => sampleHistory.map((d) => ({ month: d.month, value: kpi.revenuePerEmployee })), [kpi.revenuePerEmployee]);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Gross Margin %" value={kpi.grossMargin} formatter={fmtPct}>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={marginSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={(v) => fmtPct(v)} />
              <Area type="monotone" dataKey="value" stroke={BRAND.primary} fill={BRAND.secondary} fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="EBITDA %" value={kpi.ebitdaPct} formatter={fmtPct}>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={ebitdaSeries}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={[0, 1]} />
              <Tooltip formatter={(v) => fmtPct(v)} />
              <Line type="monotone" dataKey="value" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </KpiCard>

        <KpiCard title="Revenue per Employee" value={kpi.revenuePerEmployee} formatter={fmtMoney}>
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
        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <h3 className="text-sm font-semibold">Profitability Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sampleHistory}>
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

        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <h3 className="text-sm font-semibold">Cost Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: "Training", value: sampleKpis.trainingPct },
                  { name: "Poor Quality", value: sampleKpis.poorQualityPct },
                  { name: "SG&A", value: sampleKpis.sgaPct },
                  { name: "EBITDA", value: sampleKpis.ebitdaPct },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
              >
                <Cell fill={BRAND.secondary} />
                <Cell fill="#ef4444" />
                <Cell fill={BRAND.primary} />
                <Cell fill="#A3B18A" />
              </Pie>
              <Tooltip formatter={(v) => fmtPct(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border p-4 shadow-sm" style={{ background: BRAND.surface, borderColor: BRAND.border }}>
          <h3 className="text-sm font-semibold">Working Capital Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sampleHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => fmtMoney(v)} />
              <Legend />
              <Line type="monotone" dataKey="workingCapital" name="Working Capital" stroke={BRAND.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs" style={{ color: "#6B7280" }}>
            Baseline only. We’ll drive this from your imports next.
          </p>
        </div>
      </section>
    </>
  );
}

/* ============================
   App shell
   ============================ */
const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "finops", label: "Financial Ops" },
  { id: "tickets", label: "Delivery Tickets" },
  { id: "store", label: "Store Invoicing" },
  { id: "ops", label: "Operational KPIs" },
  { id: "budget", label: "Budget" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    // Guard against 404 logo blowing up
    const img = new Image();
    img.onerror = () => {}; // ignore
    img.src = LOGO_URL;
  }, []);

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>
      <header className="border-b" style={{ background: BRAND.primary, borderColor: BRAND.primary, color: "white" }}>
        <div className="mx-auto max-w-7xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_URL}
              alt="Logo"
              className="h-8 w-8 rounded"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
            <h1 className="text-lg font-semibold">Gibson Oil & Gas — KPI Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl grid gap-4 p-4 lg:grid-cols-[220px_1fr]">
        {/* Left nav */}
        <nav className="rounded-xl border p-3 h-fit" style={{ borderColor: BRAND.border, background: BRAND.surface }}>
          <ul className="space-y-1">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setTab(t.id)}
                  className="w-full text-left rounded px-3 py-2 text-sm"
                  style={{
                    background: tab === t.id ? "#EEF2FF" : "transparent",
                    color: tab === t.id ? BRAND.primary : BRAND.text,
                    border: "1px solid transparent",
                    width: "100%",
                  }}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content */}
        <main className="space-y-6">
          {tab === "dashboard" && <DashboardView />}
          {tab === "finops" && <FinancialOpsView />}
          {tab === "tickets" && <DeliveryTicketsView />}
          {tab === "store" && <StoreInvoicingView />}
          {tab === "ops" && <OperationalKPIsView />}
          {tab === "budget" && <BudgetView />}
        </main>
      </div>

      <footer className="mt-10 border-t py-6 text-center text-xs" style={{ color: "#6B7280", borderColor: BRAND.border }}>
        Persistent storage: local only. Use Export/Import to share. Need Suburban/Housecall Pro automation? We’ll script CSV adapters.
      </footer>
    </div>
  );
}
