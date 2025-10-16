/**
 * Service Tracking helpers for Supabase operations
 * Handles upsert logic for service jobs with deduplication on (created_by, job_number)
 */

import { supabase } from "./supabaseClient";

/**
 * Upsert service jobs to database
 * Uses onConflict to update existing records when (created_by, job_number) matches
 * This allows re-uploads to update jobs that have moved dates or changed status
 * 
 * @param {Array} rows - Parsed service job rows
 * @param {string} userId - Current user's ID
 * @returns {Promise<Object>} - Result with inserted/updated data
 */
export async function upsertServiceJobs(rows, userId) {
  if (!rows || rows.length === 0) {
    throw new Error("No rows to import");
  }
  
  // Prepare rows for upsert - add created_by and ensure job_number exists
  const jobsToUpsert = rows.map(row => ({
    created_by: userId,
    job_number: String(row.job_number || "").trim(),
    job_description: row.job_description || null,
    status: row.status || "unscheduled",
    raw_status: row.raw_status || null,
    customer_name: row.customer_name || null,
    address: row.address || null,
    job_created_at: row.job_created_at || null,
    scheduled_start_at: row.scheduled_start_at || null,
    job_date: row.job_date || null,
    assigned_employees_raw: row.assigned_employees_raw || null,
    primary_tech: row.primary_tech || null,
    job_amount: row.job_amount || null,
    due_amount: row.due_amount || null,
    raw: row.raw || null,
  }));
  
  // Filter out rows without job_number
  const validJobs = jobsToUpsert.filter(job => job.job_number);
  
  if (validJobs.length === 0) {
    throw new Error("No valid jobs found (missing job numbers)");
  }
  
  // Upsert with onConflict on the unique constraint
  const { data, error } = await supabase
    .from("service_jobs")
    .upsert(validJobs, {
      onConflict: "created_by,job_number",
      ignoreDuplicates: false, // Update on conflict
    })
    .select();
  
  if (error) {
    console.error("Upsert error:", error);
    
    // Provide clearer error messages for common issues
    if (error.code === "42P01") {
      throw new Error("Table 'service_jobs' does not exist. Please run the setup migration.");
    } else if (error.code === "42501" || error.message?.includes("permission denied")) {
      throw new Error("Permission denied. Please ensure you are authenticated and have the required permissions.");
    } else if (error.code === "23505") {
      throw new Error("Duplicate key violation. This should not happen with upsert.");
    } else if (error.message?.includes("JWT")) {
      throw new Error("Authentication required. Please sign in and try again.");
    }
    
    // Generic error with original message
    throw new Error(error.message || "Failed to save jobs to database");
  }
  
  return {
    success: true,
    inserted: data?.length || 0,
    data: data || [],
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
  query = query.order("job_date", { ascending: false, nullsLast: true }).limit(500);
  
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
  upsertServiceJobs,
  fetchServiceJobs,
  calculateServiceSummary,
  getUniqueTechs,
  deleteServiceJob,
  checkServiceJobsTableExists,
};
