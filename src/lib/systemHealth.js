// src/lib/systemHealth.js
import { supabase } from './supabaseClient';

/**
 * Fetch system health summary from the database.
 * Returns a JSON snapshot of table counts, views, RLS status, policies, and triggers.
 * 
 * @returns {Promise<Object>} System health summary object
 */
export async function fetchSystemHealth() {
  const { data, error } = await supabase.rpc('system_health_summary');
  
  if (error) throw error;
  
  return data;
}
