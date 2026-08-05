import React, { useState } from 'react';
import './PayLater.css';

export function PayLater({ expenses }) {
  const [view, setView] = useState('you-owe'); // 'you-owe' | 'you-are-owed'
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

  // Mock data for pending payments
  const pendingPayments = [
    {
      id: 1,
      title: 'Dinner at Restaurant',
      amount: 40.17,
      owedTo: 'John Doe',
      date: '2024-01-15',
      status: 'pending'
    },
    {
      id: 2,
      title: 'Uber Ride',
      amount: 12.50,
      owedTo: 'Jane Smith',
      date: '2024-01-14',
      status: 'pending'
    },
    {
      id: 3,
      title: 'Movie Tickets',
      amount: 11.25,
      owedTo: 'Mike Johnson',
      date: '2024-01-13',
      status: 'pending'
    }
  ];

  const totalYouOwe = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalYouAreOwed = 0; // Placeholder for future calculation from balances

  return (
    <div className="pay-later-page">
      <div className="pay-later-header">
        <h2>Settle Later</h2>
        <div className="settle-toggle">
          <button className={`toggle-btn ${view === 'you-owe' ? 'active' : ''}`} onClick={() => setView('you-owe')}>You owe</button>
          <button className={`toggle-btn ${view === 'you-are-owed' ? 'active' : ''}`} onClick={() => setView('you-are-owed')}>Others owe you</button>
        </div>
        <div className="total-owed">
          <span className="total-label">{view === 'you-owe' ? 'Total you owe' : 'Total others owe you'}</span>
          <span className="total-amount">{formatCurrency(view === 'you-owe' ? totalYouOwe : totalYouAreOwed)}</span>
        </div>
      </div>

      {pendingPayments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>All caught up!</h3>
          <p>You don't have any pending payments at the moment.</p>
        </div>
      ) : (
        <div className="payments-list">
          {pendingPayments
            .filter(p => view === 'you-owe')
            .map((payment) => (
            <div key={payment.id} className="payment-card">
              <div className="payment-header">
                <div className="payment-info">
                  <h3>{payment.title}</h3>
                  <p>{view === 'you-owe' ? `Owed to ${payment.owedTo}` : `Owed by ${payment.owedBy}`}</p>
                </div>
                <div className="payment-amount">
                  {formatCurrency(payment.amount)}
                </div>
              </div>

              <div className="payment-details">
                <span className="payment-date">{formatDate(payment.date)}</span>
                <span className={`payment-status ${payment.status}`}>
                  {payment.status}
                </span>
              </div>

              <div className="payment-actions">
                <button className="action-button pay-now">
                  Pay Now
                </button>
                <button className="action-button remind">
                  Send Reminder
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <button className="quick-action">
            <span className="action-icon">💳</span>
            <span>Pay All</span>
          </button>
          <button className="quick-action">
            <span className="action-icon">📱</span>
            <span>Request Money</span>
          </button>
          <button className="quick-action">
            <span className="action-icon">📊</span>
            <span>View History</span>
          </button>
          <button className="quick-action">
            <span className="action-icon">⚙️</span>
            <span>Payment Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
