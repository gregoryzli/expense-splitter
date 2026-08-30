import React from 'react';
import './Settings.css';

// Currency used to live here as a profile-wide localStorage preference, but
// that never made sense: a currency symbol describes a shared group's
// expenses, not one person's personal taste, and different members could
// end up seeing different symbols on the exact same numbers. It's now set
// per group at creation time instead (CreateGroupModal), which is the
// thing that actually needed "agreeing on." Nothing else in the app is a
// real, working preference yet, so there's honestly nothing to put here --
// kept as an empty state rather than shipping decorative toggles
// (notifications, privacy, themes) that don't wire up to anything.
export function Settings() {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your SplitPay experience</p>
      </div>

      <div className="settings-content">
        <div className="settings-empty">
          <p>Nothing to configure here yet.</p>
          <p className="settings-empty-hint">
            Currency is set per group when you create it, not as a personal preference here.
          </p>
        </div>
      </div>
    </div>
  );
}
