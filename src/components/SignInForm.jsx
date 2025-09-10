import React, { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [mode, setMode] = useState("password"); // "password" | "magic"
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const signInWithPassword = async (e) => {
    e.preventDefault();
    setMsg(""); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) setMsg(error.message);
    else setMsg("Signed in! Redirecting…");
  };

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setMsg(""); setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true }});
    setLoading(false);
    setMsg(error ? error.message : "Check your email for a sign-in link.");
  };

  const onSubmit = mode === "password" ? signInWithPassword : sendMagicLink;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Sign in</h1>
        <p className="text-slate-500 mb-4">Gibson Oil &amp; Gas — internal dashboard</p>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1 rounded border ${mode==='password'?'bg-slate-800 text-white':'bg-white'} border-slate-300`}
            onClick={() => setMode("password")}
          >
            Email + Password
          </button>
          <button
            className={`px-3 py-1 rounded border ${mode==='magic'?'bg-slate-800 text-white':'bg-white'} border-slate-300`}
            onClick={() => setMode("magic")}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-600">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />
          </div>

          {mode === "password" && (
            <div>
              <label className="block text-sm text-slate-600">Password</label>
              <input
                type="password"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
                value={pass}
                onChange={(e)=>setPass(e.target.value)}
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded bg-slate-800 text-white disabled:opacity-60"
          >
            {loading ? "Working…" : (mode === "password" ? "Sign in" : "Send magic link")}
          </button>

          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </form>
      </div>
    </div>
  );
}
