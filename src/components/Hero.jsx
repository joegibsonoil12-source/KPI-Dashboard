// src/components/Hero.jsx
import React from 'react';
import '../styles/site-theme.css';

export default function Hero({ title = 'GO SERVE.' }) {
  return (
    <section className="site-hero" role="banner" aria-label="Hero">
      <div className="hero-overlay" />
      <img src="/assets/hero.jpg" alt="" className="hero-bg" aria-hidden="true" />
      <div className="hero-content">
        <h1 className="hero-title">{title}</h1>
      </div>
    </section>
  );
}
