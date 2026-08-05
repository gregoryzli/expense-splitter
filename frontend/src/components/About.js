import React from 'react';
import './About.css';

export function About() {
  return (
    <div className="about-page">
      <div className="about-header">
        <h2>About SplitPay</h2>
        <p>Making expense splitting simple and fair</p>
      </div>

      <div className="about-content">
        <div className="about-section">
          <div className="section-icon">💡</div>
          <h3>Our Mission</h3>
          <p>
            SplitPay was created to eliminate the hassle of splitting expenses among friends, 
            family, and colleagues. We believe that sharing costs should be simple, transparent, 
            and stress-free.
          </p>
        </div>

        <div className="about-section">
          <div className="section-icon">🚀</div>
          <h3>Key Features</h3>
          <ul className="features-list">
            <li>Easy expense tracking and splitting</li>
            <li>Real-time balance calculations</li>
            <li>Multiple payment methods</li>
            <li>Group management</li>
            <li>Expense history and analytics</li>
            <li>Secure and private</li>
          </ul>
        </div>

        <div className="about-section">
          <div className="section-icon">👥</div>
          <h3>Our Team</h3>
          <p>
            We're a passionate team of developers and designers who have experienced the 
            frustration of splitting bills manually. Our goal is to make this process 
            as seamless as possible for everyone.
          </p>
        </div>

        <div className="about-section">
          <div className="section-icon">📱</div>
          <h3>Version Information</h3>
          <div className="version-info">
            <div className="version-item">
              <span className="version-label">App Version</span>
              <span className="version-value">1.0.0</span>
            </div>
            <div className="version-item">
              <span className="version-label">Last Updated</span>
              <span className="version-value">January 2024</span>
            </div>
            <div className="version-item">
              <span className="version-label">Platform</span>
              <span className="version-value">Web Application</span>
            </div>
          </div>
        </div>

        <div className="about-section">
          <div className="section-icon">📞</div>
          <h3>Contact & Support</h3>
          <div className="contact-info">
            <div className="contact-item">
              <span className="contact-label">Email</span>
              <span className="contact-value">support@splitpay.com</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">Help Center</span>
              <span className="contact-value">help.splitpay.com</span>
            </div>
            <div className="contact-item">
              <span className="contact-label">Feedback</span>
              <span className="contact-value">feedback@splitpay.com</span>
            </div>
          </div>
        </div>

        <div className="about-section">
          <div className="section-icon">⚖️</div>
          <h3>Legal</h3>
          <div className="legal-links">
            <a href="#" className="legal-link">Privacy Policy</a>
            <a href="#" className="legal-link">Terms of Service</a>
            <a href="#" className="legal-link">Cookie Policy</a>
          </div>
        </div>
      </div>

      <div className="about-footer">
        <p>&copy; 2024 SplitPay. All rights reserved.</p>
        <p>Made with ❤️ for better expense sharing</p>
      </div>
    </div>
  );
}

