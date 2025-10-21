import React, { useEffect, useRef } from "react";

/*
RollingTicker
- props:
  - items: [{ label, value, change }]
  - speed: px per second or CSS duration (optional)
  - kiosk: boolean (larger font when true)
- Simple CSS animation that duplicates content for continuous scroll
*/

export default function RollingTicker({ items = [], kiosk = false, speed = 100 }) {
  const containerRef = useRef(null);

  // Build a simple string array to render
  const pieces = items.map((it, i) => {
    const sign = (typeof it.change === "number" && it.change !== 0) ? (it.change > 0 ? "+" : "-") : "";
    const changeText = (typeof it.change === "number") ? `${sign}${Math.abs(it.change)}` : "";
    return `${it.label}: ${it.value} ${changeText}`;
  });

  // Duplicate to allow seamless loop
  const display = [...pieces, ...pieces];

  // CSS animation duration depends on content width; compute approximate duration
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // compute width of one set
    const inner = el.querySelector(".rt-inner");
    if (!inner) return;
    const width = inner.scrollWidth / 2; // width of one set
    // duration in seconds based on speed px/sec
    const duration = Math.max(10, Math.round(width / speed));
    inner.style.animation = `rt-scroll ${duration}s linear infinite`;
  }, [items, speed]);

  // Minimal styles included inline for portability
  return (
    <div className={`overflow-hidden border rounded bg-black ${kiosk ? "text-white" : "text-gray-100"} py-2`}>
      <div ref={containerRef} className="rt-inner whitespace-nowrap">
        <style>{`
          @keyframes rt-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .rt-inner { display: inline-block; }
          .rt-item { display: inline-block; padding: 0 28px; font-weight: 600; font-size: ${kiosk ? "28px" : "16px"}; }
        `}</style>

        {display.map((d, i) => (
          <span className="rt-item" key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}
