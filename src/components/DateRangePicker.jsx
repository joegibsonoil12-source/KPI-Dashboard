// src/components/DateRangePicker.jsx
import { RANGE_TYPES } from "../lib/dateRanges";

export default function DateRangePicker({
  rangeType,
  setRangeType,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  compare,
  setCompare,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className="border rounded px-2 py-1"
        value={rangeType}
        onChange={(e) => setRangeType(e.target.value)}
      >
        <option value={RANGE_TYPES.DAY}>Day</option>
        <option value={RANGE_TYPES.WEEK}>Week</option>
        <option value={RANGE_TYPES.MONTH}>Month</option>
        <option value={RANGE_TYPES.YEAR}>Year</option>
        <option value={RANGE_TYPES.CUSTOM}>Custom</option>
      </select>

      {rangeType === RANGE_TYPES.CUSTOM && (
        <>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={customStart ?? ""}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={customEnd ?? ""}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </>
      )}

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={compare}
          onChange={(e) => setCompare(e.target.checked)}
        />
        Compare to previous
      </label>
    </div>
  );
}
