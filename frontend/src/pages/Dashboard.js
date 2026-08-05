import React, { useState, useEffect } from 'react';
import { NavigationMenu } from '../components/NavigationMenu';
import { ExpenseList } from '../components/ExpenseList';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { Profile } from '../components/Profile';
import { PayLater } from '../components/PayLater';
import { About } from '../components/About';
import { Settings } from '../components/Settings';
import { GroupSelector } from '../components/GroupSelector';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { GroupList } from '../components/GroupList';
import { GroupDetails } from '../components/GroupDetails';
import { mockGroups, getGroupsByUserId, getExpensesByGroupId } from '../lib/mockData';
import './Dashboard.css';

export function Dashboard({ user, onLogout }) {
  const [currentView, setCurrentView] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [expenses, setExpenses] = useState([]);

  // Load user's groups on component mount
  useEffect(() => {
    const userGroups = getGroupsByUserId(user.id);
    setGroups(userGroups);
    // Default to "Your Groups" (no auto-selection)
    setSelectedGroupId(null);
  }, [user.id]);

  // Update expenses when selected group changes
  useEffect(() => {
    if (selectedGroupId) {
      const groupExpenses = getExpensesByGroupId(selectedGroupId);
      setExpenses(groupExpenses);
    }
  }, [selectedGroupId]);

  const addExpense = (newExpense) => {
    setExpenses([newExpense, ...expenses]);
    setIsAddExpenseModalOpen(false);
  };

  const addGroup = (newGroup) => {
    setGroups([newGroup, ...groups]);
    setSelectedGroupId(newGroup.id);
    setIsCreateGroupModalOpen(false);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'profile':
        return <Profile user={user} onLogout={onLogout} />;
      case 'pay-later':
        return <PayLater expenses={expenses} />;
      case 'about':
        return <About />;
      case 'settings':
        return <Settings user={user} />;
      default:
        return selectedGroupId ? (
          <GroupDetails
            groupId={selectedGroupId}
            onBack={() => setSelectedGroupId(null)}
            user={user}
            onExpenseAdded={(e) => setExpenses([e, ...expenses])}
          />
        ) : (
          <GroupList
            groups={groups}
            onCreateGroup={() => setIsCreateGroupModalOpen(true)}
            onOpenGroup={(id) => setSelectedGroupId(id)}
          />
        );
    }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="dashboard">
      <NavigationMenu 
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        currentView={currentView}
        onViewChange={setCurrentView}
        user={user}
      />
      
      <div className={`dashboard-content ${isMenuOpen ? 'menu-open' : ''}`}>
        <header className="dashboard-header">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
          
          <div className="header-center">
            <h1>SplitPay</h1>
            {selectedGroup && (
              <GroupSelector 
                groups={groups}
                selectedGroupId={selectedGroupId}
                onGroupChange={setSelectedGroupId}
                onCreateGroup={() => setIsCreateGroupModalOpen(true)}
              />
            )}
          </div>
          
          <div className="header-actions"></div>
        </header>

        <main className="dashboard-main">
          {renderCurrentView()}
        </main>
      </div>

      {isCreateGroupModalOpen && (
        <CreateGroupModal 
          onClose={() => setIsCreateGroupModalOpen(false)}
          onCreateGroup={addGroup}
          user={user}
        />
      )}
    </div>
  );
}
