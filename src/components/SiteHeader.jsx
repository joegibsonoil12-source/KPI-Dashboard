// src/components/SiteHeader.jsx
import React from 'react';
import '../styles/site-theme.css';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-brand">
          <a href="/" className="brand-link" aria-label="Gibson Oil Home">
            <img src="/assets/logo-full.svg" alt="Gibson Oil" className="brand-logo" />
          </a>
        </div>

        <nav className="site-nav" aria-label="Main navigation">
          <ul className="nav-list">
            <li className="nav-item"><a href="/propane">PROPANE</a></li>
            <li className="nav-item"><a href="/gas">GAS, DIESEL & MORE</a></li>
            <li className="nav-item"><a href="/company">OUR COMPANY</a></li>
            <li className="nav-item"><a href="/contact">CONTACT</a></li>
            <li className="nav-item"><a href="/legacy">GIBSON LEGACY</a></li>
          </ul>
        </nav>

        <div className="site-ctas">
          <a className="cta cta-primary" href="/account">MY ACCOUNT</a>
          <a className="cta cta-secondary" href="/become-customer">BECOME A CUSTOMER</a>
          <a className="cta cta-phone" href="tel:9104622155">910.462.2155</a>
        </div>
      </div>
    </header>
  );
}
