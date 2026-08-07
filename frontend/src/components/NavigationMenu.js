import React from 'react';
import './NavigationMenu.css';

export function NavigationMenu({ isOpen, onToggle, currentView, onViewChange, user }) {
  const menuItems = [
    { id: 'home', label: 'Groups', icon: '🏠' },
    { id: 'about', label: 'About', icon: 'ℹ️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const handleItemClick = (itemId) => {
    onViewChange(itemId);
    onToggle(); // Close menu after selection
  };

  return (
    <>
      {isOpen && <div className="menu-overlay" onClick={onToggle}></div>}
      <nav className={`navigation-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <div className="user-info" onClick={() => { onViewChange('profile'); onToggle(); }}>
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          </div>
          <button className="close-menu" onClick={onToggle}>
            ×
          </button>
        </div>

        <div className="menu-items">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="menu-footer">
          <div className="app-info">
            <h4>SplitPay</h4>
            <p>Version 1.0.0</p>
          </div>
        </div>
      </nav>
    </>
  );
}
