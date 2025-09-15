// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import DebugDrawer from './components/DebugDrawer'

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
function Card({ title, value, sub, right, style, children }) { /* ... unchanged */ }
function Section({ title, actions, children }) { /* ... unchanged */ }
function Table({ columns, rows, keyField }) { /* ... unchanged */ }

/* ========================= Mock data ========================= */
const STORES = ["Midland", "Odessa", "Lubbock", "Abilene", "San Angelo"];
const PRODUCTS = ["Diesel", "Gasoline", "DEF"];
const DRIVERS = ["J. Carter", "L. Nguyen", "M. Patel", "R. Gomez", "S. Ali"];
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const randf = (min, max) => min + Math.random() * (max - min);

function seedTickets(n = 160) { /* ... unchanged */ }
function seedInvoices(tickets) { /* ... unchanged */ }

/* ========================= Dashboard pieces ========================= */
function Filters({ value, onChange }) { /* ... unchanged */ }
function KPIGrid({ rows }) { /* ... unchanged */ }
function RevenueByStore({ rows }) { /* ... unchanged */ }
function BudgetProgress({ rows }) { /* ... unchanged */ }
function TicketsTable({ rows }) { /* ... unchanged */ }
function NotesPanel() { /* ... unchanged */ }

/* ========================= Main Dashboard ========================= */
function LegacyDashboard() { /* ... unchanged */ }

/* ========================= Dedicated Tabs ========================= */
function DeliveryTickets() { /* ... unchanged */ }
function StoreInvoicing() { /* ... unchanged */ }

/* ========================= Procedures ========================= */
function Procedures() { /* ... unchanged (text+video support) */ }

/* ========================= Other Tabs ========================= */
function FinancialOps() { /* ... unchanged */ }
function OperationalKPIs() { return <div><h2>Operational KPIs</h2></div>; }
function Budget() { return <div><h2>Budget</h2></div>; }

/* ========================= Tab registry ========================= */
const TABS = [
  { key: "dashboard", label: "Dashboard", adminOnly: false, Component: LegacyDashboard },
  { key: "financial", label: "Financial Ops", adminOnly: false, Component: FinancialOps },
  { key: "invoicing", label: "Store Invoicing", adminOnly: true, Component: StoreInvoicing },
  { key: "tickets", label: "Delivery Tickets", adminOnly: true, Component: DeliveryTickets },
  { key: "ops", label: "Operational KPIs", adminOnly: false, Component: OperationalKPIs },
  { key: "budget", label: "Budget", adminOnly: false, Component: Budget },
  { key: "procedures", label: "Procedures", adminOnly: false, Component: Procedures },
];

/* ========================= Debug overlay ========================= */
function SelfCheck({ session }) { /* ... unchanged */ }

/* ========================= App Shell ========================= */
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState({ operations: true });

  function toggleGroup(name) { setGroupsOpen((g) => ({ ...g, [name]: !g[name] })); }

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data?.session ?? null);
        if (error) console.error("getSession error:", error);
      } catch (e) {
        if (mounted) setSession(null);
        console.error("Auth init threw:", e);
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

  if (checking) return <div style={{ padding: 24 }}>Restoring session…</div>;
  if (!session) return <SignInCard />;

  const Current = TABS.find((t) => t.key === active) || TABS[0];

  return (
    <ErrorBoundary>
      <div style={{ position: "relative", minHeight: "100vh", background: "#F8FAFC" }}>
        <RoleBadge />
        <SelfCheck session={session} />
        <DebugDrawer /> {/* <-- Debug drawer lives here */}

        {/* Header, Sidebar, Content ... unchanged */}
      </div>
    </ErrorBoundary>
  );
}
