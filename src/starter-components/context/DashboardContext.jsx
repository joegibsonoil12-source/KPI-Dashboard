// src/starter-components/context/DashboardContext.jsx
import React, { createContext, useContext, useState } from "react";

// Mock data for the dashboard
const INITIAL_KPI_DATA = {
  propaneGallonsSold: 15420,
  unleadedSalesCStores: 125600,
  offRoadDieselGallons: 8750,
  newTanksSet: 12,
  serviceRevenue: 42300,
  monthlyRevenue: 189500,
  totalCustomers: 324,
  activeContracts: 156,
  maintenanceRequests: 23
};

// Create context for sharing data across components
const DashboardContext = createContext();

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

export function DashboardProvider({ children }) {
  const [kpiData, setKpiData] = useState(INITIAL_KPI_DATA);

  const value = {
    kpiData,
    setKpiData
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}