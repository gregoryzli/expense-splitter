import React, { useState } from 'react';
import './Settings.css';

export function Settings({ user }) {
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    privacy: {
      profileVisibility: 'friends',
      showBalance: true,
      allowFriendRequests: true
    },
    currency: 'USD',
    language: 'en',
    theme: 'light'
  });

  const handleNotificationChange = (type) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  };

  const handlePrivacyChange = (type, value) => {
    setSettings(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [type]: value
      }
    }));
  };

  const handleSettingChange = (type, value) => {
    setSettings(prev => ({
      ...prev,
      [type]: value
    }));
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your SplitPay experience</p>
      </div>

      <div className="settings-content">
        <div className="settings-section">
          <h3>Notifications</h3>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <label>Email Notifications</label>
                <p>Receive updates via email</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications.email}
                  onChange={() => handleNotificationChange('email')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Push Notifications</label>
                <p>Receive push notifications in browser</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications.push}
                  onChange={() => handleNotificationChange('push')}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>SMS Notifications</label>
                <p>Receive text message alerts</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.notifications.sms}
                  onChange={() => handleNotificationChange('sms')}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Privacy</h3>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <label>Profile Visibility</label>
                <p>Who can see your profile</p>
              </div>
              <select
                value={settings.privacy.profileVisibility}
                onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                className="setting-select"
              >
                <option value="public">Public</option>
                <option value="friends">Friends Only</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Show Balance</label>
                <p>Display your balance to friends</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.privacy.showBalance}
                  onChange={() => handlePrivacyChange('showBalance', !settings.privacy.showBalance)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Allow Friend Requests</label>
                <p>Let others send you friend requests</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.privacy.allowFriendRequests}
                  onChange={() => handlePrivacyChange('allowFriendRequests', !settings.privacy.allowFriendRequests)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Preferences</h3>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <label>Currency</label>
                <p>Default currency for expenses</p>
              </div>
              <select
                value={settings.currency}
                onChange={(e) => handleSettingChange('currency', e.target.value)}
                className="setting-select"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Language</label>
                <p>Interface language</p>
              </div>
              <select
                value={settings.language}
                onChange={(e) => handleSettingChange('language', e.target.value)}
                className="setting-select"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Theme</label>
                <p>Appearance theme</p>
              </div>
              <select
                value={settings.theme}
                onChange={(e) => handleSettingChange('theme', e.target.value)}
                className="setting-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Account</h3>
          <div className="settings-group">
            <div className="setting-item">
              <div className="setting-info">
                <label>Export Data</label>
                <p>Download your expense data</p>
              </div>
              <button className="action-button">Export</button>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <label>Delete Account</label>
                <p>Permanently delete your account</p>
              </div>
              <button className="action-button danger">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

