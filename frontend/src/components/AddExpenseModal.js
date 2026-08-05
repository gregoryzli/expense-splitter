import React, { useState, useEffect } from 'react';
import { getGroupById, getUserById } from '../lib/mockData';
import './AddExpenseModal.css';

export function AddExpenseModal({ onClose, onAddExpense, user, groupId }) {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    splitBetween: [user.id],
    description: ''
  });
  const [error, setError] = useState('');
  const [group, setGroup] = useState(null);

  const categories = [
    'Food',
    'Transportation',
    'Entertainment',
    'Shopping',
    'Travel',
    'Utilities',
    'Accommodation',
    'Other'
  ];

  useEffect(() => {
    if (groupId) {
      const groupData = getGroupById(groupId);
      setGroup(groupData);
      if (groupData) {
        setFormData(prev => ({
          ...prev,
          splitBetween: [user.id] // Start with just the current user
        }));
      }
    }
  }, [groupId, user.id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError('');
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    // Allow only numbers and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({
        ...formData,
        amount: value
      });
    }
  };

  const handleSplitToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(userId)
        ? prev.splitBetween.filter(id => id !== userId)
        : [...prev.splitBetween, userId]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Please enter a title for the expense');
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (formData.splitBetween.length === 0) {
      setError('Please select at least one person to split with');
      return;
    }

    const newExpense = {
      id: Date.now(),
      title: formData.title.trim(),
      amount: parseFloat(formData.amount),
      paidBy: user.id,
      splitBetween: formData.splitBetween,
      date: new Date().toISOString().split('T')[0],
      category: formData.category,
      description: formData.description.trim()
    };

    onAddExpense(newExpense);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Expense</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Dinner at Restaurant"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Amount *</label>
              <input
                type="text"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Split Between *</label>
            <div className="split-options">
              {group && group.members.map(memberId => {
                const member = getUserById(memberId);
                return member ? (
                  <label key={memberId} className="split-option">
                    <input
                      type="checkbox"
                      checked={formData.splitBetween.includes(memberId)}
                      onChange={() => handleSplitToggle(memberId)}
                    />
                    <span className="checkmark"></span>
                    <span className="friend-name">{member.name}</span>
                  </label>
                ) : null;
              })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Add any additional details..."
              rows="3"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
