import React from 'react';
import './About.css';

export function About() {
  return (
    <div className="about-page">
      <div className="about-header">
        <h2>About SplitPay</h2>
        <p>A group expense splitter built as a full-stack portfolio project</p>
      </div>

      <div className="about-content">
        <div className="about-section">
          <div className="section-icon">🧮</div>
          <h3>The settle-up algorithm</h3>
          <p>
            The interesting problem here isn't tracking who paid what -- it's collapsing a
            group's tangle of debts into the fewest possible payments. Finding the exact
            minimum is NP-hard, so the backend uses the same greedy approach real tools use:
            repeatedly match the person owed the most against the person who owes the most.
            It runs in O(n log n) and never needs more than n − 1 payments for n people.
          </p>
        </div>

        <div className="about-section">
          <div className="section-icon">🏗️</div>
          <h3>Stack</h3>
          <ul className="features-list">
            <li>Express + TypeScript backend, MySQL via Prisma</li>
            <li>JWT auth in an httpOnly cookie, bcrypt-hashed passwords</li>
            <li>zod request validation, real HTTP status codes throughout</li>
            <li>Money handled as integer cents end to end -- no floating-point drift</li>
            <li>React frontend with optimistic updates on expense add/delete and settlements</li>
          </ul>
        </div>

        <div className="about-section">
          <div className="section-icon">🚀</div>
          <h3>Key Features</h3>
          <ul className="features-list">
            <li>Equal, exact-amount, and percentage expense splits</li>
            <li>Real-time balance calculations per group</li>
            <li>Minimum-transaction settle-up suggestions</li>
            <li>Group membership management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
