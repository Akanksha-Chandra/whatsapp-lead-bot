import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Phone, 
  MessageSquare,
  Filter,
  Download,
  Search
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ onLeadSelect }) => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    cold: 0,
    invalid: 0,
    pending: 0
  });

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, filter, searchTerm]);

  const fetchLeads = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/leads`);
      if (response.data.success) {
        setLeads(response.data.leads);
        calculateStats(response.data.leads);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (leadsData) => {
    const stats = {
      total: leadsData.length,
      hot: leadsData.filter(lead => lead.classification === 'Hot').length,
      cold: leadsData.filter(lead => lead.classification === 'Cold').length,
      invalid: leadsData.filter(lead => lead.classification === 'Invalid').length,
      pending: leadsData.filter(lead => lead.classification === 'Pending').length
    };
    setStats(stats);
  };

  const filterLeads = () => {
    let filtered = leads;

    // Apply classification filter
    if (filter !== 'all') {
      filtered = filtered.filter(lead => 
        lead.classification.toLowerCase() === filter.toLowerCase()
      );
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone.includes(searchTerm) ||
        lead.source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLeads(filtered);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getClassificationColor = (classification) => {
    switch (classification?.toLowerCase()) {
      case 'hot': return '#ff4444';
      case 'cold': return '#ffa500';
      case 'invalid': return '#666';
      default: return '#25d366';
    }
  };

  const exportLeads = () => {
    const csvContent = [
      ['Name', 'Phone', 'Source', 'Classification', 'Created At', 'Location', 'Budget', 'Timeline'],
      ...filteredLeads.map(lead => [
        lead.name,
        lead.phone,
        lead.source,
        lead.classification,
        formatDate(lead.createdAt),
        lead.metadata?.location || '',
        lead.metadata?.budget || '',
        lead.metadata?.timeline || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>📊 Lead Dashboard</h2>
        <div className="dashboard-actions">
          <button onClick={exportLeads} className="export-button">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.total}</h3>
            <p>Total Leads</p>
          </div>
        </div>

        <div className="stat-card hot">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.hot}</h3>
            <p>Hot Leads</p>
          </div>
        </div>

        <div className="stat-card cold">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.cold}</h3>
            <p>Cold Leads</p>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">
            <MessageSquare size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pending}</h3>
            <p>In Progress</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="dashboard-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'hot' ? 'active' : ''}
            onClick={() => setFilter('hot')}
          >
            Hot
          </button>
          <button 
            className={filter === 'cold' ? 'active' : ''}
            onClick={() => setFilter('cold')}
          >
            Cold
          </button>
          <button 
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Lead Info</th>
              <th>Classification</th>
              <th>Details</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <div className="lead-info">
                    <strong>{lead.name}</strong>
                    <div className="lead-contact">
                      <Phone size={12} />
                      {lead.phone}
                    </div>
                    <div className="lead-source">
                      Source: {lead.source}
                    </div>
                  </div>
                </td>
                <td>
                  <span 
                    className="classification-badge"
                    style={{ backgroundColor: getClassificationColor(lead.classification) }}
                  >
                    {lead.classification || 'Pending'}
                  </span>
                  {lead.score && (
                    <div className="lead-score">
                      Score: {lead.score}/10
                    </div>
                  )}
                </td>
                <td>
                  <div className="lead-metadata">
                    {lead.metadata?.location && (
                      <div>📍 {lead.metadata.location}</div>
                    )}
                    {lead.metadata?.budget && (
                      <div>💰 {lead.metadata.budget}</div>
                    )}
                    {lead.metadata?.timeline && (
                      <div>⏰ {lead.metadata.timeline}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="lead-date">
                    {formatDate(lead.createdAt)}
                  </div>
                </td>
                <td>
                  <button 
                    className="view-chat-button"
                    onClick={() => onLeadSelect(lead)}
                  >
                    <MessageSquare size={14} />
                    View Chat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLeads.length === 0 && (
          <div className="no-leads">
            <MessageSquare size={48} />
            <h3>No leads found</h3>
            <p>Try adjusting your filters or create a new lead</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;