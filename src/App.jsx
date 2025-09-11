// src/App.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import AdminOnly from "./components/AdminOnly";
import RoleBadge from "./components/RoleBadge";
import LegacyDashboard from "./LegacyDashboard";

/* Stub sections (swap later with real components) */
function FinancialOps() { return <div><h2>Financial Ops</h2></div>; }
function DeliveryTickets() { return <div><h2>Delivery Tickets</h2><p>Admin only.</p></div>; }
function StoreInvoicing() { return <div><h2>Store Invoicing</h2><p>Admin only.</p></div>; }
function OperationalKPIs() { return <div><h2>Operational KPIs</h2></div>; }
function Budget() { return <div><h2>Budget</h2></div>; }

const TABS = [
  { key: "dashboard", label: "Dashboard", adminOnly: false, Component: LegacyDashboard },
  { key: "financial", label: "Financial Ops", adminOnly: false, Component: FinancialOps },
  { key: "tickets", label: "Delivery Tickets", adminOnly: true, Component: DeliveryTickets },
  { key: "invoicing", label: "Store Invoicing", adminOnly: true, Component: StoreInvoicing },
  { key: "ops", label: "Operational KPIs", adminOnly: false, Component: OperationalKPIs },
  { key: "budget", label: "Budget", adminOnly: false, Component: Budget },
];

function SignInCard() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSignIn(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/KPI-Dashboard/" },
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
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 12 }}
            />
            {!!error && <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 8 }}>{error}</div>}
            <button type="submit" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#111827", color: "white", cursor: "pointer" }}>
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

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (checking) return <div style={{ padding: 24 }}><div style={{ fontSize: 18 }}>Loadingâ€¦</div></div>;
  if (!session) return <SignInCard />;

  const Current = TABS.find((t) => t.key === active) || TABS[0];

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#F8FAFC" }}>
      <RoleBadge />
      <header style={{ padding: "16px 24px", borderBottom: "1px solid #E5E7EB", background: "white", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Gibson Oil & Gas â€” KPI Dashboard</h1>
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

      <div style={{ display: "flex" }}>
        <aside style={{ width: 240, borderRight: "1px solid #E5E7EB", background: "white", minHeight: "calc(100vh - 60px)", position: "sticky", top: 60, alignSelf: "flex-start" }}>
          <nav style={{ padding: 12 }}>
            {TABS.map((tab) => {
              const btn = (
                <button
                  key={tab.key}
                  onClick={() => setActive(tab.key)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 6,
                    borderRadius: 8, border: "1px solid #E5E7EB", background: active === tab.key ? "#EEF2FF" : "white",
                    cursor: "pointer", fontWeight: 500,
                  }}
                >
                  {tab.label} {tab.adminOnly ? "ðŸ”’" : ""}
                </button>
              );
              return tab.adminOnly ? (
                <AdminOnly key={tab.key} fallback={null}>{btn}</AdminOnly>
              ) : btn;
            })}
          </nav>
        </aside>

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
  );
}

