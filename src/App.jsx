// src/App.jsx
import React, { useEffect, useMemo, useState, useContext, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";

/* ========================= Error Boundary ========================= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error) { return { err: error }; }
  componentDidCatch(error, info) { console.error("Render error:", error, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong.</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.err)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ========================= Role Badge ========================= */
function RoleBadge() {
  const [role, setRole] = useState("user");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (!cancelled) setRole((data?.role || "user").toLowerCase());
      } catch {
        if (!cancelled) setRole("user");
      }
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub?.subscription?.unsubscribe?.(); };
  }, []);
  return (
    <div style={{
      position: "fixed", right: 16, bottom: 16, background: "#111827",
      color: "white", padding: "6px 10px", borderRadius: 8, fontSize: 12,
      zIndex: 9, boxShadow: "0 4px 16px rgba(0,0,0,0.2)"
    }}>
      Role: {role}
    </div>
  );
}

/* ========================= AdminOnly ========================= */
function AdminOnly({ children, fallback = null }) {
  const [isAdmin, setIsAdmin] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) { if (mounted) setIsAdmin(false); return; }
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (!mounted) return;
        if (error) { console.error("AdminOnly profile error:", error); setIsAdmin(false); return; }
        setIsAdmin((data?.role || "").toLowerCase() === "admin");
      } catch {
        if (mounted) setIsAdmin(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  if (isAdmin === null) return null;
  if (!isAdmin) return fallback;
  return <>{children}</>;
}

/* ========================= SignIn (magic link) ========================= */
function SignInCard() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function onSignIn(e) {
    e.preventDefault();
    setError("");
    const redirect = new URL("/KPI-Dashboard/", window.location.href).href;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect },
    });
    if (error) setError(error.message);
    else setSent(true);
  }
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        {!sent ? (
          <form onSubmit={onSignIn}>
            <label style={{ display: "block", fontSize: 12, color: "#6B7280", marginBottom: 6 }}>Work email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 12 }}
            />
            {!!error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <button type="submit" style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
              background: "#111827", color: "white", cursor: "pointer"
            }}>
              Send magic link
            </button>
          </form>
        ) : (
          <div><p>We sent you a sign-in link. Open it on this device.</p></div>
        )}
      </div>
    </div>
  );
}

