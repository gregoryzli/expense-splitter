import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { initial } from '../lib/format';
import { useAsync } from '../hooks/useAsync';
import { LoadingState, ErrorBanner } from './AsyncState';
import './Friends.css';

// Saving a friend is a one-directional shortcut, not a mutual relationship
// (see backend/src/routes/friends.routes.ts) -- it just remembers people so
// you don't have to re-search for them every time you start a new group.
export function Friends() {
  const fetchFriends = useCallback(() => api.get('/friends'), []);
  const { data: friends, loading, error, refetch } = useAsync(fetchFriends);

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [actionError, setActionError] = useState('');

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

  const addFriend = async (user) => {
    setActionError('');
    setPendingId(user.id);
    try {
      await api.post('/friends', { friendId: user.id });
      setSearchResults((prev) => prev.map((u) => (u.id === user.id ? { ...u, isFriend: true } : u)));
      refetch();
    } catch (err) {
      setActionError(err.message || 'Could not save that friend');
    } finally {
      setPendingId(null);
    }
  };

  const removeFriend = async (userId) => {
    setActionError('');
    setPendingId(userId);
    try {
      await api.delete(`/friends/${userId}`);
      setSearchResults((prev) => prev.map((u) => (u.id === userId ? { ...u, isFriend: false } : u)));
      refetch();
    } catch (err) {
      setActionError(err.message || 'Could not remove that friend');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="friends-page">
      <div className="friends-header">
        <h2>Friends</h2>
        <p>Save people you split expenses with often, so you don't have to search for them every time.</p>
      </div>

      <div className="friends-content">
        <div className="friends-search">
          <label htmlFor="friend-search">Find someone</label>
          <input
            type="text"
            id="friend-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            autoComplete="off"
          />
          {searching && <p className="form-help">Searching...</p>}
          {actionError && <p className="friends-error">{actionError}</p>}
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((u) => (
                <div key={u.id} className="search-result">
                  <span className="avatar-sm">{initial(u.name)}</span>
                  <span className="member-info">
                    <span className="member-name">{u.name}</span>
                    <span className="member-email">{u.email}</span>
                  </span>
                  {u.isFriend ? (
                    <button
                      type="button"
                      className="friend-toggle saved"
                      disabled={pendingId === u.id}
                      onClick={() => removeFriend(u.id)}
                    >
                      ★ Saved
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="friend-toggle"
                      disabled={pendingId === u.id}
                      onClick={() => addFriend(u)}
                    >
                      ☆ Save
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="friends-list-section">
          <h3>Saved friends</h3>
          {loading && <LoadingState label="Loading your friends..." />}
          {error && <ErrorBanner error={error} onRetry={refetch} />}
          {!loading && !error && (friends || []).length === 0 && (
            <div className="friends-empty">
              <p>No saved friends yet.</p>
              <p className="friends-empty-hint">
                Search above to save someone -- it's just a personal shortcut list, they won't be notified.
              </p>
            </div>
          )}
          {!loading && !error && (friends || []).length > 0 && (
            <div className="friends-list">
              {friends.map((f) => (
                <div key={f.id} className="friend-row">
                  <span className="avatar-sm">{initial(f.name)}</span>
                  <span className="member-info">
                    <span className="member-name">{f.name}</span>
                    <span className="member-email">{f.email}</span>
                  </span>
                  <button
                    type="button"
                    className="friend-remove"
                    disabled={pendingId === f.id}
                    onClick={() => removeFriend(f.id)}
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
