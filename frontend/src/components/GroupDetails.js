import React, { useCallback, useEffect, useState } from 'react';
import './GroupDetails.css';
import { api } from '../lib/api';
import { useAsync } from '../hooks/useAsync';
import { ExpenseList } from './ExpenseList';
import { AddExpenseModal } from './AddExpenseModal';
import { SettleUp } from './SettleUp';
import { LoadingState, ErrorBanner } from './AsyncState';
import { initial, memberCountLabel } from '../lib/format';

export function GroupDetails({ groupId, currentUser, onBack, onGroupChanged }) {
  const [tab, setTab] = useState('expenses');
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenses, setExpenses] = useState(null);
  const [pendingIds, setPendingIds] = useState([]);
  const [listError, setListError] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const fetchGroup = useCallback(() => api.get(`/groups/${groupId}`), [groupId]);
  const { data: group, loading: groupLoading, error: groupError } = useAsync(fetchGroup, [groupId]);

  const fetchExpenses = useCallback(() => api.get(`/groups/${groupId}/expenses`), [groupId]);
  const { data: fetchedExpenses, loading: expensesLoading, error: expensesError, refetch: refetchExpenses } =
    useAsync(fetchExpenses, [groupId]);

  // Mirrors server data into local state so add/delete can update the
  // visible list immediately (optimistic UI) instead of waiting on a round trip.
  useEffect(() => {
    if (fetchedExpenses) setExpenses(fetchedExpenses);
  }, [fetchedExpenses]);

  const bumpBalances = () => {
    setRefreshSignal((s) => s + 1);
    onGroupChanged?.();
  };

  const handleAddExpense = async (payload) => {
    const members = group.members;
    const payer = members.find((m) => m.id === payload.paidById);
    const optimisticSplits =
      payload.splitType === 'EQUAL'
        ? payload.participantIds.map((id) => ({
            user: members.find((m) => m.id === id),
            amount: payload.amount / payload.participantIds.length,
          }))
        : payload.splits.map((s) => ({
            user: members.find((m) => m.id === s.userId),
            amount: payload.splitType === 'EXACT' ? s.value : (payload.amount * s.value) / 100,
          }));

    const tempId = `temp-${Date.now()}`;
    const optimisticExpense = {
      id: tempId,
      description: payload.description,
      category: payload.category,
      amount: payload.amount,
      splitType: payload.splitType,
      expenseDate: new Date().toISOString(),
      paidBy: payer,
      splits: optimisticSplits,
    };

    setExpenses((prev) => [optimisticExpense, ...(prev || [])]);
    setPendingIds((ids) => [...ids, tempId]);

    try {
      const real = await api.post(`/groups/${groupId}/expenses`, payload);
      setExpenses((prev) => prev.map((e) => (e.id === tempId ? real : e)));
      setPendingIds((ids) => ids.filter((id) => id !== tempId));
      bumpBalances();
      setIsAddExpenseOpen(false);
    } catch (err) {
      setExpenses((prev) => prev.filter((e) => e.id !== tempId));
      setPendingIds((ids) => ids.filter((id) => id !== tempId));
      throw err; // AddExpenseModal shows the message and stays open
    }
  };

  const handleDeleteExpense = async (expense) => {
    setListError(null);
    const previous = expenses;
    setExpenses(expenses.filter((e) => e.id !== expense.id));
    try {
      await api.delete(`/expenses/${expense.id}`);
      bumpBalances();
    } catch (err) {
      setExpenses(previous); // rollback
      setListError(err.message || 'Could not delete that expense');
    }
  };

  const canDelete = (expense) =>
    typeof expense.id === 'number' &&
    group &&
    (expense.paidBy?.id === currentUser.id || group.createdById === currentUser.id);

  if (groupLoading) return <LoadingState label="Loading group..." />;
  if (groupError) return <ErrorBanner error={groupError} />;
  if (!group) return null;

  return (
    <div className="group-details">
      <div className="group-details-header">
        <button className="back-btn" onClick={onBack}>← Groups</button>
        <div className="title">
          <h2>{group.name}</h2>
          <p>{memberCountLabel(group.members.length)}</p>
        </div>
      </div>

      {group.description && <p className="group-details-desc">{group.description}</p>}

      <div className="member-avatars">
        {group.members.map((m) => (
          <div key={m.id} className="avatar" title={m.name}>{initial(m.name)}</div>
        ))}
      </div>

      <div className="group-tabs">
        <button className={`group-tab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>
          Expenses
        </button>
        <button className={`group-tab ${tab === 'settle' ? 'active' : ''}`} onClick={() => setTab('settle')}>
          Settle Up
        </button>
      </div>

      {tab === 'expenses' ? (
        <>
          {listError && <ErrorBanner error={{ message: listError }} onRetry={() => setListError(null)} />}
          {expensesLoading && !expenses ? (
            <LoadingState label="Loading expenses..." />
          ) : expensesError ? (
            <ErrorBanner error={expensesError} onRetry={refetchExpenses} />
          ) : (
            <ExpenseList
              expenses={expenses || []}
              onAddExpense={() => setIsAddExpenseOpen(true)}
              onDeleteExpense={handleDeleteExpense}
              canDelete={canDelete}
              pendingIds={pendingIds}
            />
          )}
        </>
      ) : (
        <SettleUp groupId={groupId} currentUserId={currentUser.id} refreshSignal={refreshSignal} onSettled={bumpBalances} />
      )}

      {isAddExpenseOpen && (
        <AddExpenseModal
          onClose={() => setIsAddExpenseOpen(false)}
          onAddExpense={handleAddExpense}
          currentUser={currentUser}
          members={group.members}
        />
      )}
    </div>
  );
}
