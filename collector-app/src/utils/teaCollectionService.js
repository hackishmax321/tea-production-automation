import { Env } from '../data/Env';
import { authFetch } from './authUtils';

// Tea Collection API Service
export const teaCollectionService = {
  // Create a new tea collection record
  async createCollection(collectionData) {
    try {
      const response = await authFetch(Env.URL+'/tea-collections', {
        method: 'POST',
        body: JSON.stringify(collectionData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create collection');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Create collection error:', error);
      throw error;
    }
  },

  // Get all tea collections
  async getAllCollections() {
    try {
      const response = await authFetch(Env.URL+'/tea-collections');
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get all collections error:', error);
      throw error;
    }
  },

  // Get collections by user
  async getCollectionsByUser(user) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/user/${user}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user collections');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get user collections error:', error);
      throw error;
    }
  },

  // Get collections by date
  async getCollectionsByDate(date) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/date/${date}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections by date');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get collections by date error:', error);
      throw error;
    }
  },

  // Get collections by user and date
  async getCollectionsByUserAndDate(user, date) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/user/${user}/date/${date}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collections by user and date');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get collections by user and date error:', error);
      throw error;
    }
  },

  // Get collection by ID
  async getCollectionById(collectionId) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/${collectionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get collection error:', error);
      throw error;
    }
  },

  // Update collection
  async updateCollection(collectionId, collectionData) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/${collectionId}`, {
        method: 'PUT',
        body: JSON.stringify(collectionData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update collection');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Update collection error:', error);
      throw error;
    }
  },

  // Delete collection
  async deleteCollection(collectionId) {
    try {
      const response = await authFetch(`${Env.URL}/tea-collections/${collectionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete collection');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Delete collection error:', error);
      throw error;
    }
  }
};

// Utility functions for tea collections
export const teaCollectionUtils = {
  // Validate collection data
  validateCollectionData(data) {
    const errors = {};
    
    if (!data.user?.trim()) {
      errors.user = 'User is required';
    }
    
    if (!data.station?.trim()) {
      errors.station = 'Station is required';
    }
    
    if (!data.weight || data.weight <= 0) {
      errors.weight = 'Weight must be a positive number';
    }
    
    if (!data.collected_date?.trim()) {
      errors.collected_date = 'Collection date is required';
    } else if (!this.isValidDate(data.collected_date)) {
      errors.collected_date = 'Date must be in YYYY-MM-DD format';
    }
    
    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  // Validate date format
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;
    
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  },

  // Format date for display
  formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  // Calculate total weight from collections
  calculateTotalWeight(collections) {
    return collections.reduce((total, collection) => total + collection.weight, 0);
  },

  // Group collections by station
  groupByStation(collections) {
    return collections.reduce((groups, collection) => {
      const station = collection.station;
      if (!groups[station]) {
        groups[station] = [];
      }
      groups[station].push(collection);
      return groups;
    }, {});
  },

  // Filter collections by date range
  filterByDateRange(collections, startDate, endDate) {
    return collections.filter(collection => {
      const collectionDate = new Date(collection.collected_date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return collectionDate >= start && collectionDate <= end;
    });
  }
};