// src/config/schedulingRules.js

/**
 * Scheduling rules for auto-recommended days.
 *
 * Each rule says:
 *  - For these ZIPs
 *  - And these job types (install/service)
 *  - Suggest this weekday, optional default time/tech
 */

export const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const SCHEDULING_RULES = [
  // EXAMPLES — replace with your real routes
  {
    id: 'route-fayetteville-service',
    name: 'Fayetteville Service Route',
    zips: ['28301','28302','28303'],
    jobTypes: ['service'],
    dayOfWeek: 1, // Monday
    defaultStartTime: '08:00',
  },
  {
    id: 'route-fayetteville-installs',
    name: 'Fayetteville Installs',
    zips: ['28301','28302'],
    jobTypes: ['install'],
    dayOfWeek: 3, // Wednesday
    defaultStartTime: '09:00',
  },
  // Add the rest of your routes here
];

function findRule(zip, jobType) {
  if (!zip || !jobType) return null;
  const normalizedZip = String(zip).trim();
  return SCHEDULING_RULES.find(rule =>
    rule.jobTypes.includes(jobType) &&
    rule.zips.includes(normalizedZip)
  ) || null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(targetDow) {
  const today = startOfToday();
  const todayDow = today.getDay();
  let delta = (targetDow - todayDow + 7) % 7;
  if (delta === 0) delta = 7; // always push to next week, never "today"
  return addDays(today, delta);
}

/**
 * Recommend the next future date based on ZIP and job type.
 * Returns an ISO date string (YYYY-MM-DD) or null.
 */
export function recommendDate(zip, jobType) {
  const rule = findRule(zip, jobType);
  if (!rule) return null;

  const candidate = nextWeekday(rule.dayOfWeek);
  return candidate.toISOString().slice(0, 10);
}

/**
 * Optionally recommend a default time (HH:mm) if configured.
 */
export function recommendTime(zip, jobType) {
  const rule = findRule(zip, jobType);
  return rule?.defaultStartTime || null;
}
