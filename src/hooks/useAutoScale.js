import { useEffect, useState } from 'react';

/**
 * useAutoScale - Hook for auto-scaling content to fit viewport
 * 
 * Calculates a scale factor to fit content within the viewport while maintaining aspect ratio.
 * Useful for fullscreen mode to ensure content fits on different screen sizes.
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.baseWidth - Base width for content (default: 1920)
 * @param {number} options.baseHeight - Base height for content (default: 1080)
 * @param {boolean} options.enabled - Whether scaling is enabled (default: true)
 * @returns {number} - Scale factor to apply to content
 */
export default function useAutoScale({
  baseWidth = 1920,
  baseHeight = 1080,
  enabled = true,
} = {}) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    const calculateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate scale factors for both dimensions
      const scaleX = viewportWidth / baseWidth;
      const scaleY = viewportHeight / baseHeight;

      // Use the smaller scale to ensure content fits
      const newScale = Math.min(scaleX, scaleY, 1); // Cap at 1 to avoid upscaling

      setScale(newScale);
    };

    // Initial calculation
    calculateScale();

    // Recalculate on resize
    window.addEventListener('resize', calculateScale);

    return () => {
      window.removeEventListener('resize', calculateScale);
    };
  }, [baseWidth, baseHeight, enabled]);

  return scale;
}
