// src/AuthLayout.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function AuthLayout({ children }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error(error);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setErr("");
    setSent(false);

    const redirectTo =
      // If your site is served under a subpath (GitHub Pages), use the full URL:
      window.location.origin + window.location.pathname;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">Loading…</div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow border">
          <h1 className="text-xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-slate-600 mb-4">
            Enter your email and we’ll send a one-time link.
          </p>

          <form onSubmit={signIn} className="flex gap-2">
            <input
              type="email"
              required
              placeholder="you@company.com"
              className="flex-1 rounded-lg border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="rounded-lg bg-slate-900 text-white px-4 py-2">
              Send link
            </button>
          </form>

          {sent && (
            <p className="text-xs text-green-700 mt-3">
              Link sent—check your inbox.
            </p>
          )}
          {err && (
            <p className="text-xs text-red-600 mt-3">Error: {err}</p>
          )}

          <p className="text-xs text-slate-500 mt-4">
            Tip: make sure your Supabase “Site URL” matches this page’s URL.
          </p>
        </div>
      </div>
    );
  }

  // Authenticated → render the app
  return <>{children}</>;
}
