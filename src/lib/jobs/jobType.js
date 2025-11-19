// src/lib/jobs/jobType.js

/**
 * Helper functions for detecting and classifying job types
 */

/**
 * Derive job type from job number and description
 * @param {string} jobNumber - Job number (e.g., "EST-205", "JOB-123")
 * @param {string} description - Job description text
 * @returns {string} - 'estimate', 'install', or 'service'
 */
export function deriveJobTypeFromNumber(jobNumber, description = '') {
  const num = String(jobNumber || '').toUpperCase();
  const desc = String(description || '').toLowerCase();

  if (num.startsWith('EST-') || desc.includes('estimate')) {
    return 'estimate';
  }

  // You can add more refined logic here to distinguish install vs service
  // For now, default to 'service' for non-estimate jobs
  if (desc.includes('install') || desc.includes('installation')) {
    return 'install';
  }

  return 'service';
}

/**
 * Check if a job is an estimate
 * @param {Object} job - Job object
 * @returns {boolean}
 */
export function isEstimate(job) {
  if (!job) return false;
  
  // Check is_estimate flag if present
  if (job.is_estimate === true) return true;
  
  // Check jobType field
  if (job.jobType === 'estimate' || job.job_type === 'estimate') return true;
  
  // Check job_number pattern
  const jobNum = String(job.job_number || job.jobNumber || '').toUpperCase();
  if (jobNum.startsWith('EST-')) return true;
  
  // Check description
  const desc = String(job.job_description || job.description || '').toLowerCase();
  if (desc.includes('estimate')) return true;
  
  return false;
}
