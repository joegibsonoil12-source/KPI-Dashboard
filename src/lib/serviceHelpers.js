/**
 * Service Tracking helpers for Supabase operations
 * Handles upsert logic for service jobs with deduplication on (created_by, job_number)
 */

import { supabase } from "./supabaseClient";

/**
 * Maximum number of jobs to fetch in a single query
 * Prevents performance issues with very large datasets
 */
const MAX_JOBS_LIMIT = 500;

/**
 * Deduplicate rows by job_number within a file
 * When the same Job # appears multiple times, keep the last occurrence
 * 
 * @param {Array} rows - Array of service job rows
 * @returns {Array} - Deduplicated rows (last occurrence wins)
 */
export function dedupeByJobNumber(rows) {
  if (!rows || rows.length === 0) return [];
  
  // Use a Map to keep track of jobs by job_number (last wins)
  const jobMap = new Map();
  
  rows.forEach(row => {
    const jobNum = String(row.job_number || "").trim();
    if (jobNum) {
      jobMap.set(jobNum, row);
    }
  });
  
  // Return deduplicated rows as array
  return Array.from(jobMap.values());
}

/**
 * Upsert service jobs to database using server-side RPC
 * Uses service_jobs_bulk_upsert RPC for atomic merge with COALESCE semantics
 * This allows re-uploads to update jobs that have moved dates or changed status
 * 
 * @param {Array} rows - Parsed service job rows (should be deduplicated first)
 * @param {string} userId - Current user's ID (used for validation)
 * @returns {Promise<Object>} - Result with inserted/updated counts
 */
export async function upsertServiceJobs(rows, userId) {
  if (!rows || rows.length === 0) {
    throw new Error("No rows to import");
  }
  
  // Deduplicate rows by job_number (last occurrence wins)
  const deduplicatedRows = dedupeByJobNumber(rows);
  
  if (deduplicatedRows.length === 0) {
    throw new Error("No valid jobs found after deduplication");
  }
  
  // Prepare rows for RPC call - convert to plain objects with all fields
  const jobsToUpsert = deduplicatedRows.map(row => ({
    job_number: String(row.job_number || "").trim(),
    job_description: row.job_description || null,
    status: row.status || "unscheduled",
    raw_status: row.raw_status || null,
    customer_name: row.customer_name || null,
    address: row.address || null,
    location_name: row.location_name || null,
    job_created_at: row.job_created_at || null,
    scheduled_start_at: row.scheduled_start_at || null,
    job_date: row.job_date || null,
    assigned_employees_raw: row.assigned_employees_raw || null,
    primary_tech: row.primary_tech || null,
    job_amount: row.job_amount || null,
    due_amount: row.due_amount || null,
    is_estimate: row.is_estimate || false,
    // Estimate-specific fields
    hcp_estimate_id: row.hcp_estimate_id || null,
    estimate_status: row.estimate_status || null,
    hcp_outcome: row.hcp_outcome || null,
    estimate_tags: row.estimate_tags || null,
    open_value: row.open_value || null,
    won_value: row.won_value || null,
    lost_value: row.lost_value || null,
    raw: row.raw || null,
  }));
  
  // Call RPC function for server-side bulk upsert
  const { data, error } = await supabase.rpc('service_jobs_bulk_upsert', {
    rows: jobsToUpsert
  });
  
  if (error) {
    console.error("Bulk upsert error:", error);
    
    // Provide clearer error messages for common issues
    if (error.code === "42883") {
      throw new Error("RPC function 'service_jobs_bulk_upsert' does not exist. Please run the setup migration.");
    } else if (error.code === "42P01") {
      throw new Error("Table 'service_jobs' does not exist. Please run the setup migration.");
    } else if (error.code === "42501" || error.message?.includes("permission denied")) {
      throw new Error("Permission denied. Please ensure you are authenticated and have the required permissions.");
    } else if (error.message?.includes("JWT") || error.message?.includes("Not authenticated")) {
      throw new Error("Authentication required. Please sign in and try again.");
    }
    
    // Generic error with original message
    throw new Error(error.message || "Failed to save jobs to database");
  }
  
  return {
    success: true,
    inserted: data?.inserted || 0,
    updated: data?.updated || 0,
    total: data?.total || 0,
  };
}

