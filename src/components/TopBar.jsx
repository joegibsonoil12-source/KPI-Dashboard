import React from "react";
import { supabase } from "../lib/supabaseClient";

export default function TopBar() {
  return (
    <div className="w-full bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
      <div className="font-semibold">Gibson Oil &amp; Gas — KPI Dashboard</div>
      <button
        className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded"
        onClick={() => supabase.auth.signOut()}
      >
        Sign out
      </button>
    </div>
  );
}
