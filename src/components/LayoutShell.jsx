// src/components/LayoutShell.jsx
import React from "react";
import "../styles/site-theme.css";

const BRAND = {
  primary: "#21253F",
};

export default function LayoutShell({
  currentTab,
  setCurrentTab,
  children,
}) {
  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "operations", label: "Operations" },
    { id: "budget", label: "Budget" },
    { id: "assets", label: "Assets" },
    { id: "graphs", label: "Graphs" },
  ];

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: BRAND.primary, color: "white" }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/site-logo.svg"
            alt="Logo"
            className="h-7 w-7 rounded"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="font-semibold">Gibson Oil &amp; Gas</div>
        </div>

        <div className="flex items-center gap-2 text-xs opacity-90">
          <span className="hidden sm:inline">gibson_oil_gas</span>
          <div className="h-6 w-px bg-white/30" />
          <span>Reports</span>
          <div className="h-6 w-px bg-white/30" />
          <span>Help</span>
        </div>
      </header>

      {/* Body with left nav + content */}
      <div className="mx-auto flex max-w-7xl">
        {/* Dark Nasdaq-like Left nav */}
        <aside className="left-nav-dark">
          <div className="left-nav-inner">
            <div className="left-nav-header">
              Navigation
            </div>
            <nav className="left-nav-menu">
              {tabs.map((t) => {
                const active = currentTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setCurrentTab(t.id)}
                    className={`left-nav-item ${active ? 'active' : ''}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 bg-slate-50 p-4">{children}</main>
      </div>
    </div>
  );
}