/* ========================= Small UI helpers ========================= */
function Card({ title, value, sub, right, style, children }) {
  return (
    <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{title}</div>
        <div style={{ marginLeft: "auto" }}>{right}</div>
      </div>
      {value !== undefined && <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>}
      {sub && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{sub}</div>}
      {children}
    </div>
  );
}
function Section({ title, actions, children }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
        <div style={{ marginLeft: "auto" }}>{actions}</div>
      </div>
      <div>{children}</div>
    </section>
  );
}
function Table({ columns, rows, keyField }) {
  return (
    <div style={{ overflow: "auto", border: "1px solid #E5E7EB", borderRadius: 12 }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr style={{ background: "#F3F4F6" }}>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#6B7280", borderBottom: "1px solid #E5E7EB" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[keyField] ?? i} style={{ background: i % 2 ? "#FAFAFA" : "white" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "10px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                  {typeof c.render === "function" ? c.render(row[c.key], row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ========================= App-wide KPI Store (Context + localStorage) ========================= */
const KPIContext = React.createContext(null);

const DEFAULT_KPIS = {
  propaneGallonsSold: 428_310,       // gal
  unleadedSalesCStores: 1_318_550,   // $
  offRoadDieselGallons: 96_440,      // gal
  newTanksSet: 42,                   // #
  serviceRevenue: 264_900,           // $
  customerCounts: [
    { state: "TX", residential: 1240, commercial: 310 },
    { state: "NM", residential: 460,  commercial: 120 },
    { state: "OK", residential: 380,  commercial: 95  },
  ],
};

const KPI_STORE_KEY = "kpi-store-v1";

function KPIProvider({ children }) {
  const [kpis, setKpis] = useState(() => {
    try {
      const raw = localStorage.getItem(KPI_STORE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_KPIS;
    } catch {
      return DEFAULT_KPIS;
    }
  });
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KPI_STORE_KEY, JSON.stringify(kpis));
    } catch {}
  }, [kpis]);

  const update = useCallback((patch) => {
    setKpis((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = { kpis, setKpis, update, editMode, setEditMode };
  return <KPIContext.Provider value={value}>{children}</KPIContext.Provider>;
}

function useKpis() {
  const ctx = useContext(KPIContext);
  if (!ctx) throw new Error("useKpis must be used within KPIProvider");
  return ctx;
}

// Helper to print any KPI anywhere with consistent formatting
function KPIValue({ path, format = "int" }) {
  const { kpis } = useKpis();
  const value = kpis[path];
  const fmt = (v) => {
    if (format === "usd") return "$" + Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (format === "gal") return Number(v ?? 0).toLocaleString();
    return Number(v ?? 0).toLocaleString();
  };
  return <>{fmt(value)}</>;
}

/* ========================= Mock data (placeholders kept ON) ========================= */
const STORES = ["Midland", "Odessa", "Lubbock", "Abilene", "San Angelo"];
const PRODUCTS = ["Diesel", "Gasoline", "DEF"];
const DRIVERS = ["J. Carter", "L. Nguyen", "M. Patel", "R. Gomez", "S. Ali"];
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const randf = (min, max) => min + Math.random() * (max - min);

function seedTickets(n = 160) {
  return Array.from({ length: n }, (_, i) => {
    const gallons = rand(300, 5000);
    const price = parseFloat(randf(2.25, 4.25).toFixed(2));
    return {
      id: i + 1,
      date: new Date(2025, 7, rand(1, 30)).toISOString().slice(0, 10),
      store: STORES[rand(0, STORES.length - 1)],
      product: PRODUCTS[rand(0, PRODUCTS.length - 1)],
      driver: DRIVERS[rand(0, DRIVERS.length - 1)],
      gallons,
      price,
      amount: gallons * price,
      ticketId: "T-" + (1000 + i),
      status: ["Delivered", "Scheduled", "Issue"][rand(0, 2)],
      notes: rand(0, 4) ? "" : "Call store on arrival",
    };
  });
}
function seedInvoices(tickets) {
  const byStore = new Map();
  tickets.forEach((row) => {
    byStore.set(row.store, (byStore.get(row.store) || 0) + row.amount);
  });
  return Array.from(byStore.entries()).map(([store, amount], i) => ({
    id: i + 1,
    invoiceNo: "INV-" + (5000 + i),
    store,
    total: amount,
    status: ["Open", "Pending", "Paid"][rand(0, 2)],
    created: new Date(2025, 7, rand(1, 30)).toISOString().slice(0, 10),
  }));
}

/* ========================= Reusable KPI strip (read-only) ========================= */
function KpiStrip() {
  const usd = (n) => "$" + Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const gal = (n) => Number(n ?? 0).toLocaleString();
  const { kpis } = useKpis();
  return (
    <Section title="Operations Snapshot">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 12 }}>
        <Card title="Propane Gallons Sold" value={gal(kpis.propaneGallonsSold)} sub="gal" />
        <Card title="Unleaded Fuel Sales to C-Stores" value={usd(kpis.unleadedSalesCStores)} sub="MTD" />
        <Card title="Off-Road Diesel Gallons Sold" value={gal(kpis.offRoadDieselGallons)} sub="gal" />
        <Card title="New Tanks Set" value={Number(kpis.newTanksSet ?? 0).toLocaleString()} sub="installed" />
        <Card title="Service Revenue" value={usd(kpis.serviceRevenue)} sub="MTD" />
      </div>
    </Section>
  );
}

/* ========================= Dashboard pieces ========================= */
function Filters({ value, onChange }) {
  const [q, setQ] = useState(value.q || "");
  const [store, setStore] = useState(value.store || "All");
  const [product, setProduct] = useState(value.product || "All");
  const [status, setStatus] = useState(value.status || "Any");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 160px 120px", gap: 8 }}>
      <input placeholder="Search tickets, stores, products, driver…" value={q} onChange={(e) => setQ(e.target.value)}
             style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }} />
      <select value={store} onChange={(e) => setStore(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
        <option>All</option>{STORES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select value={product} onChange={(e) => setProduct(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
        <option>All</option>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
        <option>Any</option><option>Delivered</option><option>Scheduled</option><option>Issue</option>
      </select>
      <button onClick={() => onChange({ q, store, product, status })}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#111827", color: "white", cursor: "pointer" }}>
        Apply
      </button>
    </div>
  );
}
function KPIGrid({ rows }) {
  const totals = useMemo(() => {
    const gallons = rows.reduce((a, b) => a + b.gallons, 0);
    const revenue = rows.reduce((a, b) => a + b.amount, 0);
    const avgPrice = revenue / Math.max(gallons, 1);
    const delivered = rows.filter((t) => t.status === "Delivered").length;
    const issues = rows.filter((t) => t.status === "Issue").length;
    return { gallons, revenue, avgPrice, delivered, issues };
  }, [rows]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
      <Card title="Total Gallons" value={totals.gallons.toLocaleString()} sub="Filtered sum" />
      <Card title="Est. Revenue" value={"$" + totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub={"Avg $" + totals.avgPrice.toFixed(2) + " / gal"} />
      <Card title="Delivered" value={totals.delivered} sub="Tickets" />
      <Card title="Open Issues" value={totals.issues} sub="Needs attention" />
      <Card title="Avg Ticket" value={"$" + (totals.revenue / Math.max(rows.length, 1)).toFixed(0)} sub="Revenue / ticket" />
    </div>
  );
}
function RevenueByStore({ rows }) {
  const sums = useMemo(() => {
    const m = new Map();
    rows.forEach((row) => { m.set(row.store, (m.get(row.store) || 0) + row.amount); });
    return Array.from(m.entries()).map(([store, revenue]) => ({ store, revenue })).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {sums.map((s) => (<Card key={s.store} title={s.store} value={"$" + s.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub="Est. revenue" />))}
    </div>
  );
}
function BudgetProgress({ rows }) {
  const target = 150000;
  const revenue = rows.reduce((a, b) => a + b.amount, 0);
  const pct = Math.min(100, Math.round((revenue / target) * 100));
  return (
    <Card title="Monthly Budget Progress" right={<span style={{ fontSize: 12, color: "#6B7280" }}>${target.toLocaleString()} target</span>}>
      <div style={{ height: 12, background: "#F3F4F6", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
        <div style={{ width: pct + "%", height: "100%", background: "#111827" }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13 }}>${revenue.toLocaleString()} • {pct}%</div>
    </Card>
  );
}
function TicketsTable({ rows }) {
  const cols = [
    { key: "ticketId", label: "Ticket" },
    { key: "date", label: "Date" },
    { key: "store", label: "Store" },
    { key: "product", label: "Product" },
    { key: "driver", label: "Driver" },
    { key: "gallons", label: "Gallons", render: (v) => v.toLocaleString() },
    { key: "price", label: "Price/gal", render: (v) => "$" + v.toFixed(2) },
    { key: "amount", label: "Amount", render: (v) => "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <span style={{
          padding: "4px 8px", borderRadius: 999, fontSize: 12,
          background: v === "Delivered" ? "#DCFCE7" : v === "Scheduled" ? "#E0E7FF" : "#FEE2E2",
          color: v === "Delivered" ? "#166534" : v === "Scheduled" ? "#3730A3" : "#991B1B",
          border: "1px solid " + (v === "Delivered" ? "#BBF7D0" : "Scheduled" ? "#C7D2FE" : "#FECACA")
        }}>{v}</span>
      ),
    },
    { key: "notes", label: "Notes" },
  ];
  return <Table columns={cols} rows={rows} keyField="id" />;
}
function NotesPanel() {
  const [notes, setNotes] = useState([
    { id: 1, text: "Review scheduled tickets with high gallons." },
    { id: 2, text: "Investigate open issues flagged by drivers." },
    { id: 3, text: "Confirm invoice totals against delivery volume." },
  ]);
  const [input, setInput] = useState("");
  function addNote() {
    const t = input.trim();
    if (!t) return;
    setNotes((prev) => [...prev, { id: prev.length ? prev[prev.length - 1].id + 1 : 1, text: t }]);
    setInput("");
  }
  function removeNote(id) { setNotes((prev) => prev.filter((n) => n.id !== id)); }
  return (
    <Card title="Notes / Next actions">
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a note…"
               style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }} />
        <button onClick={addNote} style={{
          padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
          background: "#111827", color: "white", cursor: "pointer"
        }}>Add</button>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, marginTop: 10 }}>
        {notes.map((n) => (
          <li key={n.id} style={{ marginBottom: 6 }}>
            <span>{n.text}</span>
            <button onClick={() => removeNote(n.id)} style={{
              marginLeft: 8, padding: "2px 6px", borderRadius: 6,
              border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 12
            }}>Remove</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ========================= Main Dashboard ========================= */
function LegacyDashboard() {
  const [filter, setFilter] = useState({ q: "", store: "All", product: "All", status: "Any" });
  const [tickets] = useState(seedTickets(160));
  const invoices = useMemo(() => seedInvoices(tickets), [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((row) => {
      if (filter.store !== "All" && row.store !== filter.store) return false;
      if (filter.product !== "All" && row.product !== filter.product) return false;
      if (filter.status !== "Any" && row.status !== filter.status) return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        const text = `${row.ticketId} ${row.store} ${row.product} ${row.driver}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filter]);

  const openIssues = filtered.filter((t) => t.status === "Issue");
  const scheduled  = filtered.filter((t) => t.status === "Scheduled");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* NEW: KPI strip */}
      <KpiStrip />

      <Section title="Filters" actions={<span style={{ fontSize: 12, color: "#6B7280" }}>{filtered.length} tickets</span>}>
        <Filters value={filter} onChange={setFilter} />
      </Section>
      <KPIGrid rows={filtered} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Section title="Revenue by Store"><RevenueByStore rows={filtered} /></Section>
        <Section title="Budget"><BudgetProgress rows={filtered} /></Section>
      </div>
      <Section title="Recent Tickets"><TicketsTable rows={filtered.slice(0, 30)} /></Section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Section title="Open Issues" actions={<span style={{ fontSize: 12, color: "#6B7280" }}>{openIssues.length}</span>}>
          <Table keyField="id" columns={[
            { key: "ticketId", label: "Ticket" },
            { key: "store", label: "Store" },
            { key: "product", label: "Product" },
            { key: "driver", label: "Driver" },
            { key: "gallons", label: "Gallons", render: (v) => v.toLocaleString() },
            { key: "date", label: "Date" },
          ]} rows={openIssues.slice(0, 12)} />
        </Section>
        <Section title="Scheduled" actions={<span style={{ fontSize: 12, color: "#6B7280" }}>{scheduled.length}</span>}>
          <Table keyField="id" columns={[
            { key: "ticketId", label: "Ticket" },
            { key: "store", label: "Store" },
            { key: "product", label: "Product" },
            { key: "driver", label: "Driver" },
            { key: "date", label: "Date" },
          ]} rows={scheduled.slice(0, 12)} />
        </Section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Section title="Store Invoicing (Rollup)">
          <Table keyField="id" columns={[
            { key: "invoiceNo", label: "Invoice" },
            { key: "store", label: "Store" },
            { key: "created", label: "Created" },
            { key: "status", label: "Status" },
            { key: "total", label: "Total", render: (v) => "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
          ]} rows={invoices.slice(0, 20)} />
        </Section>
        <NotesPanel />
      </div>
    </div>
  );
}

/* ========================= Dedicated Tabs ========================= */
function DeliveryTickets() {
  const [tickets] = useState(seedTickets(160));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section title="Delivery Tickets">
        <TicketsTable rows={tickets.slice(0, 60)} />
      </Section>
    </div>
  );
}
function StoreInvoicing() {
  const [tickets] = useState(seedTickets(160));
  const invoices = useMemo(() => seedInvoices(tickets), [tickets]);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section title="Store Invoicing">
        <Table keyField="id" columns={[
          { key: "invoiceNo", label: "Invoice" },
          { key: "store", label: "Store" },
          { key: "created", label: "Created" },
          { key: "status", label: "Status" },
          { key: "total", label: "Total", render: (v) => "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
        ]} rows={invoices} />
      </Section>
    </div>
  );
}

/* ========================= Procedures (How-tos & Videos) ========================= */
function Procedures() {
  const [items, setItems] = useState([
    { id: 1, type: "doc", title: "Office: End-of-day Closeout", body: "Checklist for closing cash drawer, meter logs, and daily report." },
    { id: 2, type: "doc", title: "Drivers: Pre-Trip Inspection", body: "Walk-around, fluids, tires, lights, ELD status." },
    { id: 3, type: "video", title: "Service Tech: Pump Priming", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  ]);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("doc"); // 'doc' | 'video'
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  function addItem() {
    if (kind === "doc" && !title.trim()) return;
    if (kind === "video" && (!title.trim() || !url.trim())) return;
    setItems(prev => [...prev, {
      id: prev.length ? prev[prev.length - 1].id + 1 : 1,
      type: kind,
      title: title.trim(),
      body: kind === "doc" ? body.trim() : undefined,
      url: kind === "video" ? url.trim() : undefined,
    }]);
    setTitle(""); setBody(""); setUrl("");
  }
  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)); }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section title="Add Procedure / Video">
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr auto", gap: 8 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <option value="doc">Procedure (Text)</option>
            <option value="video">Video (Embed)</option>
          </select>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)}
                 style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }} />
          {kind === "doc" ? (
            <input placeholder="Short description / steps" value={body} onChange={(e) => setBody(e.target.value)}
                   style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }} />
          ) : (
            <input placeholder="Video URL (YouTube, Loom, etc.)" value={url} onChange={(e) => setUrl(e.target.value)}
                   style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8 }} />
          )}
          <button onClick={addItem} style={{
            padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
            background: "#111827", color: "white", cursor: "pointer"
          }}>Add</button>
        </div>
      </Section>

      <Section title="Procedures & Training">
        <div style={{ display: "grid", gap: 12 }}>
          {items.map(i => (
            <div key={i.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{i.title}</strong>
                <span style={{
                  marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 999,
                  background: i.type === "video" ? "#E0E7FF" : "#DCFCE7",
                  color: i.type === "video" ? "#3730A3" : "#166534", border: "1px solid #E5E7EB"
                }}>{i.type === "video" ? "Video" : "Procedure"}</span>
                <button onClick={() => removeItem(i.id)} style={{
                  marginLeft: "auto", padding: "6px 8px", borderRadius: 8,
                  border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 12
                }}>Remove</button>
              </div>
              {i.type === "doc" ? (
                <p style={{ marginTop: 8 }}>{i.body}</p>
              ) : (
                <div style={{ marginTop: 10 }}>
                  <iframe
                    title={i.title}
                    src={i.url.replace("watch?v=", "embed/")}
                    style={{ width: "100%", height: 360, border: "1px solid #E5E7EB", borderRadius: 12 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                    Source: <a href={i.url} target="_blank" rel="noreferrer">{i.url}</a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ========================= Other simple tabs ========================= */
function FinancialOps() {
  const rows = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      category: ["Fuel Costs", "Maintenance", "Payroll", "Insurance"][rand(0, 3)],
      month: ["May", "Jun", "Jul", "Aug"][rand(0, 3)],
      amount: rand(1200, 13000),
      variance: rand(-1500, 2500),
      note: rand(0, 1) ? "" : "Check allocation",
    })), []
  );
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* NEW: KPI strip */}
      <KpiStrip />

      <Section title="Expense Summary">
        <Table keyField="id" columns={[
          { key: "category", label: "Category" },
          { key: "month", label: "Month" },
          { key: "amount", label: "Amount", render: (v) => "$" + v.toLocaleString() },
          { key: "variance", label: "Variance", render: (v) => (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toLocaleString() },
          { key: "note", label: "Note" },
        ]} rows={rows} />
      </Section>
    </div>
  );
}

/* ========================= Operational KPIs (editable) ========================= */
function Stepper({ label, value, onChange, steps = [ -1000, -100, -10, -1, 1, 10, 100, 1000 ], format = "int" }) {
  const fmt = (v) => {
    if (format === "usd") return "$" + Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (format === "gal") return Number(v ?? 0).toLocaleString();
    return Number(v ?? 0).toLocaleString();
  };
  const [raw, setRaw] = useState(String(value ?? 0));
  useEffect(() => { setRaw(String(value ?? 0)); }, [value]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <button key={i} onClick={() => onChange((Number(value)||0) + s)} title={(s>0?"+":"") + s}
            style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", fontSize: 12 }}>
            {(s>0?"+":"")}{s}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input
          value={raw}
          onChange={(e)=>setRaw(e.target.value)}
          onBlur={() => { const n = Number(raw.replace(/[^0-9.-]/g,"")); onChange(Number.isFinite(n) ? n : value); }}
          style={{ padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 8, width: 140, fontSize: 12 }}
        />
        <div style={{ alignSelf: "center", fontSize: 12, color: "#6B7280" }}>{fmt(value)}</div>
      </div>
    </div>
  );
}

function OperationalKPIs() {
  const { kpis, update, editMode } = useKpis();

  const totals = useMemo(() => {
    const residential = kpis.customerCounts.reduce((a,b)=>a+b.residential,0);
    const commercial  = kpis.customerCounts.reduce((a,b)=>a+b.commercial,0);
    return { residential, commercial, total: residential + commercial };
  }, [kpis.customerCounts]);

  const usd = (n) => "$" + Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const gal = (n) => Number(n ?? 0).toLocaleString();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Section title="Operational KPIs" actions={<span style={{ fontSize: 12, color: "#6B7280" }}>Snapshot</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(180px, 1fr))", gap: 12 }}>
          <Card title="Propane Gallons Sold" value={gal(kpis.propaneGallonsSold)} sub="gal">
            {editMode && (
              <Stepper
                value={kpis.propaneGallonsSold}
                onChange={(v)=>update({ propaneGallonsSold: Math.max(0, Math.round(v)) })}
                steps={[-10000,-1000,-100,-10,10,100,1000,10000]}
                format="gal"
              />
            )}
          </Card>
          <Card title="Unleaded Fuel Sales to C-Stores" value={usd(kpis.unleadedSalesCStores)} sub="month-to-date">
            {editMode && (
              <Stepper
                value={kpis.unleadedSalesCStores}
                onChange={(v)=>update({ unleadedSalesCStores: Math.max(0, Math.round(v)) })}
                steps={[-50000,-5000,-500,-50,50,500,5000,50000]}
                format="usd"
              />
            )}
          </Card>
          <Card title="Off-Road Diesel Gallons Sold" value={gal(kpis.offRoadDieselGallons)} sub="gal">
            {editMode && (
              <Stepper
                value={kpis.offRoadDieselGallons}
                onChange={(v)=>update({ offRoadDieselGallons: Math.max(0, Math.round(v)) })}
                steps={[-10000,-1000,-100,-10,10,100,1000,10000]}
                format="gal"
              />
            )}
          </Card>
          <Card title="New Tanks Set" value={Number(kpis.newTanksSet ?? 0).toLocaleString()} sub="installed">
            {editMode && (
              <Stepper
                value={kpis.newTanksSet}
                onChange={(v)=>update({ newTanksSet: Math.max(0, Math.round(v)) })}
                steps={[-50,-10,-5,-1,1,5,10,50]}
                format="int"
              />
            )}
          </Card>
          <Card title="Service Revenue" value={usd(kpis.serviceRevenue)} sub="month-to-date">
            {editMode && (
              <Stepper
                value={kpis.serviceRevenue}
                onChange={(v)=>update({ serviceRevenue: Math.max(0, Math.round(v)) })}
                steps={[-20000,-2000,-200,-20,20,200,2000,20000]}
                format="usd"
              />
            )}
          </Card>
        </div>
      </Section>

      <Section
        title="Propane Customer Count (by State & Type)"
        actions={
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            Res: {totals.residential.toLocaleString()} • Com: {totals.commercial.toLocaleString()} • Total: {totals.total.toLocaleString()}
          </div>
        }
      >
        <Table
          keyField="state"
          columns={[
            { key: "state", label: "State" },
            { key: "residential", label: "Residential", render: (v)=>v.toLocaleString() },
            { key: "commercial",  label: "Commercial",  render: (v)=>v.toLocaleString() },
            { key: "total",       label: "Total",       render: (_v,row)=> (row.residential + row.commercial).toLocaleString() },
          ]}
          rows={kpis.customerCounts.map(r => ({ ...r, total: r.residential + r.commercial }))}
        />
        {editMode && (
          <div style={{ marginTop: 12, border: "1px dashed #CBD5E1", borderRadius: 10, padding: 12 }}>
            <strong style={{ fontSize: 13 }}>Edit Customer Counts</strong>
            {kpis.customerCounts.map((r, idx) => (
              <div key={r.state} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr auto", gap: 8, marginTop: 8 }}>
                <input readOnly value={r.state} style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }} />
                <input
                  type="number" value={r.residential}
                  onChange={(e)=> {
                    const n = Math.max(0, Math.round(Number(e.target.value||0)));
                    const next = [...kpis.customerCounts]; next[idx] = { ...next[idx], residential: n }; update({ customerCounts: next });
                  }}
                  style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8 }}
                />
                <input
                  type="number" value={r.commercial}
                  onChange={(e)=> {
                    const n = Math.max(0, Math.round(Number(e.target.value||0)));
                    const next = [...kpis.customerCounts]; next[idx] = { ...next[idx], commercial: n }; update({ customerCounts: next });
                  }}
                  style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8 }}
                />
                <button onClick={()=>{
                  const next = kpis.customerCounts.filter((_,i)=>i!==idx);
                  update({ customerCounts: next });
                }} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <button onClick={()=>{
                const next = [...kpis.customerCounts, { state: "NEW", residential: 0, commercial: 0 }];
                update({ customerCounts: next });
              }} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer" }}>
                Add Row
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Budget() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* NEW: KPI strip */}
      <KpiStrip />

      <div><h2>Budget</h2></div>
    </div>
  );
}

/* ========================= Tab registry ========================= */
const TABS = [
  { key: "dashboard",    label: "Dashboard",        adminOnly: false, Component: LegacyDashboard },
  { key: "financial",    label: "Financial Ops",    adminOnly: false, Component: FinancialOps },
  // Nested under Operations group (see sidebar below)
  { key: "invoicing",    label: "Store Invoicing",  adminOnly: true,  Component: StoreInvoicing },
  { key: "tickets",      label: "Delivery Tickets", adminOnly: true,  Component: DeliveryTickets },
  { key: "ops",          label: "Operational KPIs", adminOnly: false, Component: OperationalKPIs },
  { key: "budget",       label: "Budget",           adminOnly: false, Component: Budget },
  { key: "procedures",   label: "Procedures",       adminOnly: false, Component: Procedures },
];

/* ========================= Debug overlay (quick state) ========================= */
function SelfCheck({ session }) {
  const [open, setOpen] = useState(false);
  const supaKeys = Object.keys(localStorage).filter((k) => k.startsWith("sb-")).slice(0, 5);
  const expectedRedirect = new URL("/KPI-Dashboard/", window.location.href).href;
  return (
    <div style={{ position: "fixed", left: 16, bottom: 16, zIndex: 9999 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: open ? "#111827" : "white", color: open ? "white" : "#111827", cursor: "pointer" }}
      >
        {open ? "Hide" : "Show"} Debug
      </button>
      {open && (
        <pre style={{ marginTop: 8, maxWidth: 420, maxHeight: 260, overflow: "auto", background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, fontSize: 12 }}>
{JSON.stringify({
  session: session?.user ? { id: session.user.id, email: session.user.email } : null,
  access_token: session?.access_token ? "[present]" : null,
  expectedRedirect,
  path: window.location.pathname,
  hasSupabaseKeys: supaKeys.length > 0,
  supabaseKeysPreview: supaKeys,
}, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ========================= App Shell (with collapsible group + Edit toggle) ========================= */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  // Sidebar collapsible groups
  const [groupsOpen, setGroupsOpen] = useState({
    operations: true,
  });

  function toggleGroup(name) {
    setGroupsOpen((g) => ({ ...g, [name]: !g[name] }));
  }

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("getSession error:", error);
        if (!mounted) return;
        setSession(data?.session ?? null);
      } catch (e) {
        console.error("Auth init threw:", e);
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setChecking(false);
      }
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (!mounted) return;
      setSession(s);
      setChecking(false);
    });
    return () => { mounted = false; sub?.subscription?.unsubscribe?.(); };
  }, []);

  if (checking) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Restoring session…</div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          If this never finishes, try <a href={new URL("/KPI-Dashboard/", window.location.href).href}>reloading</a>.
        </div>
      </div>
    );
  }

  if (!session) return <SignInCard />;

  const Current = TABS.find((t) => t.key === active) || TABS[0];

  // Wrap the whole app in KPIProvider so values are available everywhere
  return (
    <ErrorBoundary>
      <KPIProvider>
        <Header active={active} setActive={setActive} />
        <RoleBadge />
        <SelfCheck session={session} />
        <AppBody
          active={active}
          setActive={setActive}
          groupsOpen={groupsOpen}
          toggleGroup={toggleGroup}
          Current={Current}
        />
      </KPIProvider>
    </ErrorBoundary>
  );
}

function Header({ active, setActive }) {
  const { editMode, setEditMode } = useKpis();
  return (
    <header style={{
      padding: "16px 24px", borderBottom: "1px solid #E5E7EB",
      background: "white", position: "sticky", top: 0, zIndex: 5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Gibson Oil & Gas — KPI Dashboard</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <AdminOnly fallback={null}>
            <button
              onClick={() => setEditMode(!editMode)}
              style={{
                padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB",
                background: editMode ? "#111827" : "white", color: editMode ? "white" : "#111827",
                cursor: "pointer"
              }}
              title="Toggle edit mode for manual KPI updates"
            >
              {editMode ? "Editing KPIs…" : "Edit KPIs"}
            </button>
          </AdminOnly>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function AppBody({ active, setActive, groupsOpen, toggleGroup, Current }) {
  return (
    <div style={{ display: "flex", background: "#F8FAFC", minHeight: "calc(100vh - 60px)" }}>
      {/* Sidebar */}
      <aside style={{
        width: 260, borderRight: "1px solid #E5E7EB", background: "white",
        minHeight: "calc(100vh - 60px)", position: "sticky", top: 60, alignSelf: "flex-start",
      }}>
        <nav style={{ padding: 12 }}>
          {/* Top-level tabs */}
          {["dashboard","financial","ops","budget","procedures"].map((key) => {
            const tab = TABS.find(t => t.key === key);
            const isActive = active === key;
            return (
              <button
                key={key}
                onClick={() => setActive(key)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  background: isActive ? "#EEF2FF" : "white",
                  cursor: "pointer", fontWeight: 500,
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Collapsible group: Operations */}
          <div style={{ marginTop: 10, marginBottom: 6, fontSize: 12, color: "#6B7280" }}>GROUP</div>
          <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", background: "white" }}>
            <button
              onClick={() => toggleGroup("operations")}
              style={{
                display: "flex", gap: 8, alignItems: "center", width: "100%", padding: "10px 12px",
                border: "none", background: "white", cursor: "pointer", fontWeight: 600
              }}
            >
              <span style={{
                display: "inline-block", width: 18, textAlign: "center",
                transform: groupsOpen.operations ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease"
              }}>▶</span>
              Operations
            </button>

            {groupsOpen.operations && (
              <div style={{ borderTop: "1px solid #F3F4F6", padding: 8 }}>
                {/* Child: Store Invoicing (admin) */}
                <AdminOnly fallback={null}>
                  <button
                    onClick={() => setActive("invoicing")}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                      borderRadius: 8, border: "1px solid #E5E7EB", background: active === "invoicing" ? "#EEF2FF" : "white",
                      cursor: "pointer", fontWeight: 500, marginBottom: 6
                    }}
                  >
                    Store Invoicing 🔒
                  </button>
                </AdminOnly>

                {/* Child: Delivery Tickets (admin) */}
                <AdminOnly fallback={null}>
                  <button
                    onClick={() => setActive("tickets")}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                      borderRadius: 8, border: "1px solid #E5E7EB", background: active === "tickets" ? "#EEF2FF" : "white",
                      cursor: "pointer", fontWeight: 500
                    }}
                  >
                    Delivery Tickets 🔒
                  </button>
                </AdminOnly>

                {/* If not admin, show helpful note */}
                <AdminOnly
                  fallback={
                    <div style={{ fontSize: 12, color: "#6B7280", padding: "6px 12px" }}>
                      Admin-only tools live here.
                    </div>
                  }
                >
                  {null}
                </AdminOnly>
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, padding: 24 }}>
        {Current.adminOnly ? (
          <AdminOnly fallback={<div>Admins only.</div>}>
            <Current.Component />
          </AdminOnly>
        ) : (
          <Current.Component />
        )}
      </main>
    </div>
  );
}
