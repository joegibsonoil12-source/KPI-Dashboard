// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
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
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (!cancelled) setRole((data?.role || "user").toLowerCase());
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { cancelled = true; sub?.subscription?.unsubscribe?.(); };
  }, []);
  return (
    <div style={{
      position: "fixed", right: 16, bottom: 16, background: "#111827",
      color: "white", padding: "6px 10px", borderRadius: 8, fontSize: 12,
      zIndex: 9, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
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
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { if (mounted) setIsAdmin(false); return; }
      const { data, error } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (!mounted) return;
      if (error) { console.error("AdminOnly profile error:", error); setIsAdmin(false); return; }
      setIsAdmin((data?.role || "").toLowerCase() === "admin");
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
/*  FIX: use `row` instead of `r` to avoid shadowing/TDZ errors  */
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

/* ========================= Mock data (placeholders) ========================= */
const STORES = ["Midland", "Odessa", "Lubbock", "Abilene", "San Angelo"];
const PRODUCTS = ["Diesel", "Gasoline", "DEF"];
const DRIVERS = ["J. Carter", "L. Nguyen", "M. Patel", "R. Gomez", "S. Ali"];
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const randf = (min, max) => min + Math.random() * (max - min);

function seedTickets(n = 140) {
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
    return Array.from(m.entries())
      .map(([store, revenue]) => ({ store, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [rows]);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {sums.map((s) => (
        <Card key={s.store} title={s.store} value={"$" + s.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} sub="Est. revenue" />
      ))}
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
      key: "status", label: "Status",
      render: (v) => (
        <span style={{
          padding: "4px 8px", borderRadius: 999, fontSize: 12,
          background: v === "Delivered" ? "#DCFCE7" : v === "Scheduled" ? "#E0E7FF" : "#FEE2E2",
          color: v === "Delivered" ? "#166534" : v === "Scheduled" ? "#3730A3" : "#991B1B",
          border: "1px solid " + (v === "Delivered" ? "#BBF7D0" : v === "Scheduled" ? "#C7D2FE" : "#FECACA")
        }}>{v}</span>
      )
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
function LegacyDashboard() {
  // OPTION A: keep UI but hide data until real backend is wired
  const [filter, setFilter] = useState({ q: "", store: "All", product: "All", status: "Any" });
  const [tickets, setTickets] = useState([]);      // 👈 empty = no placeholder data
  const invoices = useMemo(() => [], []);          // 👈 empty until wired

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
      <Section title="Filters" actions={<span style={{ fontSize: 12, color: "#6B7280" }}>{filtered.length} tickets</span>}>
        <Filters value={filter} onChange={setFilter} />
      </Section>

      {tickets.length > 0 && <KPIGrid rows={filtered} />}

      {tickets.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <Section title="Revenue by Store"><RevenueByStore rows={filtered} /></Section>
          <Section title="Budget"><BudgetProgress rows={filtered} /></Section>
        </div>
      )}

      {tickets.length > 0 && (
        <Section title="Recent Tickets"><TicketsTable rows={filtered.slice(0, 30)} /></Section>
      )}

      {tickets.length > 0 && (
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
      )}

      {/* Notes panel stays visible even if there’s no data */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Section title="Store Invoicing (Rollup)">
          {invoices.length > 0 ? (
            <Table keyField="id" columns={[
              { key: "invoiceNo", label: "Invoice" },
              { key: "store", label: "Store" },
              { key: "created", label: "Created" },
              { key: "status", label: "Status" },
              { key: "total", label: "Total", render: (v) => "$" + v.toLocaleString(undefined, { maximumFractionDigits: 0 }) },
            ]} rows={invoices.slice(0, 20)} />
          ) : (
            <div style={{ padding: 12, border: "1px dashed #E5E7EB", borderRadius: 8, color: "#6B7280" }}>
              No invoices yet.
            </div>
          )}
        </Section>
        <NotesPanel />
      </div>
    </div>
  );
}

/* ========================= Other tabs (stubs) ========================= */
function FinancialOps() { return <div><h2>Financial Ops</h2></div>; }
function DeliveryTickets() { return <div><h2>Delivery Tickets</h2><p>Admin only.</p></div>; }
function StoreInvoicing() { return <div><h2>Store Invoicing</h2><p>Admin only.</p></div>; }
function OperationalKPIs() { return <div><h2>Operational KPIs</h2></div>; }
function Budget() { return <div><h2>Budget</h2></div>; }

/* ========================= Tabs ========================= */
const TABS = [
  { key: "dashboard", label: "Dashboard", adminOnly: false, Component: LegacyDashboard },
  { key: "financial", label: "Financial Ops", adminOnly: false, Component: FinancialOps },
  { key: "tickets", label: "Delivery Tickets", adminOnly: true, Component: DeliveryTickets },
  { key: "invoicing", label: "Store Invoicing", adminOnly: true, Component: StoreInvoicing },
  { key: "ops", label: "Operational KPIs", adminOnly: false, Component: OperationalKPIs },
  { key: "budget", label: "Budget", adminOnly: false, Component: Budget },
];

/* ========================= Self-check overlay ========================= */
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

/* ========================= App Shell ========================= */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

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

  return (
    <ErrorBoundary>
      <div style={{ position: "relative", minHeight: "100vh", background: "#F8FAFC" }}>
        <RoleBadge />
        <SelfCheck session={session} />

        {/* Header */}
        <header style={{
          padding: "16px 24px", borderBottom: "1px solid #E5E7EB",
          background: "white", position: "sticky", top: 0, zIndex: 5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>Gibson Oil & Gas — KPI Dashboard</h1>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}
                style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", background: "white", cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Layout */}
        <div style={{ display: "flex" }}>
          {/* Sidebar */}
          <aside style={{
            width: 240, borderRight: "1px solid #E5E7EB", background: "white",
            minHeight: "calc(100vh - 60px)", position: "sticky", top: 60, alignSelf: "flex-start",
          }}>
            <nav style={{ padding: 12 }}>
              {TABS.map((tab) => {
                const buttonEl = (
                  <button
                    key={tab.key}
                    onClick={() => setActive(tab.key)}
                    style={{
                      display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                      marginBottom: 6, borderRadius: 8, border: "1px solid #E5E7EB",
                      background: active === tab.key ? "#EEF2FF" : "white",
                      cursor: "pointer", fontWeight: 500,
                    }}
                  >
                    {tab.label} {tab.adminOnly ? "🔒" : ""}
                  </button>
                );
                return tab.adminOnly ? (
                  <AdminOnly key={tab.key} fallback={null}>{buttonEl}</AdminOnly>
                ) : (
                  buttonEl
                );
              })}
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
      </div>
    </ErrorBoundary>
  );
}
