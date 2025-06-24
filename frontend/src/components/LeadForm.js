import React, { useState } from 'react';
import axios from 'axios';
import { User, Phone, Globe, MessageSquare, Loader, Zap, Bot } from 'lucide-react';
import './LeadForm.css';

const LeadForm = ({ onLeadCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    source: 'Website',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const sources = [
    'Website',
    'Facebook',
    'Google Ads',
    'Instagram',
    'Referral',
    'Walk-in',
    'Other'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^\+?[\d\s\-\(\)]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/api/leads/create`, formData);
      
      if (response.data.success) {
        // Reset form
        setFormData({
          name: '',
          phone: '',
          source: 'Website',
          message: ''
        });
        
        // Notify parent component
        onLeadCreated(response.data);
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      setError(error.response?.data?.error || 'Failed to create lead. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="lead-form-wrapper">
      <div className="lead-form-container">
        {/* Header Section */}
        <div className="form-header">
          <div className="form-icon">
            <User size={32} />
          </div>
          <h2 className="form-title">New Lead Registration</h2>
          <p className="form-subtitle">Enter lead details to start the AI qualification process</p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="lead-form">
          {error && (
            <div className="error-message">
              <div className="error-icon">⚠️</div>
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                <User size={18} />
                <span>Full Name *</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                <Phone size={18} />
                <span>Phone Number *</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input"
                placeholder="+91 98765 43210"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="source" className="form-label">
              <Globe size={18} />
              <span>Lead Source</span>
            </label>
            <select
              id="source"
              name="source"
              value={formData.source}
              onChange={handleInputChange}
              className="form-select"
            >
              {sources.map(source => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="message" className="form-label">
              <MessageSquare size={18} />
              <span>Initial Message (Optional)</span>
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="Any specific requirements or initial message..."
              rows="4"
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader size={20} className="spinner" />
                <span>Creating Lead...</span>
              </>
            ) : (
              <>
                <Zap size={20} />
                <span>Start AI Chat</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Section */}
        <div className="form-footer">
          <div className="footer-content">
            <Bot size={20} />
            <p>The AI assistant will automatically start a conversation with this lead to qualify their requirements and budget.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadForm;