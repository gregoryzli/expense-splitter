import React, { useMemo, useState } from 'react';
import './GroupDetails.css';
import { getGroupById, getUserById } from '../lib/mockData';
import { ExpenseList } from './ExpenseList';
import { AddExpenseModal } from './AddExpenseModal';

export function GroupDetails({ groupId, onBack, user, onExpenseAdded }) {
  const group = useMemo(() => getGroupById(groupId), [groupId]);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  if (!group) return null;

  return (
    <div className="group-details">
      <div className="group-details-header">
        <button className="back-btn" onClick={onBack}>← Groups</button>
        <div className="title">
          <h2>{group.name}</h2>
          <p>{group.members.length} members</p>
        </div>
        <button className="add-expense-btn" onClick={() => setIsAddExpenseOpen(true)}>+ Add Expense</button>
      </div>

      {group.description && <p className="group-details-desc">{group.description}</p>}

      <div className="member-avatars">
        {group.members.map(id => {
          const u = getUserById(id);
          return u ? <div key={id} className="avatar" title={u.name}>{u.name.charAt(0).toUpperCase()}</div> : null;
        })}
      </div>

      <ExpenseList expenses={group.expenses} onAddExpense={() => setIsAddExpenseOpen(true)} />

      {isAddExpenseOpen && (
        <AddExpenseModal
          onClose={() => setIsAddExpenseOpen(false)}
          onAddExpense={(e) => { onExpenseAdded(e); setIsAddExpenseOpen(false); }}
          user={user}
          groupId={groupId}
        />
      )}
    </div>
  );
}



