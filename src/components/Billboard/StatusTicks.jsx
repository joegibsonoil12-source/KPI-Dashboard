// src/components/Billboard/StatusTicks.jsx
import React, { useState } from 'react';

/**
 * StatusTicks component
 * Displays a horizontal row of round status indicators with labels and tooltips
 * 
 * @param {Array} ticks - Array of tick objects with { label, status, tooltip }
 *   status can be: 'ok', 'warn', 'neg', or 'neutral'
 */
export default function StatusTicks({ ticks = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Map status to colors
  const statusColors = {
    ok: '#10b981',      // green
    warn: '#f59e0b',    // amber
    neg: '#ef4444',     // red
    neutral: '#9ca3af', // gray
  };

  if (!ticks || ticks.length === 0) {
    return null;
  }

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        flexWrap: 'wrap',
      }}
      role="list"
      aria-label="Status indicators"
    >
      {ticks.map((tick, index) => {
        const color = statusColors[tick.status] || statusColors.neutral;
        const isHovered = hoveredIndex === index;

        return (
          <div
            key={index}
            role="listitem"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              cursor: tick.tooltip ? 'pointer' : 'default',
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            aria-label={tick.tooltip || `${tick.label}: ${tick.status}`}
          >
            {/* Round tick indicator */}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 0 ${isHovered ? '4px' : '0px'} ${color}40`,
                transition: 'box-shadow 0.2s',
              }}
              aria-hidden="true"
            />
            
            {/* Label */}
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
              }}
            >
              {tick.label}
            </span>

            {/* Tooltip on hover */}
            {tick.tooltip && isHovered && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#1f2937',
                  color: '#fff',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
                role="tooltip"
              >
                {tick.tooltip}
                {/* Arrow */}
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #1f2937',
                  }}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
