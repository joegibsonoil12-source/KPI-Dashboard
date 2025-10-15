import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useAutosave - A generic autosave hook with debounce, localStorage draft persistence, and manual save/discard.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.storageKey - localStorage key for persisting drafts
 * @param {number} options.delayMs - Debounce delay in milliseconds (default: 2000)
 * @param {Function} options.serializeDraft - Function to serialize draft data to string
 * @param {Function} options.deserializeDraft - Function to deserialize draft data from string
 * @param {Function} options.onFlush - Async function to flush pending changes to server
 * 
 * @returns {Object} - Autosave state and methods
 *   - {boolean} hasUnsavedChanges - Whether there are pending changes
 *   - {boolean} isSaving - Whether a save is in progress
 *   - {string|null} lastSavedAt - Timestamp of last successful save (ISO string)
 *   - {string|null} error - Last save error message
 *   - {Function} queueChanges - Queue changes for autosave (data: any)
 *   - {Function} saveNow - Manually trigger immediate save
 *   - {Function} discard - Discard all pending changes and clear draft
 *   - {Function} loadDraft - Load persisted draft from localStorage
 */
export function useAutosave({
  storageKey,
  delayMs = 2000,
  serializeDraft,
  deserializeDraft,
  onFlush,
}) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);

  // Internal state for pending changes and timers
  const pendingChangesRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isFlushingRef = useRef(false);

  // Save draft to localStorage
  const persistDraft = useCallback((data) => {
    try {
      const serialized = serializeDraft(data);
      localStorage.setItem(storageKey, serialized);
    } catch (e) {
      console.error("Failed to persist draft:", e);
    }
  }, [storageKey, serializeDraft]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error("Failed to clear draft:", e);
    }
  }, [storageKey]);

  // Load draft from localStorage
  const loadDraft = useCallback(() => {
    try {
      const serialized = localStorage.getItem(storageKey);
      if (serialized) {
        return deserializeDraft(serialized);
      }
    } catch (e) {
      console.error("Failed to load draft:", e);
    }
    return null;
  }, [storageKey, deserializeDraft]);

  // Flush pending changes to server
  const flush = useCallback(async () => {
    if (isFlushingRef.current || !pendingChangesRef.current) {
      return;
    }

    isFlushingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await onFlush(pendingChangesRef.current);
      
      // Success - clear pending changes and draft
      pendingChangesRef.current = null;
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date().toISOString());
      clearDraft();
    } catch (e) {
      console.error("Autosave flush failed:", e);
      const errorMsg = e.message || e.error_description || String(e);
      setError(errorMsg);
      // Keep pending changes and draft on error
    } finally {
      setIsSaving(false);
      isFlushingRef.current = false;
    }
  }, [onFlush, clearDraft]);

  // Queue changes for autosave
  const queueChanges = useCallback((data) => {
    pendingChangesRef.current = data;
    setHasUnsavedChanges(true);
    setError(null);
    
    // Persist draft immediately
    persistDraft(data);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer for flush
    debounceTimerRef.current = setTimeout(() => {
      flush();
    }, delayMs);
  }, [delayMs, persistDraft, flush]);

  // Manual save - flush immediately
  const saveNow = useCallback(async () => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await flush();
  }, [flush]);

  // Discard pending changes
  const discard = useCallback(() => {
    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // Clear state
    pendingChangesRef.current = null;
    setHasUnsavedChanges(false);
    setError(null);
    clearDraft();
  }, [clearDraft]);

  // Warn on page unload if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    hasUnsavedChanges,
    isSaving,
    lastSavedAt,
    error,
    queueChanges,
    saveNow,
    discard,
    loadDraft,
  };
}
