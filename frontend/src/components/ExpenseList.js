import React, { useState } from 'react';
import { formatCurrency, formatDate, initial } from '../lib/format';
import './ExpenseList.css';

const CATEGORY_ICONS = {
  Food: '🍽️',
  Transportation: '🚗',
  Entertainment: '🎬',
  Shopping: '🛍️',
  Travel: '✈️',
  Utilities: '💡',
  Accommodation: '🏨',
  Other: '📝',
};

export function ExpenseList({ expenses, onAddExpense, onDeleteExpense, canDelete, pendingIds = [] }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="expense-list">
      <div className="expense-list-header">
        <h2>Expenses</h2>
        <button className="add-expense-button" onClick={onAddExpense}>
          + Add New Expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>No expenses yet</h3>
          <p>Start by adding your first expense to track and split costs with friends.</p>
          <button className="add-first-expense" onClick={onAddExpense}>
            Add Your First Expense
          </button>
        </div>
      ) : (
        <div className="expenses-grid">
          {expenses.map((expense) => {
            const isPending = pendingIds.includes(expense.id);
            const isExpanded = expandedId === expense.id;
            return (
              <div key={expense.id} className={`expense-card ${isPending ? 'pending' : ''}`}>
                <div className="expense-header">
                  <div className="expense-category">
                    <span className="category-icon">{CATEGORY_ICONS[expense.category] || '📝'}</span>
                    <span className="category-name">{expense.category}</span>
                  </div>
                  <div className="expense-amount">{formatCurrency(expense.amount)}</div>
                </div>

                <div className="expense-details">
                  <h3 className="expense-title">{expense.description}</h3>
                  <p className="expense-date">{formatDate(expense.expenseDate)}</p>
                </div>

                <div className="expense-split">
                  <div className="split-info">
                    <span className="paid-by">
                      Paid by <strong>{expense.paidBy?.name || 'Unknown'}</strong>
                    </span>
                    <span className="split-count">
                      Split {expense.splitType.toLowerCase()} between {expense.splits.length}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <ul className="split-breakdown">
                    {expense.splits.map((s) => (
                      <li key={s.user.id}>
                        <span className="avatar-xs">{initial(s.user.name)}</span>
                        <span>{s.user.name}</span>
                        <span className="split-share">{formatCurrency(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="expense-actions">
                  <button
                    className="action-button view-details"
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                  >
                    {isExpanded ? 'Hide split' : 'View split'}
                  </button>
                  {canDelete(expense) && (
                    <button
                      className="action-button delete-expense"
                      onClick={() => onDeleteExpense(expense)}
                      disabled={isPending}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
