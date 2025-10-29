import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Notiflix from 'notiflix';
import { Env } from '../data/Env';

const RegisterScreen = ({ onRegister }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      Notiflix.Notify.failure('Please fix the form errors before submitting');
      return;
    }

    setIsLoading(true);

    try {
      // Prepare user data with default role
      const userData = {
        username: formData.email.split('@')[0], // Generate username from email
        full_name: formData.name,
        email: formData.email,
        password: formData.password,
        role: 'collector', // Default role as collector
        avatar: '' // Empty avatar by default
      };

      const API_URL = `${Env.URL}/users`;
      console.log('Making request to:', API_URL);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, get the text and throw error
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      if (!response.ok) {
        // Handle different error cases
        if (response.status === 400 && data.detail === "User already exists") {
          Notiflix.Notify.failure('This email is already registered. Please use a different email or login.');
          setErrors({ email: 'Email already exists' });
        } else if (data.detail) {
          throw new Error(data.detail);
        } else {
          throw new Error(`Registration failed: ${response.status} ${response.statusText}`);
        }
        return;
      }

      // Registration successful
      Notiflix.Notify.success('Account created successfully! Redirecting to login...');
      
      // Show loading state for a moment
      Notiflix.Loading.standard('Creating your account...');
      
      setTimeout(() => {
        Notiflix.Loading.remove();
        // Navigate to login page after successful registration
        navigate('/login');
      }, 1500);

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('Network') || error.message.includes('fetch')) {
        Notiflix.Notify.failure('Network error. Please check your connection and try again.');
      } else if (error.message.includes('404')) {
        Notiflix.Notify.failure('API endpoint not found. Please check the server configuration.');
      } else if (error.message.includes('500')) {
        Notiflix.Notify.failure('Server error. Please try again later.');
      } else {
        Notiflix.Notify.failure(error.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Notiflix configuration
  React.useEffect(() => {
    Notiflix.Notify.init({
      width: '300px',
      position: 'right-top',
      distance: '10px',
      opacity: 1,
      borderRadius: '8px',
      rtl: false,
      timeout: 4000,
      messageMaxLength: 200,
      backOverlay: false,
      plainText: true,
      showOnlyTheLastOne: false,
      clickToClose: true,
      pauseOnHover: true,
      ID: 'NotiflixNotify',
      className: 'notiflix-notify',
      zindex: 4001,
      fontFamily: 'Quicksand',
      fontSize: '13px',
      cssAnimation: true,
      cssAnimationDuration: 400,
      cssAnimationStyle: 'fade',
      closeButton: false,
      useIcon: true,
      useFontAwesome: false,
      fontAwesomeIconStyle: 'basic',
      fontAwesomeIconSize: '34px',
      success: {
        background: '#10b981',
        textColor: '#fff',
        childClassName: 'notiflix-notify-success',
        notiflixIconColor: 'rgba(255,255,255,0.9)',
        fontAwesomeClassName: 'fas fa-check-circle',
        fontAwesomeIconColor: 'rgba(255,255,255,0.9)',
        backOverlayColor: 'rgba(50,198,130,0.2)',
      },
      failure: {
        background: '#ef4444',
        textColor: '#fff',
        childClassName: 'notiflix-notify-failure',
        notiflixIconColor: 'rgba(255,255,255,0.9)',
        fontAwesomeClassName: 'fas fa-times-circle',
        fontAwesomeIconColor: 'rgba(255,255,255,0.9)',
        backOverlayColor: 'rgba(255,85,73,0.2)',
      },
      warning: {
        background: '#f59e0b',
        textColor: '#fff',
        childClassName: 'notiflix-notify-warning',
        notiflixIconColor: 'rgba(255,255,255,0.9)',
        fontAwesomeClassName: 'fas fa-exclamation-circle',
        fontAwesomeIconColor: 'rgba(255,255,255,0.9)',
        backOverlayColor: 'rgba(238,191,49,0.2)',
      },
      info: {
        background: '#3b82f6',
        textColor: '#fff',
        childClassName: 'notiflix-notify-info',
        notiflixIconColor: 'rgba(255,255,255,0.9)',
        fontAwesomeClassName: 'fas fa-info-circle',
        fontAwesomeIconColor: 'rgba(255,255,255,0.9)',
        backOverlayColor: 'rgba(43,127,255,0.2)',
      },
    });

    // Also configure Loading
    Notiflix.Loading.init({
      backgroundColor: 'rgba(0,0,0,0.8)',
      messageColor: '#fff',
      messageFontSize: '16px',
      svgSize: '48px',
      svgColor: '#10b981',
    });
  }, []);

  return (
    <div className="tea-auth-container">
      <div className="tea-leaves">
        <div className="leaf leaf1"></div>
        <div className="leaf leaf2"></div>
        <div className="leaf leaf3"></div>
      </div>
      
      <div className="auth-content">
        <div className="auth-header">
          <div className="logo">
            <i className="fas fa-leaf"></i>
          </div>
          <h1 className="auth-title">Join Tea Collector</h1>
          <p className="auth-subtitle">Create your collector account</p>
        </div>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Your full name"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="Your email address"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="Create a password (min. 6 characters)"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
            {errors.password && <div className="form-error">{errors.password}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
              </button>
            </div>
            {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
          </div>
          
          <button 
            type="submit" 
            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Creating Account...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i> Create Collector Account
              </>
            )}
          </button>
        </form>
        
        <div className="role-notice">
          <i className="fas fa-info-circle"></i>
          <span>All new accounts are created as <strong>Collectors</strong></span>
        </div>
        
        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to={'/login'} className="auth-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;