/**
 * Fetch service jobs for current user with optional filters
 * Filters by created_by = auth.uid() and orders by job_date desc
 * 
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} - Service jobs
 */
export async function fetchServiceJobs(options = {}) {
  // Get current user ID
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  
  if (!userId) {
    throw new Error("Not authenticated");
  }
  
  let query = supabase
    .from("service_jobs")
    .select("*")
    .eq("created_by", userId);
  
  // Apply filters
  if (options.startDate) {
    query = query.gte("job_date", options.startDate);
  }
  
  if (options.endDate) {
    query = query.lte("job_date", options.endDate);
  }
  
  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  
  if (options.tech && options.tech !== "all") {
    query = query.eq("primary_tech", options.tech);
  }
  
  // Order by job_date desc, limit to 500
  query = query.order("job_date", { ascending: false, nullsLast: true }).limit(MAX_JOBS_LIMIT);
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Fetch error:", error);
    
    // Provide clearer error messages
    if (error.code === "42P01") {
      throw new Error("Table 'service_jobs' does not exist. Please run the setup migration.");
    } else if (error.message?.includes("JWT")) {
      throw new Error("Authentication required. Please sign in and try again.");
    }
    
    throw new Error(error.message || "Failed to fetch jobs from database");
  }
  
  return data || [];
}

/**
 * Calculate summary statistics for service jobs
 * 
 * @param {Array} jobs - Service jobs to analyze
 * @returns {Object} - Summary stats by status and overall
 */
export function calculateServiceSummary(jobs) {
  const summary = {
    overall: {
      count: jobs.length,
      revenue: 0,
      due: 0,
    },
    byStatus: {
      completed: { count: 0, revenue: 0, due: 0 },
      scheduled: { count: 0, revenue: 0, due: 0 },
      in_progress: { count: 0, revenue: 0, due: 0 },
      unscheduled: { count: 0, revenue: 0, due: 0 },
      canceled: { count: 0, revenue: 0, due: 0 },
    },
  };
  
  jobs.forEach(job => {
    const amount = Number(job.job_amount) || 0;
    const due = Number(job.due_amount) || 0;
    const status = job.status || "unscheduled";
    
    // Overall totals
    summary.overall.revenue += amount;
    summary.overall.due += due;
    
    // By status
    if (!summary.byStatus[status]) {
      summary.byStatus[status] = { count: 0, revenue: 0, due: 0 };
    }
    
    summary.byStatus[status].count += 1;
    summary.byStatus[status].revenue += amount;
    summary.byStatus[status].due += due;
  });
  
  return summary;
}

/**
 * Get unique technicians from jobs
 * 
 * @param {Array} jobs - Service jobs
 * @returns {Array<string>} - Unique tech names sorted alphabetically
 */
export function getUniqueTechs(jobs) {
  const techSet = new Set();
  
  jobs.forEach(job => {
    if (job.primary_tech) {
      techSet.add(job.primary_tech);
    }
  });
  
  return Array.from(techSet).sort();
}

/**
 * Delete a service job
 * 
 * @param {string} id - Job ID
 * @returns {Promise<boolean>}
 */
export async function deleteServiceJob(id) {
  const { error } = await supabase
    .from("service_jobs")
    .delete()
    .eq("id", id);
  
  if (error) {
    console.error("Delete error:", error);
    throw error;
  }
  
  return true;
}

/**
 * Check if service_jobs table exists
 * Returns true if table exists, false otherwise
 * 
 * @returns {Promise<boolean>}
 */
export async function checkServiceJobsTableExists() {
  try {
    // Attempt a simple select with limit 0 to check table existence
    const { error } = await supabase
      .from("service_jobs")
      .select("id")
      .limit(0);
    
    if (error) {
      // Error code 42P01 means "undefined_table"
      if (error.code === "42P01") {
        return false;
      }
      // Other errors might be RLS or auth issues, but table exists
      return true;
    }
    
    return true;
  } catch (e) {
    console.error("Schema check error:", e);
    return false;
  }
}

export default {
  dedupeByJobNumber,
  upsertServiceJobs,
  fetchServiceJobs,
  calculateServiceSummary,
  getUniqueTechs,
  deleteServiceJob,
  checkServiceJobsTableExists,
};
