import React from 'react';
import '../../styles/brand.css';

export default function PopoutButton({ route = '/billboard?popout=1', width = 1280, height = 720 }) {
  function onPopout() {
    const url = `${window.location.origin}${route}`;
    const features = `toolbar=0,location=0,menubar=0,status=0,width=${width},height=${height}`;
    window.open(url, 'GibsonOilBillboard', features);
  }

  return (
    <button
      onClick={onPopout}
      className="btn secondary popout-button"
      title="Open in new window"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      Popout
    </button>
  );
}
