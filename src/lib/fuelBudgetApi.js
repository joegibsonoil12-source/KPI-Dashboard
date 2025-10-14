// src/lib/fuelBudgetApi.js
import { supabase } from './supabaseClient';

/**
 * Fetch fuel budget vs actual data from the view.
 * Supports optional filtering by month and store.
 * 
 * @param {Object} filters - Optional filters { month, store }
 * @returns {Promise<Array>} Array of budget vs actual records
 */
export async function fetchFuelBudgetVsActual(filters = {}) {
  let q = supabase.from('fuel_budget_vs_actual').select('*');
  
  if (filters.month) {
    q = q.eq('month', filters.month);
  }
  
  if (filters.store) {
    q = q.eq('store', filters.store);
  }
  
  const { data, error } = await q;
  
  if (error) throw error;
  
  return data || [];
}
