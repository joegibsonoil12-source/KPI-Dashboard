// src/App_Clean.jsx
// ============================================================================
// Gibson Oil & Gas — KPI Dashboard Starter Template
// Modular React dashboard template without authentication dependencies
// ============================================================================

import React, { useState } from "react";
import { DashboardProvider } from "./starter-components/context/DashboardContext";
import Navigation from "./starter-components/ui/Navigation";
import Dashboard from "./starter-components/pages/Dashboard";
import KPIsPage from "./starter-components/pages/KPIs";
import BudgetPage from "./starter-components/pages/Budget";
import Procedures from "./starter-components/pages/Procedures";
import AIHelper from "./starter-components/widgets/AIHelper";

// Main App Component
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderCurrentPage = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "kpis":
        return <KPIsPage />;
      case "budget":
        return <BudgetPage />;
      case "procedures":
        return <Procedures />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-slate-50">
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="container mx-auto px-4 py-6">
          {renderCurrentPage()}
        </main>
        <AIHelper />
      </div>
    </DashboardProvider>
  );
}