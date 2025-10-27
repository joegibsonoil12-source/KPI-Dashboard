// src/hooks/useDateRange.js
import { useMemo, useState } from "react";
import { RANGE_TYPES, getRange, getPreviousRange } from "../lib/dateRanges";

export default function useDateRange(initial = RANGE_TYPES.WEEK) {
  const [rangeType, setRangeType] = useState(initial);
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [compare, setCompare] = useState(true);

  const current = useMemo(
    () => getRange(rangeType, customStart, customEnd),
    [rangeType, customStart, customEnd]
  );

  const previous = useMemo(
    () => (compare ? getPreviousRange(current) : { start: null, end: null }),
    [compare, current]
  );

  return {
    rangeType,
    setRangeType,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    compare,
    setCompare,
    current,
    previous,
  };
}
