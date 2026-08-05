import React from 'react';
import './Profile.css';

export function Profile({ user, onLogout, onClose }) {
  return (
    <div className="profile-page">
      <div className="profile-header">
        <h2>Profile</h2>
        {onClose && (
          <button className="close-profile-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <div className="profile-stats">
              <div className="stat">
                <span className="stat-label">Total Expenses</span>
                <span className="stat-value">$1,245.50</span>
              </div>
              <div className="stat">
                <span className="stat-label">Groups</span>
                <span className="stat-value">3</span>
              </div>
              <div className="stat">
                <span className="stat-label">Friends</span>
                <span className="stat-value">12</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button className="action-button edit-profile">
            Edit Profile
          </button>
          <button className="action-button change-password">
            Change Password
          </button>
          <button className="action-button logout" onClick={onLogout}>
            Logout
          </button>
        </div>

        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-icon">💰</div>
              <div className="activity-details">
                <p>Added expense "Dinner at Restaurant"</p>
                <span>2 hours ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">👥</div>
              <div className="activity-details">
                <p>Joined group "Weekend Trip"</p>
                <span>1 day ago</span>
              </div>
            </div>
            <div className="activity-item">
              <div className="activity-icon">✅</div>
              <div className="activity-details">
                <p>Settled up with John Doe</p>
                <span>3 days ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
