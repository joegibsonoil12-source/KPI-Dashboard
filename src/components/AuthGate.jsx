// src/components/AuthGate.jsx
import React from "react";
import { supabase } from "../lib/supabaseClient";
import SignInForm from "./SignInForm";

export default function AuthGate({ children }) {
  const [status, setStatus] = React.useState("checking"); // checking | signed-in | signed-out

  React.useEffect(() => {
    let alive = true;

    async function check() {
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      console.log("[AuthGate] getSession:", { data, error });

      if (error) {
        setStatus("signed-out");
        return;
      }
      setStatus(data?.session ? "signed-in" : "signed-out");
    }

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      console.log("[AuthGate] onAuthStateChange:", { session });
      setStatus(session ? "signed-in" : "signed-out");
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

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
        <SignInForm />
      </div>
    );
  }

  return <>{children}</>;
}
