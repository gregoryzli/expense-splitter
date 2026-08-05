import React from 'react';
import { getUserById } from '../lib/mockData';
import './ExpenseList.css';

export function ExpenseList({ expenses, onAddExpense }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food': '🍽️',
      'Transportation': '🚗',
      'Entertainment': '🎬',
      'Shopping': '🛍️',
      'Travel': '✈️',
      'Other': '📝'
    };
    return icons[category] || '📝';
  };

  return (
    <div className="expense-list">
      <div className="expense-list-header">
        <h2>Recent Expenses</h2>
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
          {expenses.map((expense) => (
            <div key={expense.id} className="expense-card">
              <div className="expense-header">
                <div className="expense-category">
                  <span className="category-icon">
                    {getCategoryIcon(expense.category)}
                  </span>
                  <span className="category-name">{expense.category}</span>
                </div>
                <div className="expense-amount">
                  {formatCurrency(expense.amount)}
                </div>
              </div>

              <div className="expense-details">
                <h3 className="expense-title">{expense.title}</h3>
                <p className="expense-date">{formatDate(expense.date)}</p>
              </div>

              <div className="expense-split">
                <div className="split-info">
                  <span className="paid-by">
                    Paid by <strong>{getUserById(expense.paidBy)?.name || 'Unknown'}</strong>
                  </span>
                  <span className="split-count">
                    Split between {expense.splitBetween.length} people
                  </span>
                </div>
                <div className="split-amount">
                  {formatCurrency(expense.amount / expense.splitBetween.length)} each
                </div>
              </div>

              <div className="expense-actions">
                <button className="action-button view-details">
                  View Details
                </button>
                <button className="action-button settle-up">
                  Settle Up
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
