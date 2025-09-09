import React from "react";

export default function LayoutShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-slate-800 text-white px-6 py-3">
        <h1 className="text-lg font-bold">Gibson Oil & Gas — Dashboard</h1>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
