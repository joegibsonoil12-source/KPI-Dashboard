/**
 * TimeRangePicker Component
 * 
 * Date range picker for selecting time periods and comparison modes
 * Features:
 * - Start and end date inputs
 * - Compare mode selector (none, previous period, custom)
 * - Custom comparison date range (when compare mode = custom)
 */

import React from 'react';

export default function TimeRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  compareMode,
  onCompareModeChange,
  compareStart,
  compareEnd,
  onCompareStartChange,
  onCompareEndChange,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Time Range</h3>
      
      {/* Primary date range */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Compare mode selector */}
      <div className="mb-3">
        <label className="block text-xs text-slate-600 mb-1">Compare To</label>
        <select
          value={compareMode}
          onChange={(e) => onCompareModeChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="none">No Comparison</option>
          <option value="previous">Previous Period</option>
          <option value="custom">Custom Period</option>
        </select>
      </div>

      {/* Custom comparison date range (shown only when compare mode = custom) */}
      {compareMode === 'custom' && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Compare Start</label>
            <input
              type="date"
              value={compareStart}
              onChange={(e) => onCompareStartChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Compare End</label>
            <input
              type="date"
              value={compareEnd}
              onChange={(e) => onCompareEndChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
