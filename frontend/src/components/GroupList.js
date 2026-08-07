import React from 'react';
import './GroupList.css';
import { formatCurrency, initial, memberCountLabel } from '../lib/format';

function BalanceChip({ amount }) {
  if (Math.abs(amount) < 0.005) {
    return <span className="balance-chip settled">settled up</span>;
  }
  return amount > 0 ? (
    <span className="balance-chip owed">you're owed {formatCurrency(amount)}</span>
  ) : (
    <span className="balance-chip owes">you owe {formatCurrency(-amount)}</span>
  );
}

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
                <span className="member-count">{memberCountLabel(group.members.length)}</span>
              </div>
              {group.description && <p className="group-description">{group.description}</p>}
              <div className="group-footer">
                <div className="avatars">
                  {group.members.slice(0,4).map(m => (
                    <div key={m.id} className="avatar" title={m.name}>{initial(m.name)}</div>
                  ))}
                  {group.members.length > 4 && (
                    <div className="more">+{group.members.length - 4}</div>
                  )}
                </div>
                <BalanceChip amount={group.yourBalance} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
