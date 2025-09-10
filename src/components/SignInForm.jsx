// src/components/SignInForm.jsx
import React from "react";
import { supabase } from "../lib/supabaseClient";

export default function SignInForm() {
  const [mode, setMode] = React.useState("password"); // password | magic
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function signInWithPassword(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else window.location.reload();
  }

  async function signUpWithPassword(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg("Check your email to confirm your account, then sign in.");
  }

  async function sendMagicLink(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg("Magic link sent. Check your email.");
  }

  return (
    <div
      style={{
        width: 360,
        padding: 24,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "white",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 12 }}>Sign in</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setMode("password")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: mode === "password" ? "#111827" : "white",
            color: mode === "password" ? "white" : "black",
            cursor: "pointer",
          }}
        >
          Email + Password
        </button>
        <button
          onClick={() => setMode("magic")}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: mode === "magic" ? "#111827" : "white",
            color: mode === "magic" ? "white" : "black",
            cursor: "pointer",
          }}
        >
          Magic Link
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={signInWithPassword}>
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <label>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={primaryBtn}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button onClick={signUpWithPassword} disabled={busy} style={secondaryBtn}>
              Create account
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={sendMagicLink}>
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      {msg && <p style={{ marginTop: 12, color: "#b91c1c" }}>{msg}</p>}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  marginBottom: 12,
};

const primaryBtn = {
  flex: 1,
  padding: 10,
  background: "#111827",
  color: "white",
  border: "1px solid #111827",
  borderRadius: 8,
  cursor: "pointer",
};

const secondaryBtn = {
  flex: 1,
  padding: 10,
  background: "white",
  color: "black",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  cursor: "pointer",
};
