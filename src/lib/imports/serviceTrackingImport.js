// src/lib/imports/serviceTrackingImport.js
import { recommendDate } from '../../config/schedulingRules';
import { deriveJobTypeFromNumber } from '../jobs/jobType';

/**
 * Upsert jobs from import with scheduler recommendations
 * 
 * Rules:
 * - New jobs get suggested_date based on ZIP + job type
 * - Existing scheduled jobs are never auto-moved
 * - Conflicts are recorded when import date differs from existing schedule
 * - Returns list of jobs needing review/scheduling
 * 
 * @param {Array} rows - Import rows to process
 * @param {Object} helpers - Database helper functions
 * @param {Function} helpers.findJobByExternalId - Find job by external ID
 * @param {Function} helpers.createJob - Create new job
 * @param {Function} helpers.updateJob - Update existing job
 * @param {Function} helpers.findJobById - Find job by ID
 * @returns {Promise<Object>} - { conflicts, newJobsNeedingSchedule }
 */
export async function upsertJobsFromImport(rows, { findJobByExternalId, createJob, updateJob, findJobById }) {
  const conflicts = [];
  const newJobsNeedingSchedule = [];

  for (const row of rows) {
    const externalId = row.id || row.job_number || row.jobNumber;
    const existing = externalId ? await findJobByExternalId(externalId) : null;
    const jobType = deriveJobTypeFromNumber(row.job_number, row.description);
    const zip = (row.zip || row.postal_code || '').toString().trim();

    if (!existing) {
      // New job - create with suggested date (only if auto_schedule is enabled)
      const autoSchedule = row.auto_schedule !== false; // Default to true
      const suggestedDate = autoSchedule ? recommendDate(zip, jobType) : null;
      const job = await createJob({
        external_id: externalId,
        customer_name: row.customer_name || row.customer,
        address: row.address || row.location,
        zip,
        job_type: jobType,
        scheduled_date: null,
        suggested_date: suggestedDate,
        status: 'unscheduled',
        is_estimate: jobType === 'estimate',
        auto_schedule: autoSchedule,
      });

      if (!job.scheduled_date) newJobsNeedingSchedule.push(job);
      continue;
    }

    // Existing job - update fields except scheduling
    const updatedFields = {
      customer_name: row.customer_name || row.customer,
      address: row.address || row.location,
      zip,
      job_type: jobType,
      is_estimate: jobType === 'estimate',
      // other non-scheduling fields...
    };

    // RULE: never auto-move existing scheduled jobs
    if (existing.scheduled_date) {
      // If import contains a different requested date, record a conflict
      if (row.requested_date && row.requested_date !== existing.scheduled_date) {
        conflicts.push({
          jobId: existing.id,
          existingDate: existing.scheduled_date,
          importedDate: row.requested_date,
        });
      }
      await updateJob(existing.id, updatedFields);
    } else {
      // Not yet scheduled → safe to (re)compute suggestion (only if auto_schedule is enabled)
      const autoSchedule = existing.auto_schedule !== false; // Respect existing preference
      const suggestedDate = autoSchedule ? recommendDate(zip, jobType) : null;
      await updateJob(existing.id, { ...updatedFields, suggested_date: suggestedDate });
      newJobsNeedingSchedule.push(await findJobById(existing.id));
    }
  }

  return { conflicts, newJobsNeedingSchedule };
}
