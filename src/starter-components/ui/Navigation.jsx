// src/starter-components/ui/Navigation.jsx
import React from "react";

export default function Navigation({ activeTab, setActiveTab }) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "kpis", label: "KPIs", icon: "📈" },
    { id: "budget", label: "Budget", icon: "💰" },
    { id: "procedures", label: "Procedures", icon: "📋" }
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
              G
            </div>
            <span className="text-xl font-semibold text-gray-900">
              Gibson Oil & Gas
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex space-x-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Demo Mode</span>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              👤
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}