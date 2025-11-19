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
      return list.reduce((sum, row) => sum + (Number(row.totalGallons) || 0), 0);
    },
    format: 'gallons',
  },
  {
    key: 'weeklyServiceRevenue',
    label: 'Service Revenue (This Week)',
    compute: (data) => Number(data.serviceTracking?.completedRevenue || 0),
    format: 'currency',
  },
  // Add your new custom squares here:
  // {
  //   key: 'myNewMetric',
  //   label: 'My New Metric',
  //   compute: data => ...,
  //   format: 'number' | 'currency' | 'gallons'
  // }
];
