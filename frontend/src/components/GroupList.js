import React from 'react';
import './GroupList.css';
import { getUserById } from '../lib/mockData';

export function GroupList({ groups, onCreateGroup, onOpenGroup }) {
  return (
    <div className="group-list">
      <div className="group-list-header">
        <h2>Your Groups</h2>
        <button className="create-group-btn" onClick={onCreateGroup}>+ Create Group</button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No groups yet</h3>
          <p>Create a group to start splitting expenses with friends.</p>
          <button className="create-first-group" onClick={onCreateGroup}>Create your first group</button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(group => (
            <button key={group.id} className="group-card" onClick={() => onOpenGroup(group.id)}>
              <div className="group-card-header">
                <h3>{group.name}</h3>
                <span className="member-count">{group.members.length} members</span>
              </div>
              {group.description && <p className="group-description">{group.description}</p>}
              <div className="group-footer">
                <div className="avatars">
                  {group.members.slice(0,4).map(id => {
                    const u = getUserById(id);
                    return u ? <div key={id} className="avatar" title={u.name}>{u.name.charAt(0).toUpperCase()}</div> : null;
                  })}
                  {group.members.length > 4 && (
                    <div className="more">+{group.members.length - 4}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



