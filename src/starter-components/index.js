// src/starter-components/index.js
// Export all starter components for easy importing

// Context
export { DashboardProvider, useDashboard } from './context/DashboardContext';

// UI Components
export { default as Navigation } from './ui/Navigation';
export { Card, KPICard } from './ui/Card';

// Pages
export { default as Dashboard } from './pages/Dashboard';
export { default as KPIsPage } from './pages/KPIs';
export { default as BudgetPage } from './pages/Budget';
export { default as Procedures } from './pages/Procedures';

// Widgets
export { default as AIHelper } from './widgets/AIHelper';

// Main App
export { default as StarterApp } from '../App_Clean';