import React from 'react';
import '../../styles/brand.css';

export default function PopoutButton({ route = '/billboard?popout=1', width = 1280, height = 720 }) {
  function onPopout() {
    const url = `${window.location.origin}${route}`;
    const features = `toolbar=0,location=0,menubar=0,status=0,width=${width},height=${height}`;
    window.open(url, 'GibsonOilBillboard', features);
  }

  return (
    <button className="btn olive popout-button" onClick={onPopout} title="Open billboard in a new window">
      Pop out billboard
    </button>
  );
}