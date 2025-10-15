/**
 * Datetime utility functions for handling UTC↔local conversions
 * for datetime-local inputs to avoid timezone shifts.
 * 
 * Problem: datetime-local inputs work with local time strings (YYYY-MM-DDTHH:mm),
 * but our DB stores UTC timestamps. Converting directly causes apparent shifts.
 * 
 * Solution: These helpers ensure the local time the user sees is what gets stored
 * (adjusted to UTC) and what displays (converted from UTC to local).
 */

/**
 * Converts a UTC timestamp string from the database to a local datetime string
 * suitable for datetime-local input value.
 * 
 * @param {string|null} utcString - ISO 8601 UTC timestamp from DB (e.g., "2025-10-15T14:30:00Z")
 * @returns {string} - Local datetime string in format "YYYY-MM-DDTHH:mm" or empty string if null
 * 
 * Example:
 *   DB has: "2025-10-15T14:30:00Z" (UTC)
 *   User in EST (-5): sees "2025-10-15T09:30" in their datetime-local input
 */
export function toLocalDateTimeInputValue(utcString) {
  if (!utcString) return "";
  
  const date = new Date(utcString);
  if (isNaN(date.getTime())) return "";
  
  // Get local year, month, day, hour, minute
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a local datetime string from datetime-local input to a UTC ISO string
 * for storing in the database.
 * 
 * @param {string} localValue - Local datetime string from input (e.g., "2025-10-15T09:30")
 * @returns {string|null} - ISO 8601 UTC timestamp for DB or null if empty
 * 
 * Example:
 *   User in EST (-5) enters: "2025-10-15T09:30"
 *   DB stores: "2025-10-15T14:30:00.000Z" (UTC)
 */
export function fromLocalDateTimeInputValue(localValue) {
  if (!localValue) return null;
  
  // Create a Date from the local datetime string
  // The browser interprets this as local time
  const date = new Date(localValue);
  
  if (isNaN(date.getTime())) return null;
  
  // Convert to ISO string (UTC)
  return date.toISOString();
}
