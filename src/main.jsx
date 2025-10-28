// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/brand.css";
import "./styles/global.css";

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
    <div className="app-header" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.75rem 1.5rem",
      fontSize: "0.875rem",
    }}>
      <div style={{ fontWeight: 600, fontSize: "1rem" }}>Gibson Oil & Gas — KPI Dashboard</div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <span style={{ opacity: 0.8 }}>
          {email ? `Signed in as ${email}` : "Not signed in"}
        </span>
        <button
          onClick={handleSignOut}
          className="btn btn-sm secondary"
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

