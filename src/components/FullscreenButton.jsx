import React, { useCallback, useEffect, useState } from 'react';

export default function FullscreenButton({ targetId = 'billboard-root', className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onChange = useCallback(() => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    setIsFullscreen(Boolean(fsEl));
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange', onChange);
    document.addEventListener('MSFullscreenChange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange', onChange);
      document.removeEventListener('MSFullscreenChange', onChange);
    };
  }, [onChange]);

  const requestFullscreen = async () => {
    try {
      const target = document.getElementById(targetId) || document.documentElement;
      if (!target) return;
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        await target.webkitRequestFullscreen();
      } else if (target.mozRequestFullScreen) {
        await target.mozRequestFullScreen();
      } else if (target.msRequestFullscreen) {
        await target.msRequestFullscreen();
      }
      // State will be updated by fullscreen change event listeners
    } catch (err) {
      console.error('requestFullscreen error', err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      // State will be updated by fullscreen change event listeners
    } catch (err) {
      console.error('exitFullscreen error', err);
    }
  };

  return (
    <button
      type="button"
      className={className}
      aria-pressed={isFullscreen}
      onClick={() => (isFullscreen ? exitFullscreen() : requestFullscreen())}
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        border: 'none',
        background: 'rgba(0,0,0,0.6)',
        color: 'white',
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
    </button>
  );
}
