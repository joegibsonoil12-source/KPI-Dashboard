import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { parseServiceReport } from "../lib/parseServiceReport";
import {
  upsertServiceJobs,
  fetchServiceJobs,
  calculateServiceSummary,
  getUniqueTechs,
  deleteServiceJob,
  checkServiceJobsTableExists,
} from "../lib/serviceHelpers";
import ServiceUploadButton from "./Imports/ServiceUploadButton";

/**
 * Get status badge color
 */
function getStatusColor(status) {
  const colors = {
    completed: { bg: "#dcfce7", border: "#bbf7d0", text: "#166534" },
    scheduled: { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af" },
    in_progress: { bg: "#fed7aa", border: "#fdba74", text: "#9a3412" },
    unscheduled: { bg: "#f3f4f6", border: "#e5e7eb", text: "#374151" },
    canceled: { bg: "#fee2e2", border: "#fecaca", text: "#991b1b" },
  };
  
  return colors[status] || colors.unscheduled;
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const color = getStatusColor(status);
  
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/**
 * Service Tracking component
 */
export default function ServiceTracking() {
  const [jobs, setJobs] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [schemaError, setSchemaError] = useState(false);
  const [schemaBannerDismissed, setSchemaBannerDismissed] = useState(false);
  
  // Debug: Show user ID (only in development or when needed for support)
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // Date filters (similar to Delivery Tickets)
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedTech, setSelectedTech] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // all | jobs | estimates
  
  const fileInputRef = useRef(null);
  
  // Get current user ID
  async function getCurrentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  }
  
  // Load saved jobs from Supabase
  async function loadSaved() {
    const data = await fetchServiceJobs();
    setJobs(data);
    return data;
  }
  
  // Handle reload: fetch jobs and summary
  async function handleReload() {
    setIsReloading(true);
    setError("");
    setSuccessMessage("");
    
    try {
      // Load saved jobs (summary is recomputed automatically via useMemo)
      await loadSaved();
      
      setSuccessMessage("Data reloaded successfully");
      
      // Auto-dismiss success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (e) {
      console.error("Reload error:", e);
      setError(`Failed to reload: ${e.message}`);
    } finally {
      setIsReloading(false);
    }
  }
  
  // Check schema and load jobs on mount
  useEffect(() => {
    async function initialize() {
      // Get current user
      const userId = await getCurrentUserId();
      setCurrentUserId(userId);
      
      // Check if table exists
      const tableExists = await checkServiceJobsTableExists();
      if (!tableExists) {
        setSchemaError(true);
      }
      
      // Load jobs even if table doesn't exist (will show error if needed)
      await handleReload();
    }
    
    initialize();
  }, []);
  
  // Handle file upload
  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setError("");
    setSuccessMessage("");
    
    try {
      const result = await parseServiceReport(file);
      setPreviewData(result);
    } catch (e) {
      console.error("Parse error:", e);
      setError(`Failed to parse file: ${e.message}`);
    } finally {
      setIsUploading(false);
      e.target.value = ""; // Reset input
    }
  }
  
  // Import preview data to database
  async function handleImport() {
    if (!previewData) return;
    
    setIsImporting(true);
    setError("");
    setSuccessMessage("");
    
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        throw new Error("Not authenticated");
      }
      
      // Upsert jobs (deduplication happens inside helper)
      const result = await upsertServiceJobs(previewData.rows, userId);
      
      // Show detailed success message
      const messages = [];
      if (result.inserted > 0) {
        messages.push(`${result.inserted} new job(s)`);
      }
      if (result.updated > 0) {
        messages.push(`${result.updated} updated`);
      }
      
      setSuccessMessage(
        `Successfully imported: ${messages.join(', ')}. Total: ${result.total} job(s).`
      );
      
      // Clear preview and reload
      setPreviewData(null);
      await handleReload();
    } catch (e) {
      console.error("Import error:", e);
      setError(`Failed to import: ${e.message}`);
    } finally {
      setIsImporting(false);
    }
  }
  
  // Cancel preview
  function handleCancelPreview() {
    setPreviewData(null);
    setError("");
  }
  
  // Delete a job
  async function handleDelete(id) {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    
    try {
      await deleteServiceJob(id);
      setJobs(jobs.filter(j => j.id !== id));
      setSuccessMessage("Job deleted successfully");
    } catch (e) {
      console.error("Delete error:", e);
      setError(`Failed to delete: ${e.message}`);
    }
  }
  
  // Filtering logic
  const filteredByDate = useMemo(() => {
    if (dateFilter === "all") return jobs;
    
    const now = new Date();
    let startDate, endDate;
    
    if (dateFilter === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (dateFilter === "week") {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - dayOfWeek));
    } else if (dateFilter === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (dateFilter === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear() + 1, 0, 1);
    } else if (dateFilter === "custom") {
      if (!customStartDate && !customEndDate) return jobs;
      startDate = customStartDate ? new Date(customStartDate) : new Date(0);
      endDate = customEndDate ? new Date(new Date(customEndDate).getTime() + 86400000) : new Date(8640000000000000);
    }
    
    return jobs.filter(j => {
      if (!j.job_date) return false;
      const jobDate = new Date(j.job_date);
      return jobDate >= startDate && jobDate < endDate;
    });
  }, [jobs, dateFilter, customStartDate, customEndDate]);
  
  // Filter by tech
  const filteredByTech = useMemo(() => {
    if (selectedTech === "ALL") return filteredByDate;
    return filteredByDate.filter(j => j.primary_tech === selectedTech);
  }, [filteredByDate, selectedTech]);
  
  // Filter by status
  const filteredByStatus = useMemo(() => {
    if (selectedStatus === "all") return filteredByTech;
    return filteredByTech.filter(j => j.status === selectedStatus);
  }, [filteredByTech, selectedStatus]);
  
  // Filter by type (job/estimate)
  const filteredJobs = useMemo(() => {
    if (typeFilter === "jobs") return filteredByStatus.filter(j => !j.is_estimate);
    if (typeFilter === "estimates") return filteredByStatus.filter(j => j.is_estimate);
    return filteredByStatus;
  }, [filteredByStatus, typeFilter]);
  
  // Get unique techs
  const availableTechs = useMemo(() => getUniqueTechs(filteredByDate), [filteredByDate]);
  
  // Calculate summary
  const summary = useMemo(() => calculateServiceSummary(filteredJobs), [filteredJobs]);
  const previewSummary = useMemo(() => 
    previewData ? calculateServiceSummary(previewData.rows) : null,
    [previewData]
  );
  
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Service Tracking</h2>
          {showDebugInfo && currentUserId && (
            <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono" title="Current User ID">
              {currentUserId.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50"
            onClick={handleReload}
            disabled={isReloading}
            title="Reload saved jobs from database"
          >
            {isReloading ? "⏳ Reloading..." : "🔄 Reload"}
          </button>
          <button
            className="rounded-lg border px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? "Processing..." : "Upload Report"}
          </button>
          <ServiceUploadButton />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileSelect}
        />
      </header>
      
      {/* Schema Error Banner */}
      {schemaError && !schemaBannerDismissed && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <strong className="text-yellow-800">⚠️ Setup Required:</strong>
              <p className="text-yellow-700 mt-1">
                The <code className="bg-yellow-100 px-1 rounded">service_jobs</code> table is missing. 
                Preview and import will work, but data cannot be saved until you run the setup migration.
              </p>
              <p className="text-yellow-700 mt-2 text-sm">
                👉 Run the SQL file: 
                <code className="bg-yellow-100 px-1 rounded ml-1">
                  sql/2025-10-16_service_tracking.sql
                </code>
                {" "}in your Supabase SQL editor.
              </p>
            </div>
            <button
              className="text-yellow-800 hover:text-yellow-900 ml-4"
              onClick={() => setSchemaBannerDismissed(true)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      {/* Error/Success Messages */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {successMessage && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
          <strong>Success:</strong> {successMessage}
        </div>
      )}
      
      {/* Preview Panel */}
      {previewData && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Preview Import</h3>
          
          {/* Preview Summary */}
          <div className="mb-4 rounded-lg border bg-slate-50 p-4">
            <h4 className="font-semibold mb-3">Summary by Status</h4>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(previewSummary.byStatus).map(([status, stats]) => (
                <div key={status} className="rounded-lg border bg-white p-3">
                  <div className="mb-2">
                    <StatusBadge status={status} />
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-slate-600">Count</div>
                    <div className="font-semibold">{stats.count}</div>
                  </div>
                  <div className="text-sm mt-1">
                    <div className="text-xs text-slate-600">Revenue</div>
                    <div className="font-semibold">${stats.revenue.toFixed(2)}</div>
                  </div>
                  <div className="text-sm mt-1">
                    <div className="text-xs text-slate-600">Due</div>
                    <div className="font-semibold">${stats.due.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="font-semibold">
                Total: {previewSummary.overall.count} jobs • 
                Revenue: ${previewSummary.overall.revenue.toFixed(2)} • 
                Due: ${previewSummary.overall.due.toFixed(2)}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                Completed Revenue: ${(previewSummary.byStatus.completed?.revenue || 0).toFixed(2)} • 
                Pipeline: ${((previewSummary.overall.revenue || 0) - (previewSummary.byStatus.completed?.revenue || 0)).toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* Sample rows */}
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Preview Rows (first 100)</h4>
            <div className="overflow-x-auto rounded-lg border max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-xs">Job #</th>
                    <th className="px-3 py-2 text-xs">Customer</th>
                    <th className="px-3 py-2 text-xs">Type</th>
                    <th className="px-3 py-2 text-xs">Status</th>
                    <th className="px-3 py-2 text-xs">Date</th>
                    <th className="px-3 py-2 text-xs">Tech</th>
                    <th className="px-3 py-2 text-xs">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{row.job_number}</td>
                      <td className="px-3 py-2">{row.customer_name}</td>
                      <td className="px-3 py-2">
                        {row.is_estimate ? (
                          <span className="inline-flex items-center rounded-full border border-purple-400 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                            EST
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            JOB
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2">{row.job_date || "-"}</td>
                      <td className="px-3 py-2">{row.primary_tech || "-"}</td>
                      <td className="px-3 py-2">
                        ${(row.job_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {previewData.rows.length > 100 && (
              <div className="text-sm text-slate-600 mt-2">
                Showing 100 of {previewData.rows.length} rows
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? "Importing..." : "Import to Database"}
            </button>
            <button
              className="rounded-lg border px-4 py-2 hover:bg-slate-50"
              onClick={handleCancelPreview}
              disabled={isImporting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Filters */}
      {!previewData && (
        <>
          <div className="rounded-lg border p-4 bg-slate-50">
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-semibold">Filters:</label>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "all" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("all")}
              >
                All
              </button>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "today" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("today")}
              >
                Today
              </button>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "week" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("week")}
              >
                This Week
              </button>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "month" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("month")}
              >
                This Month
              </button>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "year" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("year")}
              >
                This Year
              </button>
              <button 
                className={`px-3 py-1 rounded ${dateFilter === "custom" ? "bg-blue-600 text-white" : "bg-white border"}`}
                onClick={() => setDateFilter("custom")}
              >
                Custom Range
              </button>
              {dateFilter === "custom" && (
                <>
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                    placeholder="Start"
                  />
                  <span>to</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                    placeholder="End"
                  />
                </>
              )}
            </div>
          </div>
          
          {/* Tech and Status Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-semibold">Tech:</label>
              <select 
                value={selectedTech} 
                onChange={e => setSelectedTech(e.target.value)}
                className="px-3 py-1.5 border rounded"
              >
                <option value="ALL">All Techs</option>
                {availableTechs.map(tech => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="font-semibold">Status:</label>
              <select 
                value={selectedStatus} 
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 border rounded"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="unscheduled">Unscheduled</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="font-semibold">Type:</label>
              <div className="inline-flex gap-2 text-xs">
                <button 
                  onClick={() => setTypeFilter("all")}
                  className={`px-3 py-1.5 rounded ${typeFilter === "all" ? "bg-blue-600 text-white" : "bg-white border"}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setTypeFilter("jobs")}
                  className={`px-3 py-1.5 rounded ${typeFilter === "jobs" ? "bg-blue-600 text-white" : "bg-white border"}`}
                >
                  Jobs
                </button>
                <button 
                  onClick={() => setTypeFilter("estimates")}
                  className={`px-3 py-1.5 rounded ${typeFilter === "estimates" ? "bg-blue-600 text-white" : "bg-white border"}`}
                >
                  Estimates
                </button>
              </div>
            </div>
            
            <span className="text-sm text-slate-600">
              Showing {filteredJobs.length} of {jobs.length} jobs
            </span>
          </div>
          
          {/* Summary */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Object.entries(summary.byStatus).map(([status, stats]) => (
                <div key={status} className="rounded-lg border bg-slate-50 p-3">
                  <div className="mb-2">
                    <StatusBadge status={status} />
                  </div>
                  <div className="text-sm">
                    <div className="text-xs text-slate-600">Count</div>
                    <div className="font-semibold">{stats.count}</div>
                  </div>
                  <div className="text-sm mt-1">
                    <div className="text-xs text-slate-600">Revenue</div>
                    <div className="font-semibold">${stats.revenue.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <div className="font-semibold">
                Total: {summary.overall.count} jobs • 
                Completed Revenue: ${(summary.byStatus.completed?.revenue || 0).toFixed(2)} • 
                Pipeline: ${((summary.overall.revenue || 0) - (summary.byStatus.completed?.revenue || 0)).toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* Jobs Table */}
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2 text-xs">Job #</th>
                  <th className="px-3 py-2 text-xs">Customer</th>
                  <th className="px-3 py-2 text-xs">Type</th>
                  <th className="px-3 py-2 text-xs">Status</th>
                  <th className="px-3 py-2 text-xs">Date</th>
                  <th className="px-3 py-2 text-xs">Tech</th>
                  <th className="px-3 py-2 text-xs">Defers</th>
                  <th className="px-3 py-2 text-xs">Description</th>
                  <th className="px-3 py-2 text-xs">Amount</th>
                  <th className="px-3 py-2 text-xs">Due</th>
                  <th className="px-3 py-2 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map(job => (
                  <tr key={job.id} className="border-t">
                    <td className="px-3 py-2">{job.job_number}</td>
                    <td className="px-3 py-2">{job.customer_name}</td>
                    <td className="px-3 py-2">
                      {job.is_estimate ? (
                        <span className="inline-flex items-center rounded-full border border-purple-400 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                          ESTIMATE
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          JOB
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-2">{job.job_date || "-"}</td>
                    <td className="px-3 py-2">{job.primary_tech || "-"}</td>
                    <td className="px-3 py-2 tabular-nums">{job.reschedule_count || 0}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{job.job_description || "-"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      ${(job.job_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      ${(job.due_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="text-red-600 text-xs hover:text-red-800"
                        onClick={() => handleDelete(job.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                      No jobs found. Upload a Housecall Pro report to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
