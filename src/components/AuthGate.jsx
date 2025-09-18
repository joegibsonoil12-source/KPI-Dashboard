// src/components/AuthGate.jsx
import React from "react";
import { supabase, isDevelopmentMode } from "../lib/supabaseClient";
import SignInForm from "./SignInForm";

export default function AuthGate({ children }) {
  const [status, setStatus] = React.useState("checking"); // checking | signed-in | signed-out | dev-bypass
  const [connectionError, setConnectionError] = React.useState(null);

  React.useEffect(() => {
    let alive = true;

    // If in development mode, offer bypass option immediately
    if (isDevelopmentMode) {
      setStatus("signed-out");
      setConnectionError("Development mode detected - Supabase not configured");
      return;
    }

    async function check() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        console.log("[AuthGate] getSession:", { data, error });

        if (error) {
          // Check if it's a connection error
          if (error.message?.includes('fetch') || error.message?.includes('network')) {
            setConnectionError(error.message);
            setStatus("signed-out");
          } else {
            setStatus("signed-out");
          }
          return;
        }
        setStatus(data?.session ? "signed-in" : "signed-out");
      } catch (err) {
        console.error("[AuthGate] Connection error:", err);
        setConnectionError(err.message);
        setStatus("signed-out");
      }
    }

    // Only run connection check if not in development mode
    if (!isDevelopmentMode) {
      check();

      // Only set up auth state listener if initial connection worked
      let subscription = null;
      if (!connectionError) {
        try {
          const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!alive) return;
            console.log("[AuthGate] onAuthStateChange:", { session });
            setStatus(session ? "signed-in" : "signed-out");
          });
          subscription = data.subscription;
        } catch (err) {
          console.error("[AuthGate] Auth listener error:", err);
        }
      }

      return () => {
        alive = false;
        subscription?.unsubscribe();
      };
    }
  }, [connectionError]);

  if (status === "checking") {
    return (
      <div style={{ padding: 24 }}>
        <p>Checking sign-in…</p>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>
          <SignInForm connectionError={connectionError} />
          {connectionError && (
            <div style={{ 
              marginTop: 16, 
              padding: 16, 
              background: "#fef3c7", 
              border: "1px solid #f59e0b", 
              borderRadius: 8,
              maxWidth: 400
            }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#92400e" }}>Connection Issue Detected</h3>
              <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#92400e" }}>
                Unable to connect to Supabase: {connectionError}
              </p>
              <button 
                onClick={() => setStatus("dev-bypass")}
                style={{
                  padding: "8px 16px",
                  background: "#f59e0b",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14
                }}
              >
                Continue in Development Mode
              </button>
              <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#92400e" }}>
                This will bypass authentication for testing. Configure Supabase credentials for production.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "dev-bypass") {
    return (
      <div>
        <div style={{
          background: "#fef3c7",
          border: "1px solid #f59e0b",
          padding: 8,
          textAlign: "center",
          fontSize: 12,
          color: "#92400e"
        }}>
          ⚠️ Development Mode - Authentication Bypassed - Configure Supabase for production
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
