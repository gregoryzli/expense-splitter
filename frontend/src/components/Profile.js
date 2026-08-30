import React from 'react';
import './Profile.css';
import { formatCurrency, initial } from '../lib/format';

export function Profile({ user, groups, onLogout }) {
  const totalOwed = groups.filter((g) => g.yourBalance > 0).reduce((sum, g) => sum + g.yourBalance, 0);
  const totalOwe = groups.filter((g) => g.yourBalance < 0).reduce((sum, g) => sum - g.yourBalance, 0);
  // Groups can each pick their own display currency, but these totals just
  // sum raw numbers across all of them (there's nothing to convert between
  // currencies, since none of it is real currency tracking to begin with --
  // see lib/format.js). Flag it when that mix is actually visible here.
  const currencies = [...new Set(groups.map((g) => g.currency))];

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>Profile</h2>
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">{initial(user.name)}</div>
          <div className="profile-info">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-label">Groups</span>
                <span className="stat-value">{groups.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">You're owed</span>
                <span className="stat-value positive">{formatCurrency(totalOwed)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">You owe</span>
                <span className="stat-value negative">{formatCurrency(totalOwe)}</span>
              </div>
            </div>
            {currencies.length > 1 && (
              <p className="profile-caveat">
                Your groups use different currency symbols ({currencies.join(', ')}) -- these totals just
                add the raw numbers together, since nothing here actually converts between currencies.
              </p>
            )}
          </div>
        </div>

        <div className="profile-actions">
          <button className="action-button logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
