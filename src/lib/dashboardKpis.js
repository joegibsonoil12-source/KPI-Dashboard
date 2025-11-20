// src/lib/dashboardKpis.js
import { supabase } from './supabaseClient';

/**
 * Fetch the single dashboard_kpis row (returns defaults if none)
 */
export async function fetchDashboardKpis() {
  try {
    // Attempt to select a single row if present
    const { data, error } = await supabase
      .from('dashboard_kpis')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      // If 404/no rows, return defaults
      console.warn('[dashboardKpis] fetch warning', error.message || error);
      return {
        current_tanks: 0,
        customers_lost: 0,
        customers_gained: 0,
        tanks_set: 0,
      };
    }

    return data || {
      current_tanks: 0,
      customers_lost: 0,
      customers_gained: 0,
      tanks_set: 0,
    };
  } catch (e) {
    console.error('[dashboardKpis] fetch error', e);
    return {
      current_tanks: 0,
      customers_lost: 0,
      customers_gained: 0,
      tanks_set: 0,
    };
  }
}

/**
 * Upsert dashboard KPI values
 */
export async function upsertDashboardKpis(values = {}) {
  const payload = {
    current_tanks: values.current_tanks || 0,
    customers_lost: values.customers_lost || 0,
    customers_gained: values.customers_gained || 0,
    tanks_set: values.tanks_set || 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('dashboard_kpis')
    .upsert(payload, { onConflict: ['id'] });

  if (error) {
    console.error('[dashboardKpis] upsert error', error);
    throw error;
  }

  return data;
}
