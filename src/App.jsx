// src/App.jsx
// ============================================================================
// Gibson Oil & Gas — KPI Dashboard
// Entire single-file React app (Vite + React).
// Fully corrected and self-contained. Paste this into src/App.jsx.
// ============================================================================

import React, { useEffect, useMemo, useState, useContext, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import Procedures from "./tabs/Procedures_v3";

/* ========================================================================== */
/* Error Boundary                                                             */
/* ========================================================================== */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
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

/* ========================================================================== */
/* Role Badge                                                                 */
/* ========================================================================== */
function RoleBadge() {
  const [role, setRole] = useState("user");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) return;
        const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
        if (!cancelled) setRole((data?.role || "user").toLowerCase());
      } catch { if (!cancelled) setRole("user"); }
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

/* ========================================================================== */
/* AdminOnly                                                                  */
/* ========================================================================== */
function AdminOnly({ children, fallback = null }) {
  const [isAdmin, setIsAdmin] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (!uid) { if (mounted) setIsAdmin(false); return; }
        const { data, error } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
        if (!mounted) return;
        if (error) { console.error("AdminOnly profile error:", error); setIsAdmin(false); return; }
        setIsAdmin((data?.role || "").toLowerCase() === "admin");
      } catch { if (mounted) setIsAdmin(false); }
    })();
    return () => { mounted = false; };
  }, []);
  if (isAdmin === null) return null;
  if (!isAdmin) return fallback;
  return <>{children}</>;
}

/* ========================================================================== */
/* SignIn (magic link)                                                        */
/* ========================================================================== */
function SignInCard() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function onSignIn(e) {
    e.preventDefault();
    setError("");
    const redirect = new URL("/KPI-Dashboard/", window.location.href).href;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) setError(error.message); else setSent(true);
  }
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        {!sent ? (
          <form onSubmit={onSignIn}>
            <label style={{ display: "block", fontSize: 12, color: "#6B7280", marginBottom: 6 }}>Work email</label>
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com"
                   style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 12 }} />
            {!!error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <button type="submit" style={{
              width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
              background: "#111827", color: "white", cursor: "pointer"
            }}>Send magic link</button>
          </form>
        ) : (<div><p>We sent you a sign-in link. Open it on this device.</p></div>)}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Small UI helpers                                                           */
/* ========================================================================== */
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

/* ========================================================================== */
/* App-wide KPI Store (Context + localStorage)                                */
/* ========================================================================== */
const KPIContext = React.createContext(null);

const DEFAULT_KPIS = {
  propaneGallonsSold: 428_310,
  unleadedSalesCStores: 1_318_550,
  offRoadDieselGallons: 96_440,
  newTanksSet: 42,
  serviceRevenue: 264_900,
  customerCounts: [
    { state: "TX", residential: 1240, commercial: 310 },
    { state: "NM", residential: 460,  commercial: 120 },
    { state: "OK", residential: 380,  commercial: 95  },
  ],
};
const KPI_STORE_KEY = "kpi-store-v1";

function KPIProvider({ children }) {
  const [kpis, setKpis] = useState(() => {
    try { const raw = localStorage.getItem(KPI_STORE_KEY); return raw ? JSON.parse(raw) : DEFAULT_KPIS; }
    catch { return DEFAULT_KPIS; }
  });
  const [editMode, setEditMode] = useState(false);
  useEffect(() => { try { localStorage.setItem(KPI_STORE_KEY, JSON.stringify(kpis)); } catch {} }, [kpis]);
  const update = useCallback((patch) => setKpis((prev) => ({ ...prev, ...patch })), []);
  const value = { kpis, setKpis, update, editMode, setEditMode };
  return <KPIContext.Provider value={value}>{children}</KPIContext.Provider>;
}
function useKpis() {
  const ctx = useContext(KPIContext);
  if (!ctx) throw new Error("useKpis must be used within KPIProvider");
  return ctx;
}
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

/* ========================================================================== */
/* Main Dashboard                                                              */
/* ========================================================================== */
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
      setSession(s); setChecking(false);
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

  return (
    <ErrorBoundary>
      <KPIProvider>
        <Header />
        <RoleBadge />
        <Procedures />
      </KPIProvider>
    </ErrorBoundary>
  );
}

function Header() {
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
