// src/lib/healthCheck.js
// Optional diagnostic utility for checking Supabase connectivity and permissions
// This is NOT imported or used automatically - it's only for manual debugging

/**
 * Check Supabase connectivity, authentication, and permissions
 * 
 * Usage from browser console:
 * ```
 * import { checkSupabaseConnectivity } from './lib/healthCheck.js';
 * import supabase from './lib/supabaseClient.js';
 * const result = await checkSupabaseConnectivity(supabase);
 * console.log(result);
 * ```
 * 
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<Object>} - Diagnostic results
 */
export async function checkSupabaseConnectivity(supabase) {
  const result = {
    ok: true,
    user: null,
    canReadTickets: false,
    errorMessages: [],
  };

  // Check authentication status
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      result.ok = false;
      result.errorMessages.push(`Auth check failed: ${error.message}`);
    } else {
      result.user = data?.user?.email || data?.user?.id || 'anonymous';
    }
  } catch (err) {
    result.ok = false;
    result.errorMessages.push(`Auth check exception: ${err.message}`);
  }

  // Test lightweight read on delivery_tickets table
  try {
    const { count, error } = await supabase
      .from('delivery_tickets')
      .select('id', { count: 'exact', head: true });
    
    if (error) {
      result.ok = false;
      result.canReadTickets = false;
      result.errorMessages.push(`Cannot read delivery_tickets: ${error.message}`);
    } else {
      result.canReadTickets = true;
      result.errorMessages.push(`Successfully verified access to delivery_tickets (count: ${count ?? 'unknown'})`);
    }
  } catch (err) {
    result.ok = false;
    result.canReadTickets = false;
    result.errorMessages.push(`delivery_tickets read exception: ${err.message}`);
  }

  return result;
}

export default { checkSupabaseConnectivity };
