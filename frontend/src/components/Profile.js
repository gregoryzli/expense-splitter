import React from 'react';
import './Profile.css';
import { formatCurrency, initial } from '../lib/format';

export function Profile({ user, groups, onLogout }) {
  const totalOwed = groups.filter((g) => g.yourBalance > 0).reduce((sum, g) => sum + g.yourBalance, 0);
  const totalOwe = groups.filter((g) => g.yourBalance < 0).reduce((sum, g) => sum - g.yourBalance, 0);

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
