import React, { useState } from 'react';
import './Login.css';

export function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (isForgotPassword) {
      // Handle forgot password
      if (!formData.email) {
        setError('Please enter your email address');
        return;
      }
      alert('Password reset link sent to your email!');
      setIsForgotPassword(false);
      return;
    }

    if (isLogin) {
      // Handle login
      if (!formData.email || !formData.password) {
        setError('Please fill in all fields');
        return;
      }
      // Mock login - in real app, this would call your backend
      onLogin({
        id: 1,
        name: 'John Doe',
        email: formData.email
      });
    } else {
      // Handle sign up
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      // Mock sign up - in real app, this would call your backend
      onLogin({
        id: 1,
        name: formData.name,
        email: formData.email
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setError('');
  };

  const switchToLogin = () => {
    setIsLogin(true);
    setIsForgotPassword(false);
    resetForm();
  };

  const switchToSignUp = () => {
    setIsLogin(false);
    setIsForgotPassword(false);
    resetForm();
  };

  const switchToForgotPassword = () => {
    setIsForgotPassword(true);
    setIsLogin(false);
    resetForm();
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>SplitPay</h1>
          <p>Split expenses with friends easily</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          {!isLogin && !isForgotPassword && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
            />
          </div>

          {!isForgotPassword && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
              />
            </div>
          )}

          {!isLogin && !isForgotPassword && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
              />
            </div>
          )}

          <button type="submit" className="submit-button">
            {isForgotPassword ? 'Send Reset Link' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="login-footer">
          {isLogin && !isForgotPassword && (
            <>
              <button 
                type="button" 
                className="link-button"
                onClick={switchToForgotPassword}
              >
                Forgot Password?
              </button>
              <p>
                Don't have an account?{' '}
                <button 
                  type="button" 
                  className="link-button"
                  onClick={switchToSignUp}
                >
                  Sign Up
                </button>
              </p>
            </>
          )}

          {!isLogin && !isForgotPassword && (
            <p>
              Already have an account?{' '}
              <button 
                type="button" 
                className="link-button"
                onClick={switchToLogin}
              >
                Login
              </button>
            </p>
          )}

          {isForgotPassword && (
            <p>
              Remember your password?{' '}
              <button 
                type="button" 
                className="link-button"
                onClick={switchToLogin}
              >
                Back to Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

