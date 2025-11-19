/**
 * Service Schedule API helpers
 * Fetches service jobs for calendar view
 */

import { supabase } from "./supabaseClient";

/**
 * Fetch service jobs for a date range
 * 
 * @param {Date} startDate - Start of date range
 * @param {Date} endDate - End of date range
 * @returns {Promise<Array>} - Service jobs with mapped fields for calendar
 */
export async function fetchServiceJobsForRange(startDate, endDate) {
  // Get current user ID
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  
  if (!userId) {
    throw new Error("Not authenticated");
  }
  
  // Query service_jobs table for date range
  const { data, error } = await supabase
    .from("service_jobs")
    .select("*")
    .eq("created_by", userId)
    .gte("scheduled_start_at", startDate.toISOString())
    .lte("scheduled_start_at", endDate.toISOString())
    .order("scheduled_start_at", { ascending: true });
  
  if (error) {
    console.error("Fetch service jobs error:", error);
    throw new Error(error.message || "Failed to fetch service jobs");
  }
  
  // Map database fields to calendar job format
  return (data || []).map(row => ({
    id: row.id,
    jobNumber: row.job_number,
    customer: row.customer_name || "",
    status: row.status || "unscheduled",
    jobType: row.job_description || "",
    scheduledStart: row.scheduled_start_at,
    scheduledEnd: null, // Not tracked in current schema
    technician: row.primary_tech || "",
    jobAmount: row.job_amount || 0,
    dueAmount: row.due_amount || 0,
    notes: "", // Not tracked in current schema
    address: row.address || "",
    jobDate: row.job_date,
  }));
}

export default {
  fetchServiceJobsForRange,
};
