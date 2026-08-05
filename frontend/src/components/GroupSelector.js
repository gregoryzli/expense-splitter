import React, { useState } from 'react';
import './GroupSelector.css';

export function GroupSelector({ groups, selectedGroupId, onGroupChange, onCreateGroup }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const handleGroupSelect = (groupId) => {
    onGroupChange(groupId);
    setIsDropdownOpen(false);
  };

  return (
    <div className="group-selector">
      <div 
        className="group-selector-trigger"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="group-info">
          <span className="group-name">{selectedGroup?.name || 'Select Group'}</span>
          <span className="group-members">
            {selectedGroup ? `${selectedGroup.members.length} members` : ''}
          </span>
        </div>
        <span className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>
          ▼
        </span>
      </div>

      {isDropdownOpen && (
        <div className="group-dropdown">
          <div className="dropdown-header">
            <h4>Your Groups</h4>
            <button 
              className="create-group-btn"
              onClick={() => {
                setIsDropdownOpen(false);
                onCreateGroup();
              }}
            >
              + Create Group
            </button>
          </div>
          
          <div className="group-list">
            {groups.length === 0 ? (
              <div className="no-groups">
                <p>No groups yet</p>
                <button 
                  className="create-first-group"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onCreateGroup();
                  }}
                >
                  Create your first group
                </button>
              </div>
            ) : (
              groups.map(group => (
                <div
                  key={group.id}
                  className={`group-item ${selectedGroupId === group.id ? 'selected' : ''}`}
                  onClick={() => handleGroupSelect(group.id)}
                >
                  <div className="group-item-info">
                    <span className="group-item-name">{group.name}</span>
                    <span className="group-item-members">
                      {group.members.length} members
                    </span>
                  </div>
                  {selectedGroupId === group.id && (
                    <span className="selected-indicator">✓</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

