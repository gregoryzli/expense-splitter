import React, { useState } from 'react';
import { CURRENCY_STORAGE_KEY } from '../lib/format';
import './Settings.css';

// This is the one real, working preference in the app -- everything
// downstream of a group's balances is USD cents server-side (see
// docs/ARCHITECTURE.md), so a "default currency" setting can only ever
// re-symbolize the display, not convert it (formatCurrency reads the same
// key). Kept small and honest rather than shipping toggles (notifications,
// privacy, themes) that don't wire up to anything.
export function Settings() {
  const [currency, setCurrency] = useState(() => localStorage.getItem(CURRENCY_STORAGE_KEY) || 'USD');

  const handleChange = (e) => {
    const value = e.target.value;
    setCurrency(value);
    localStorage.setItem(CURRENCY_STORAGE_KEY, value);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your SplitPay experience</p>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Display</h3>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <label>Currency symbol</label>
                <p>Changes how amounts are displayed app-wide. Balances are still tracked in USD -- this doesn't convert values.</p>
              </div>
              <select value={currency} onChange={handleChange} className="setting-select">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
