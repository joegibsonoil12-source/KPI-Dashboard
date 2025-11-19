// src/config/cStoreConfig.js

/**
 * Mapping from Excel sheet names to your internal store IDs / dashboard keys.
 * Adjust the `storeId` / `dashboardKey` to match your Supabase schema and dashboard.
 */

export const CSTORE_SHEETS = [
  { sheetName: 'Laurel Hill Food Mart', storeId: 'LAUREL_HILL', dashboardKey: 'laurelHillGallons' },
  { sheetName: 'Old Wire',              storeId: 'OLD_WIRE',    dashboardKey: 'oldWireGallons' },
  { sheetName: "Sam's",                 storeId: 'SAMS',        dashboardKey: 'samsGallons' },
  { sheetName: 'Springfield',           storeId: 'SPRINGFIELD', dashboardKey: 'springfieldGallons' },
  { sheetName: 'Corner Pantry',         storeId: 'CORNER',      dashboardKey: 'cornerPantryGallons' },
  // Add the rest of your sheets here
];

export function findStoreBySheet(sheetName) {
  return CSTORE_SHEETS.find(s => s.sheetName === sheetName) || null;
}
