import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken, getUserData } from '../utils/authUtils';
import { teaCollectionService, teaCollectionUtils } from '../utils/teaCollectionService';
import Notiflix from 'notiflix';

const AddTeaRecord = () => {
  const [formData, setFormData] = useState({
    station: '',
    collected_date: '',
    weight: '',
    comment: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = () => {
      const token = getAuthToken();
      const userData = getUserData();
      
      if (!token || !userData) {
        navigate('/login');
        return;
      }
      
      setUser(userData);
      // Set today's date as default
      setFormData(prev => ({
        ...prev,
        collected_date: new Date().toISOString().split('T')[0]
      }));
    };

    checkAuth();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // For weight field, only allow numbers and decimal point
    if (name === 'weight') {
      // Allow only numbers and one decimal point
      if (value === '' || /^\d*\.?\d*$/.test(value)) {
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
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
    
    if (!formData.station.trim()) {
      newErrors.station = 'Tea station is required';
    }
    
    if (!formData.collected_date) {
      newErrors.collected_date = 'Collection date is required';
    } else if (!teaCollectionUtils.isValidDate(formData.collected_date)) {
      newErrors.collected_date = 'Invalid date format. Use YYYY-MM-DD';
    } else {
      // Check if date is not in the future
      const selectedDate = new Date(formData.collected_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate > today) {
        newErrors.collected_date = 'Collection date cannot be in the future';
      }
    }
    
    if (!formData.weight) {
      newErrors.weight = 'Weight is required';
    } else if (parseFloat(formData.weight) <= 0) {
      newErrors.weight = 'Weight must be greater than 0';
    } else if (parseFloat(formData.weight) > 1000) {
      newErrors.weight = 'Weight seems too large. Please check the value';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      Notiflix.Notify.failure('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const collectionData = {
        user: user.email, // Use email from session
        station: formData.station.trim(),
        collected_date: formData.collected_date,
        weight: parseFloat(formData.weight),
        comment: formData.comment.trim()
      };

      await teaCollectionService.createCollection(collectionData);
      
      // Show success message
      Notiflix.Notify.success('Tea collection record added successfully!');
      
      // Reset form
      setFormData({
        station: '',
        collected_date: new Date().toISOString().split('T')[0],
        weight: '',
        comment: ''
      });
      setErrors({});
      
      // Optional: Redirect after success
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Error adding tea record:', error);
      Notiflix.Notify.failure(
        error.message || 'Failed to add tea collection record. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  // Common tea stations for suggestions
  const commonStations = [
    'Darjeeling Estate',
    'Assam Valley',
    'Nilgiri Hills',
    'Ceylon Highlands',
    'Matcha Garden',
    'Oolong Plantation',
    'Earl Grey Blend',
    'Chamomile Field',
    'Peppermint Garden',
    'Jasmine Field'
  ];

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
          <h1 className="auth-title">Add Tea Collection</h1>
          <p className="auth-subtitle">Record your tea collection details</p>
        </div>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Station Input */}
          <div className="form-group">
            <label htmlFor="station" className="form-label">
              Tea Station <span className="required">*</span>
            </label>
            <input
              type="text"
              id="station"
              name="station"
              className={`form-input ${errors.station ? 'error' : ''}`}
              placeholder="Enter tea station name"
              value={formData.station}
              onChange={handleChange}
              list="station-suggestions"
              disabled={loading}
            />
            <datalist id="station-suggestions">
              {commonStations.map((station, index) => (
                <option key={index} value={station} />
              ))}
            </datalist>
            {errors.station && <div className="form-error">{errors.station}</div>}
            <div className="form-hint">
              Common stations: Darjeeling, Assam, Nilgiri, etc.
            </div>
          </div>
          
          {/* Date Input */}
          <div className="form-group">
            <label htmlFor="collected_date" className="form-label">
              Collection Date <span className="required">*</span>
            </label>
            <input
              type="date"
              id="collected_date"
              name="collected_date"
              className={`form-input ${errors.collected_date ? 'error' : ''}`}
              value={formData.collected_date}
              onChange={handleChange}
              disabled={loading}
              max={new Date().toISOString().split('T')[0]} // Prevent future dates
            />
            {errors.collected_date && <div className="form-error">{errors.collected_date}</div>}
          </div>
          
          {/* Weight Input */}
          <div className="form-group">
            <label htmlFor="weight" className="form-label">
              Weight (kg) <span className="required">*</span>
            </label>
            <div className="input-with-unit">
              <input
                type="text"
                id="weight"
                name="weight"
                className={`form-input ${errors.weight ? 'error' : ''}`}
                placeholder="0.00"
                value={formData.weight}
                onChange={handleChange}
                disabled={loading}
              />
              <span className="input-unit">kg</span>
            </div>
            {errors.weight && <div className="form-error">{errors.weight}</div>}
            <div className="form-hint">
              Enter weight in kilograms (e.g., 2.5 for 2.5 kg)
            </div>
          </div>
          
          {/* Comment Input */}
          <div className="form-group">
            <label htmlFor="comment" className="form-label">Comments</label>
            <textarea
              id="comment"
              name="comment"
              className={`form-input textarea-input ${errors.comment ? 'error' : ''}`}
              placeholder="Any additional notes about this collection..."
              value={formData.comment}
              onChange={handleChange}
              disabled={loading}
              rows="4"
            />
            {errors.comment && <div className="form-error">{errors.comment}</div>}
            <div className="form-hint">
              Optional: Add tasting notes, quality observations, or other details
            </div>
          </div>
          
          {/* User Info Display */}
          <div className="user-info-display">
            <div className="user-info-item">
              <strong>Collector:</strong> {user?.full_name || user?.username}
            </div>
            <div className="user-info-item">
              <strong>Email:</strong> {user?.email}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              <i className="fas fa-arrow-left"></i> Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Adding...
                </>
              ) : (
                <>
                  <i className="fas fa-plus"></i> Add Collection
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="auth-footer">
          <p>
            Back to{' '}
            <button 
              className="auth-link" 
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Dashboard
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddTeaRecord;