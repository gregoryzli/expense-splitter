import React, { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { formatCurrency, formatDate, initial } from '../lib/format';
import { LoadingState, ErrorBanner } from './AsyncState';
import './SettleUp.css';

function suggestionKey(s) {
  return `${s.fromUserId}-${s.toUserId}`;
}

export function SettleUp({ groupId, currentUserId, refreshSignal, onSettled }) {
  const fetchData = useCallback(
    () =>
      Promise.all([
        api.get(`/groups/${groupId}/balances`),
        api.get(`/groups/${groupId}/settlements/suggestions`),
        api.get(`/groups/${groupId}/settlements`),
      ]).then(([balances, suggestions, history]) => ({ balances, suggestions, history })),
    [groupId]
  );
  const { data, loading, error, refetch } = useAsync(fetchData, [groupId, refreshSignal]);

  const [recording, setRecording] = useState(null); // key of suggestion being recorded
  const [hidden, setHidden] = useState(new Set()); // optimistically-recorded suggestion keys
  const [rowError, setRowError] = useState(null); // { key, message }

  const recordPayment = async (suggestion) => {
    const key = suggestionKey(suggestion);
    setRecording(key);
    setRowError(null);
    setHidden((prev) => new Set(prev).add(key)); // optimistic: hide immediately

    try {
      await api.post(`/groups/${groupId}/settlements`, {
        fromUserId: suggestion.fromUserId,
        toUserId: suggestion.toUserId,
        amount: suggestion.amount,
      });
      // onSettled bumps refreshSignal, which is in this component's useAsync
      // deps -- that alone triggers the refetch, so we don't call it directly.
      onSettled?.();
    } catch (err) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setRowError({ key, message: err.message || 'Could not record that payment' });
    } finally {
      setRecording(null);
    }
  };

  if (loading) return <LoadingState label="Loading balances..." />;
  if (error) return <ErrorBanner error={error} onRetry={refetch} />;

  const { balances, suggestions, history } = data;
  const visibleSuggestions = suggestions.filter((s) => !hidden.has(suggestionKey(s)));

  return (
    <div className="settle-up">
      <section className="settle-section">
        <h3>Balances</h3>
        <ul className="balance-list">
          {balances.map((b) => (
            <li key={b.userId} className="balance-row">
              <span className="avatar-xs">{initial(b.name)}</span>
              <span className="balance-name">{b.userId === currentUserId ? 'You' : b.name}</span>
              <span className={`balance-amount ${b.balanceCents === 0 ? 'settled' : b.balanceCents > 0 ? 'owed' : 'owes'}`}>
                {b.balanceCents === 0
                  ? 'settled up'
                  : b.balanceCents > 0
                  ? `owed ${formatCurrency(b.balance)}`
                  : `owes ${formatCurrency(-b.balance)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settle-section">
        <h3>Suggested payments</h3>
        <p className="settle-hint">
          The fewest payments that settle everyone up -- see the README for how this is computed.
        </p>
        {visibleSuggestions.length === 0 ? (
          <p className="settle-empty">Nobody owes anybody anything. 🎉</p>
        ) : (
          <ul className="suggestion-list">
            {visibleSuggestions.map((s) => {
              const key = suggestionKey(s);
              const canRecord = currentUserId === s.fromUserId || currentUserId === s.toUserId;
              return (
                <li key={key} className="suggestion-row">
                  <span className="suggestion-text">
                    <strong>{s.fromUserId === currentUserId ? 'You' : s.fromName}</strong> pays{' '}
                    <strong>{s.toUserId === currentUserId ? 'you' : s.toName}</strong>{' '}
                    <span className="suggestion-amount">{formatCurrency(s.amount)}</span>
                  </span>
                  {canRecord ? (
                    <button
                      className="record-payment-btn"
                      onClick={() => recordPayment(s)}
                      disabled={recording === key}
                    >
                      {recording === key ? 'Recording...' : 'Mark as paid'}
                    </button>
                  ) : (
                    <span className="suggestion-waiting">pending</span>
                  )}
                  {rowError?.key === key && <span className="suggestion-error">{rowError.message}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="settle-section">
          <h3>Payment history</h3>
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id} className="history-row">
                <span>
                  {h.fromUser.id === currentUserId ? 'You' : h.fromUser.name} paid{' '}
                  {h.toUser.id === currentUserId ? 'you' : h.toUser.name} {formatCurrency(h.amount)}
                </span>
                <span className="history-date">{formatDate(h.settledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
