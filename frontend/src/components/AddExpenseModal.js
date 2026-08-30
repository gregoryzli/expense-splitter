import React, { useMemo, useState } from 'react';
import { formatCurrency, initial } from '../lib/format';
import './AddExpenseModal.css';

const CATEGORIES = ['Food', 'Transportation', 'Entertainment', 'Shopping', 'Travel', 'Utilities', 'Accommodation', 'Other'];
const EPSILON = 0.01;

export function AddExpenseModal({ onClose, onAddExpense, currentUser, members, currency }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(currentUser.id);
  const [splitType, setSplitType] = useState('EQUAL');
  const [selected, setSelected] = useState(() => new Set(members.map((m) => m.id)));
  const [values, setValues] = useState({}); // userId -> string, for EXACT/PERCENTAGE
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const selectedMembers = members.filter((m) => selected.has(m.id));

  const enteredTotal = useMemo(
    () => selectedMembers.reduce((sum, m) => sum + (parseFloat(values[m.id]) || 0), 0),
    [selectedMembers, values]
  );
  const remaining = splitType === 'EXACT' ? amountNum - enteredTotal : 100 - enteredTotal;

  const toggleMember = (userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const splitEvenly = () => {
    if (splitType === 'EXACT') {
      const each = (amountNum / selectedMembers.length).toFixed(2);
      const next = {};
      selectedMembers.forEach((m) => (next[m.id] = each));
      setValues(next);
    } else if (splitType === 'PERCENTAGE') {
      const each = (100 / selectedMembers.length).toFixed(2);
      const next = {};
      selectedMembers.forEach((m) => (next[m.id] = each));
      setValues(next);
    }
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) setAmount(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!description.trim()) return setError('Please enter a description for the expense');
    if (!amountNum || amountNum <= 0) return setError('Please enter a valid amount');
    if (selectedMembers.length === 0) return setError('Please select at least one person to split with');

    if (splitType !== 'EQUAL' && Math.abs(remaining) > EPSILON) {
      return setError(
        splitType === 'EXACT'
          ? `Amounts must add up to the total (${formatCurrency(remaining, currency)} left)`
          : `Percentages must add up to 100 (${remaining.toFixed(2)}% left)`
      );
    }

    const payload = {
      description: description.trim(),
      category,
      amount: amountNum,
      paidById,
      splitType,
      ...(splitType === 'EQUAL'
        ? { participantIds: selectedMembers.map((m) => m.id) }
        : { splits: selectedMembers.map((m) => ({ userId: m.id, value: parseFloat(values[m.id]) || 0 })) }),
    };

    setSubmitting(true);
    try {
      await onAddExpense(payload);
    } catch (err) {
      setError(err.message || 'Could not add the expense');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Expense</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="paidBy">Paid by</label>
            <select id="paidBy" value={paidById} onChange={(e) => setPaidById(Number(e.target.value))}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.id === currentUser.id ? `${m.name} (you)` : m.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Split type</label>
            <div className="split-type-tabs">
              {['EQUAL', 'EXACT', 'PERCENTAGE'].map((type) => (
                <button
                  type="button"
                  key={type}
                  className={`split-type-tab ${splitType === type ? 'active' : ''}`}
                  onClick={() => setSplitType(type)}
                >
                  {type === 'EQUAL' ? 'Equal' : type === 'EXACT' ? 'Exact amounts' : 'Percentages'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="split-list-header">
              <label>Split between *</label>
              {splitType !== 'EQUAL' && selectedMembers.length > 0 && (
                <button type="button" className="split-evenly-btn" onClick={splitEvenly}>
                  Split evenly
                </button>
              )}
            </div>

            <div className="split-options">
              {members.map((member) => {
                const isSelected = selected.has(member.id);
                const equalShare = selectedMembers.length > 0 ? amountNum / selectedMembers.length : 0;
                return (
                  <div key={member.id} className={`split-row ${isSelected ? '' : 'disabled'}`}>
                    <label className="split-option">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleMember(member.id)} />
                      <span className="checkmark"></span>
                      <span className="avatar-xs">{initial(member.name)}</span>
                      <span className="friend-name">{member.id === currentUser.id ? 'You' : member.name}</span>
                    </label>

                    {isSelected && splitType === 'EQUAL' && (
                      <span className="split-value-readout">{formatCurrency(equalShare, currency)}</span>
                    )}
                    {isSelected && splitType === 'EXACT' && (
                      <div className="split-value-input">
                        <span className="prefix">$</span>
                        <input
                          type="text"
                          value={values[member.id] ?? ''}
                          onChange={(e) => setValues({ ...values, [member.id]: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                    {isSelected && splitType === 'PERCENTAGE' && (
                      <div className="split-value-input">
                        <input
                          type="text"
                          value={values[member.id] ?? ''}
                          onChange={(e) => setValues({ ...values, [member.id]: e.target.value })}
                          placeholder="0"
                        />
                        <span className="suffix">%</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitType !== 'EQUAL' && selectedMembers.length > 0 && (
              <p className={`split-remaining ${Math.abs(remaining) > EPSILON ? 'off' : 'ok'}`}>
                {splitType === 'EXACT'
                  ? `${formatCurrency(Math.abs(remaining), currency)} ${remaining >= 0 ? 'left to assign' : 'over the total'}`
                  : `${Math.abs(remaining).toFixed(2)}% ${remaining >= 0 ? 'left to assign' : 'over 100%'}`}
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-button" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
