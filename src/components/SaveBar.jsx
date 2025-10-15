import React from "react";

/**
 * SaveBar - UI component for manual Save/Discard with status indicator
 * 
 * Displays a floating bar when there are unsaved changes with:
 * - Save button to flush changes immediately
 * - Discard button to revert to server state
 * - Status indicator showing save state (Saving.../Saved at HH:MM:SS/Error)
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Whether to show the save bar
 * @param {boolean} props.isSaving - Whether a save is in progress
 * @param {string|null} props.lastSavedAt - ISO timestamp of last save
 * @param {string|null} props.error - Error message to display
 * @param {Function} props.onSave - Callback when Save button is clicked
 * @param {Function} props.onDiscard - Callback when Discard button is clicked
 */
export default function SaveBar({
  visible,
  isSaving,
  lastSavedAt,
  error,
  onSave,
  onDiscard,
}) {
  if (!visible) return null;

  // Format timestamp for display
  const formatTime = (isoString) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out">
      <div className="bg-white rounded-lg shadow-lg border-2 border-slate-300 px-6 py-3 flex items-center gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-2 min-w-[150px]">
          {isSaving ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-sm text-slate-600">Saving...</span>
            </>
          ) : error ? (
            <>
              <span className="text-red-600">⚠️</span>
              <span className="text-sm text-red-600" title={error}>
                Save failed
              </span>
            </>
          ) : lastSavedAt ? (
            <>
              <span className="text-green-600">✓</span>
              <span className="text-sm text-slate-600">
                Saved at {formatTime(lastSavedAt)}
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-600">Unsaved changes</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
