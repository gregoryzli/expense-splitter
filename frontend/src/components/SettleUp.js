import React, { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { formatCurrency, formatDate, initial } from '../lib/format';
import { LoadingState, ErrorBanner } from './AsyncState';
import './SettleUp.css';

function suggestionKey(s) {
  return `${s.fromUserId}-${s.toUserId}`;
}

function historyKey(h) {
  return `${h.fromUser.id}-${h.toUser.id}`;
}

export function SettleUp({ groupId, currentUserId, currency, refreshSignal, onSettled }) {
  const fetchData = useCallback(
    () =>
      Promise.all([
        api.get(`/groups/${groupId}/balances`),
        api.get(`/groups/${groupId}/settlements/suggestions`),
        api.get(`/groups/${groupId}/settlements`),
        api.get(`/groups/${groupId}/departures`),
      ]).then(([balances, suggestions, history, departures]) => ({ balances, suggestions, history, departures })),
    [groupId]
  );
  const { data, loading, error, refetch } = useAsync(fetchData, [groupId, refreshSignal]);

  const [recording, setRecording] = useState(null); // key of suggestion being recorded
  const [hidden, setHidden] = useState(new Set()); // optimistically-recorded suggestion keys
  const [rowError, setRowError] = useState(null); // { key, message }
  const [actingOn, setActingOn] = useState(null); // settlement id being confirmed/rejected
  const [resolving, setResolving] = useState(null); // departure id being resolved

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

  const confirmSettlement = async (settlement) => {
    setActingOn(settlement.id);
    setRowError(null);
    try {
      await api.post(`/groups/${groupId}/settlements/${settlement.id}/confirm`);
      onSettled?.();
    } catch (err) {
      setRowError({ key: `pending-${settlement.id}`, message: err.message || 'Could not confirm that payment' });
    } finally {
      setActingOn(null);
    }
  };

  const rejectSettlement = async (settlement) => {
    setActingOn(settlement.id);
    setRowError(null);
    try {
      await api.delete(`/groups/${groupId}/settlements/${settlement.id}`);
      // The suggestion this settlement was hiding should reappear now that
      // it's gone -- clear it from the optimistic hidden set too, in case
      // this browser tab is the one that created it.
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(`${settlement.fromUser.id}-${settlement.toUser.id}`);
        return next;
      });
      onSettled?.();
    } catch (err) {
      setRowError({ key: `pending-${settlement.id}`, message: err.message || 'Could not reject that payment' });
    } finally {
      setActingOn(null);
    }
  };

  const resolveDeparture = async (departure, resolution) => {
    setResolving(departure.id);
    setRowError(null);
    try {
      await api.post(`/groups/${groupId}/departures/${departure.id}/resolve`, { resolution });
      onSettled?.();
    } catch (err) {
      setRowError({ key: `departure-${departure.id}`, message: err.message || 'Could not resolve that departure' });
    } finally {
      setResolving(null);
    }
  };

  if (loading) return <LoadingState label="Loading balances..." />;
  if (error) return <ErrorBanner error={error} onRetry={refetch} />;

  const { balances, suggestions, history, departures } = data;
  const unresolvedDepartures = departures.filter((d) => !d.resolvedAt);
  const pending = history.filter((h) => h.status === 'PENDING');
  const confirmed = history.filter((h) => h.status === 'CONFIRMED');
  const pendingKeys = new Set(pending.map(historyKey));
  const visibleSuggestions = suggestions.filter((s) => !hidden.has(suggestionKey(s)) && !pendingKeys.has(suggestionKey(s)));

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
                  ? `owed ${formatCurrency(b.balance, currency)}`
                  : `owes ${formatCurrency(-b.balance, currency)}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {unresolvedDepartures.length > 0 && (
        <section className="settle-section departures-section">
          <h3>Unresolved departures</h3>
          <p className="settle-hint">
            Someone left this group with a balance that isn't zero. Pick how to handle it -- their side of the
            ledger doesn't change until you do.
          </p>
          <ul className="departure-list">
            {unresolvedDepartures.map((d) => {
              const errKey = `departure-${d.id}`;
              const isBusy = resolving === d.id;
              return (
                <li key={d.id} className="departure-row">
                  <span>
                    <strong>{d.user.name}</strong> left {' '}
                    {d.balance > 0
                      ? <>owed <span className="suggestion-amount">{formatCurrency(d.balance, currency)}</span></>
                      : <>owing <span className="suggestion-amount">{formatCurrency(-d.balance, currency)}</span></>}
                  </span>
                  <div className="departure-actions">
                    <button
                      className="departure-btn"
                      onClick={() => resolveDeparture(d, 'WRITE_OFF')}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Working...' : 'Assume paid'}
                    </button>
                    <button
                      className="departure-btn primary"
                      onClick={() => resolveDeparture(d, 'ABSORB_EVEN')}
                      disabled={isBusy}
                    >
                      {isBusy ? 'Working...' : 'Split evenly among us'}
                    </button>
                  </div>
                  {rowError?.key === errKey && <span className="suggestion-error">{rowError.message}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
                    <span className="suggestion-amount">{formatCurrency(s.amount, currency)}</span>
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

      {pending.length > 0 && (
        <section className="settle-section">
          <h3>Awaiting confirmation</h3>
          <p className="settle-hint">
            A payment only counts toward balances once the other person confirms it actually happened.
          </p>
          <ul className="pending-list">
            {pending.map((h) => {
              const iInitiated = h.initiatedById === currentUserId;
              const errKey = `pending-${h.id}`;
              return (
                <li key={h.id} className="pending-row">
                  <span>
                    {h.fromUser.id === currentUserId ? 'You' : h.fromUser.name} paid{' '}
                    {h.toUser.id === currentUserId ? 'you' : h.toUser.name}{' '}
                    <span className="suggestion-amount">{formatCurrency(h.amount, currency)}</span>
                  </span>
                  {iInitiated ? (
                    <div className="pending-actions">
                      <span className="suggestion-waiting">
                        awaiting {h.fromUser.id === currentUserId ? h.toUser.name : h.fromUser.name}
                      </span>
                      <button
                        className="reject-btn"
                        onClick={() => rejectSettlement(h)}
                        disabled={actingOn === h.id}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="pending-actions">
                      <button
                        className="confirm-btn"
                        onClick={() => confirmSettlement(h)}
                        disabled={actingOn === h.id}
                      >
                        {actingOn === h.id ? 'Confirming...' : 'Confirm'}
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => rejectSettlement(h)}
                        disabled={actingOn === h.id}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {rowError?.key === errKey && <span className="suggestion-error">{rowError.message}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {confirmed.length > 0 && (
        <section className="settle-section">
          <h3>Payment history</h3>
          <ul className="history-list">
            {confirmed.map((h) => (
              <li key={h.id} className="history-row">
                <span>
                  {h.note ? (
                    <em className="history-note">{h.note} ({formatCurrency(h.amount, currency)})</em>
                  ) : (
                    <>
                      {h.fromUser.id === currentUserId ? 'You' : h.fromUser.name} paid{' '}
                      {h.toUser.id === currentUserId ? 'you' : h.toUser.name} {formatCurrency(h.amount, currency)}
                    </>
                  )}
                </span>
                <span className="history-date">{formatDate(h.confirmedAt || h.settledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
