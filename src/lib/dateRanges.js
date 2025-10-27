// src/lib/dateRanges.js
export const RANGE_TYPES = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
  CUSTOM: "custom",
};

const toStartOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const toEndOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function getRange(rangeType, customStart, customEnd) {
  const now = new Date();
  switch (rangeType) {
    case RANGE_TYPES.DAY: {
      const start = toStartOfDay(now);
      const end = toEndOfDay(now);
      return { start, end };
    }
    case RANGE_TYPES.WEEK: {
      // ISO week: Monday start
      const day = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day);
      const start = toStartOfDay(monday);
      const end = toEndOfDay(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
      );
      return { start, end };
    }
    case RANGE_TYPES.MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = toEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { start, end };
    }
    case RANGE_TYPES.YEAR: {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = toEndOfDay(new Date(now.getFullYear(), 12, 0));
      return { start, end };
    }
    case RANGE_TYPES.CUSTOM: {
      if (!customStart || !customEnd) return { start: null, end: null };
      const start = toStartOfDay(new Date(customStart));
      const end = toEndOfDay(new Date(customEnd));
      return { start, end };
    }
    default:
      return { start: null, end: null };
  }
}

export function getPreviousRange({ start, end }) {
  if (!start || !end) return { start: null, end: null };
  const durationMs = end - start + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - (durationMs - 1));
  return { start: prevStart, end: prevEnd };
}

export function toISODateTime(d) {
  return d.toISOString();
}

export function formatDateLabel(d) {
  return d.toISOString().slice(0, 10);
}
