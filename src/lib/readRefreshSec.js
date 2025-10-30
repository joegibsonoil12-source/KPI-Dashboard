/**
 * Read refresh interval from runtime or build environment
 * 
 * Priority order:
 * 1. Runtime window.__ENV.VITE_BILLBOARD_REFRESH_SEC
 * 2. Build-time import.meta.env.VITE_BILLBOARD_REFRESH_SEC
 * 3. Default fallback value
 * 
 * @param {number} defaultSeconds - Default refresh interval in seconds
 * @returns {number} - Refresh interval in seconds
 */
export function readRefreshSec(defaultSeconds = 30) {
  try {
    // Priority 1: Runtime window.__ENV
    if (typeof window !== 'undefined' && window.__ENV?.VITE_BILLBOARD_REFRESH_SEC) {
      const runtimeValue = parseInt(window.__ENV.VITE_BILLBOARD_REFRESH_SEC, 10);
      if (isFinite(runtimeValue) && runtimeValue > 0) {
        return runtimeValue;
      }
    }

    // Priority 2: Build-time import.meta.env (Vite)
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BILLBOARD_REFRESH_SEC) {
      const buildValue = parseInt(import.meta.env.VITE_BILLBOARD_REFRESH_SEC, 10);
      if (isFinite(buildValue) && buildValue > 0) {
        return buildValue;
      }
    }

    // Priority 3: process.env fallback (other bundlers/SSR contexts)
    // Note: In browser contexts, process is typically undefined. This is only
    // for server-side rendering or other build environments that expose process.env
    if (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env?.VITE_BILLBOARD_REFRESH_SEC) {
      const processValue = parseInt(process.env.VITE_BILLBOARD_REFRESH_SEC, 10);
      if (isFinite(processValue) && processValue > 0) {
        return processValue;
      }
    }
  } catch (err) {
    console.warn('[readRefreshSec] Error reading refresh interval, using default:', err);
  }

  // Fallback to default
  return defaultSeconds;
}

/**
 * Convert seconds to milliseconds for use with setInterval
 * @param {number} seconds - Seconds
 * @returns {number} - Milliseconds
 */
export function secondsToMs(seconds) {
  return seconds * 1000;
}

export default { readRefreshSec, secondsToMs };
