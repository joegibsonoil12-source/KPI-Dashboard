// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

import AuthGate from "./components/AuthGate.jsx";
import { supabase } from "./lib/supabaseClient.js";

function TopBar() {
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data?.user?.email || "");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email || "");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div
      style={{
        height: 44,
        background: "#0f172a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: 14,
      }}
    >
      <div>Gibson Oil & Gas — KPI Dashboard</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>
          {email ? `Signed in as ${email}` : "Not signed in"}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: "#1f2937",
            color: "white",
            border: "1px solid #374151",
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <TopBar />
      <App />
    </AuthGate>
  </React.StrictMode>
);

