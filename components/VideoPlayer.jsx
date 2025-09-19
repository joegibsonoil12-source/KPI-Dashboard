// React component that loads a signed URL and renders a video player

import React, { useState, useEffect, useRef } from 'react';
import { getVideoUrl } from '../src/lib/getVideoUrl.js';

/**
 * VideoPlayer component for playing videos from Supabase Storage
 * @param {Object} props
 * @param {string} props.filePath - Path to video file in storage
 * @param {string} [props.bucket='videos'] - Storage bucket name
 * @param {string} [props.poster] - Poster image URL
 * @param {boolean} [props.controls=true] - Show video controls
 * @param {boolean} [props.autoplay=false] - Autoplay video
 * @param {boolean} [props.muted=false] - Mute video
 * @param {boolean} [props.loop=false] - Loop video
 * @param {string} [props.width] - Video width
 * @param {string} [props.height] - Video height
 * @param {string} [props.className] - CSS class name
 * @param {Object} [props.style] - Inline styles
 * @param {Function} [props.onLoad] - Callback when video loads
 * @param {Function} [props.onError] - Callback when error occurs
 * @param {number} [props.refreshInterval] - Auto-refresh signed URL interval in ms
 */
export default function VideoPlayer({
  filePath,
  bucket = 'videos',
  poster,
  controls = true,
  autoplay = false,
  muted = false,
  loop = false,
  width,
  height,
  className,
  style = {},
  onLoad,
  onError,
  refreshInterval
}) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const refreshTimeoutRef = useRef(null);

  // Load signed URL
  const loadSignedUrl = async () => {
    if (!filePath) {
      setError('No file path provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getVideoUrl(filePath, { bucket });

      if (result.error) {
        setError(result.error);
        onError?.(result.error);
      } else {
        setSignedUrl(result.url);
        onLoad?.(result.url);
      }
    } catch (err) {
      const errorMsg = `Failed to load video: ${err.message}`;
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Setup auto-refresh for signed URL
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      refreshTimeoutRef.current = setInterval(loadSignedUrl, refreshInterval);
      return () => {
        if (refreshTimeoutRef.current) {
          clearInterval(refreshTimeoutRef.current);
        }
      };
    }
  }, [refreshInterval, filePath, bucket]);

  // Load signed URL when component mounts or filePath changes
  useEffect(() => {
    loadSignedUrl();
    
    // Cleanup timeout on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearInterval(refreshTimeoutRef.current);
      }
    };
  }, [filePath, bucket]);

  // Render loading state
  if (loading) {
    return (
      <div 
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '2rem',
          width: width || '100%',
          height: height || '200px',
          ...style
        }}
      >
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ marginBottom: '0.5rem' }}>Loading video...</div>
          <div style={{ fontSize: '0.875rem' }}>Getting signed URL</div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div 
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '2rem',
          width: width || '100%',
          height: height || '200px',
          ...style
        }}
      >
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>
            Failed to load video
          </div>
          <div style={{ fontSize: '0.875rem' }}>{error}</div>
          <button
            onClick={loadSignedUrl}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render video player
  return (
    <video
      ref={videoRef}
      className={className}
      style={{
        width: width || '100%',
        height: height || 'auto',
        borderRadius: '8px',
        ...style
      }}
      src={signedUrl}
      poster={poster}
      controls={controls}
      autoPlay={autoplay}
      muted={muted}
      loop={loop}
      onError={(e) => {
        const errorMsg = 'Video playback error';
        setError(errorMsg);
        onError?.(errorMsg);
      }}
      onLoadedData={() => {
        onLoad?.(signedUrl);
      }}
    >
      Your browser does not support the video tag.
    </video>
  );
}