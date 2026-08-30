import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { initial } from '../lib/format';
import './CreateGroupModal.css';

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'CAD', label: 'CAD (C$)' },
  { code: 'AUD', label: 'AUD (A$)' },
];

export function CreateGroupModal({ onClose, onCreateGroup }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [invited, setInvited] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounced live search against real accounts, replacing the old
  // hardcoded 6-user picker -- you can only add people who've signed up.
  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .get(`/users?search=${encodeURIComponent(query)}`)
        .then((users) => setSearchResults(users))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const invite = (user) => {
    if (!invited.some((u) => u.id === user.id)) {
      setInvited([...invited, user]);
    }
    setSearch('');
    setSearchResults([]);
  };

  const uninvite = (userId) => {
    setInvited(invited.filter((u) => u.id !== userId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    setSubmitting(true);
    try {
      const group = await api.post('/groups', {
        name: name.trim(),
        description: description.trim() || undefined,
        currency,
        memberEmails: invited.map((u) => u.email),
      });
      onCreateGroup(group);
    } catch (err) {
      setError(err.message || 'Could not create the group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Group</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Group Name *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Weekend Trip, Office Lunch"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this group is for..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="currency">Currency symbol</label>
            <p className="form-help">
              Just a display label everyone in this group will see -- it doesn't convert
              amounts or verify what currency anything was actually entered in.
            </p>
            <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="member-search">Add Members</label>
            <p className="form-help">Search by name or email. You can add more members later.</p>
            <input
              type="text"
              id="member-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a friend..."
              autoComplete="off"
            />
            {searching && <p className="form-help">Searching...</p>}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((u) => (
                  <button type="button" key={u.id} className="search-result" onClick={() => invite(u)}>
                    <span className="avatar-sm">{initial(u.name)}</span>
                    <span className="member-info">
                      <span className="member-name">{u.name}</span>
                      <span className="member-email">{u.email}</span>
                    </span>
                    <span className="add-hint">+ Add</span>
                  </button>
                ))}
              </div>
            )}

            {invited.length > 0 && (
              <div className="invited-chips">
                {invited.map((u) => (
                  <span key={u.id} className="invited-chip">
                    {u.name}
                    <button type="button" onClick={() => uninvite(u.id)} aria-label={`Remove ${u.name}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <div className="group-preview">
              <h4>Group Preview</h4>
              <div className="preview-info">
                <p><strong>Name:</strong> {name || 'Untitled Group'}</p>
                <p><strong>Currency:</strong> {currency}</p>
                <p><strong>Members:</strong> {1 + invited.length} (including you)</p>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
