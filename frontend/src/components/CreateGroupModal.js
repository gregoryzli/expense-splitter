import React, { useState } from 'react';
import './CreateGroupModal.css';

export function CreateGroupModal({ onClose, onCreateGroup, user }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    memberIds: []
  });
  const [error, setError] = useState('');

  // Mock users for adding to group
  const availableUsers = [
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com' },
    { id: 4, name: 'Sarah Wilson', email: 'sarah@example.com' },
    { id: 5, name: 'Alex Brown', email: 'alex@example.com' },
    { id: 6, name: 'Emma Davis', email: 'emma@example.com' }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError('');
  };

  const handleMemberToggle = (userId) => {
    setFormData(prev => ({
      ...prev,
      memberIds: prev.memberIds.includes(userId)
        ? prev.memberIds.filter(id => id !== userId)
        : [...prev.memberIds, userId]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (formData.name.trim().length < 3) {
      setError('Group name must be at least 3 characters');
      return;
    }

    const newGroup = {
      id: Date.now(),
      name: formData.name.trim(),
      description: formData.description.trim(),
      createdBy: user.id,
      members: [user.id, ...formData.memberIds], // Creator is always a member
      createdAt: new Date().toISOString().split('T')[0],
      expenses: []
    };

    onCreateGroup(newGroup);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Group</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Group Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Weekend Trip, Office Lunch"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Describe what this group is for..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Add Members</label>
            <p className="form-help">
              Select users to add to your group. You can add more members later.
            </p>
            <div className="members-list">
              {availableUsers.map(user => (
                <label key={user.id} className="member-option">
                  <input
                    type="checkbox"
                    checked={formData.memberIds.includes(user.id)}
                    onChange={() => handleMemberToggle(user.id)}
                  />
                  <span className="checkmark"></span>
                  <div className="member-info">
                    <span className="member-name">{user.name}</span>
                    <span className="member-email">{user.email}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="group-preview">
              <h4>Group Preview</h4>
              <div className="preview-info">
                <p><strong>Name:</strong> {formData.name || 'Untitled Group'}</p>
                <p><strong>Members:</strong> {1 + formData.memberIds.length} (including you)</p>
                {formData.description && (
                  <p><strong>Description:</strong> {formData.description}</p>
                )}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

