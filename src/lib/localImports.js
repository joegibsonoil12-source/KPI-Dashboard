/**
 * Local Imports Storage Helper
 * 
 * Provides localStorage-based fallback for ticket imports when Supabase uploads fail.
 * Used as a last resort when both client and server uploads are unavailable.
 */

const LOCAL_IMPORTS_KEY = 'kpi_local_imports';

/**
 * Save a local import to localStorage
 * @param {Object} importData - Import data including files
 * @param {string} importData.src - Source of import (e.g., 'upload')
 * @param {Array} importData.attached_files - Array of file objects with base64 data
 * @param {Object} importData.meta - Metadata about the import
 * @returns {string} Generated import ID
 */
export function saveLocalImport(importData) {
  try {
    // Get existing imports
    const imports = getLocalImports();
    
    // Generate unique ID
    const importId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Add timestamp and ID
    const importRecord = {
      id: importId,
      ...importData,
      status: 'local_pending',
      created_at: new Date().toISOString(),
      uploaded_locally: true,
    };
    
    // Save to localStorage
    imports.push(importRecord);
    localStorage.setItem(LOCAL_IMPORTS_KEY, JSON.stringify(imports));
    
    console.debug('[localImports] Saved local import:', importId);
    return importId;
  } catch (error) {
    console.error('[localImports] Failed to save local import:', error);
    throw new Error(`Failed to save import locally: ${error.message}`);
  }
}

/**
 * Get all local imports from localStorage
 * @returns {Array} Array of import records
 */
export function getLocalImports() {
  try {
    const data = localStorage.getItem(LOCAL_IMPORTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[localImports] Failed to read local imports:', error);
    return [];
  }
}

/**
 * Get a single local import by ID
 * @param {string} importId - Import ID
 * @returns {Object|null} Import record or null if not found
 */
export function getLocalImport(importId) {
  const imports = getLocalImports();
  return imports.find(imp => imp.id === importId) || null;
}

/**
 * Delete a local import
 * @param {string} importId - Import ID to delete
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteLocalImport(importId) {
  try {
    const imports = getLocalImports();
    const filtered = imports.filter(imp => imp.id !== importId);
    
    if (filtered.length === imports.length) {
      return false; // Not found
    }
    
    localStorage.setItem(LOCAL_IMPORTS_KEY, JSON.stringify(filtered));
    console.debug('[localImports] Deleted local import:', importId);
    return true;
  } catch (error) {
    console.error('[localImports] Failed to delete local import:', error);
    return false;
  }
}

/**
 * Clear all local imports
 * @returns {number} Number of imports cleared
 */
export function clearAllLocalImports() {
  try {
    const imports = getLocalImports();
    const count = imports.length;
    localStorage.removeItem(LOCAL_IMPORTS_KEY);
    console.debug('[localImports] Cleared all local imports:', count);
    return count;
  } catch (error) {
    console.error('[localImports] Failed to clear local imports:', error);
    return 0;
  }
}

/**
 * Check if localStorage is available and has space
 * @returns {boolean} True if localStorage is usable
 */
export function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get estimated storage usage for local imports
 * @returns {Object} Storage info { used: number, total: number, percentage: number }
 */
export function getStorageInfo() {
  try {
    const data = localStorage.getItem(LOCAL_IMPORTS_KEY) || '[]';
    const used = new Blob([data]).size;
    
    // Most browsers have ~5-10MB localStorage limit
    // We'll estimate 5MB as conservative limit
    const total = 5 * 1024 * 1024; // 5MB in bytes
    const percentage = Math.round((used / total) * 100);
    
    return {
      used,
      total,
      percentage,
      usedMB: (used / (1024 * 1024)).toFixed(2),
      totalMB: (total / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error('[localImports] Failed to get storage info:', error);
    return { used: 0, total: 0, percentage: 0, usedMB: '0', totalMB: '5' };
  }
}
