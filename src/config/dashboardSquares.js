// src/config/dashboardSquares.js

/**
 * Configuration for dashboard "squares" (KPI cards).
 *
 * Each square:
 *  - has a key used in code
 *  - a label for the UI
 *  - and a `compute` function that pulls the value from the API payload
 */

export const DASHBOARD_SQUARES = [
  {
    key: 'totalGallonsAllStores',
    label: 'Total Gallons (All C-Stores)',
    compute: (data) => {
      const list = data.cStoreGallons || [];
      return list.reduce((sum, row) => sum + (Number(row.totalGallons || row.total_gallons || 0)), 0);
    },
    format: 'gallons',
  },
  {
    key: 'weeklyServiceRevenue',
    label: 'Service Revenue (This Week)',
    compute: (data) => Number(data.serviceTracking?.completedRevenue || 0),
    format: 'currency',
  },

  // KPI cards persisted in dashboard_kpis
  {
    key: 'currentTanks',
    label: 'Current Tanks',
    compute: (data) => (data.dashboardKpis?.current_tanks || 0),
    format: 'number',
  },
  {
    key: 'customersLost',
    label: 'Customers Lost',
    compute: (data) => (data.dashboardKpis?.customers_lost || 0),
    format: 'number',
  },
  {
    key: 'customersGained',
    label: 'Customers Gained',
    compute: (data) => (data.dashboardKpis?.customers_gained || 0),
    format: 'number',
  },
  {
    key: 'tanksSet',
    label: 'Tanks Set',
    compute: (data) => (data.dashboardKpis?.tanks_set || 0),
    format: 'number',
  },

  // Add your new custom squares here...
];
