import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

// Currency used to live here as a profile-wide localStorage preference, but
// that never made sense: a currency symbol describes a shared group's
// expenses, not one person's personal taste, and different members could
// end up seeing different symbols on the exact same numbers. It's now set
// per group at creation time instead (CreateGroupModal), which is the
// thing that actually needed "agreeing on." Nothing else here is a
// decorative toggle (notifications, privacy, themes) that doesn't wire up
// to anything -- the one real action that belongs here is deleting the
// account itself.
export function Settings() {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.preventDefault();
    setError('');
    setDeleting(true);
    try {
      await deleteAccount(password);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not delete your account');
      setDeleting(false);
    }
  };

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

        <div className="danger-zone">
          <h3>Danger zone</h3>
          {!confirming ? (
            <>
              <p className="danger-zone-hint">
                Deleting your account removes you from every group you're in. Groups where you still had a
                balance will be left with an unresolved entry for the remaining members to sort out -- your
                name stays on past expenses and payments so their numbers still add up.
              </p>
              <button type="button" className="delete-account-btn" onClick={() => setConfirming(true)}>
                Delete Account
              </button>
            </>
          ) : (
            <form onSubmit={handleDelete} className="delete-account-form">
              <label htmlFor="delete-password">Enter your password to confirm</label>
              <input
                type="password"
                id="delete-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              {error && <p className="danger-zone-error">{error}</p>}
              <div className="delete-account-actions">
                <button
                  type="button"
                  className="cancel-delete-btn"
                  onClick={() => {
                    setConfirming(false);
                    setPassword('');
                    setError('');
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button type="submit" className="delete-account-btn" disabled={deleting || !password}>
                  {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
