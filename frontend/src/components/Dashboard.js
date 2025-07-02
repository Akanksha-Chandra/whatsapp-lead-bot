import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  TrendingUp, 
  Thermometer,
  AlertTriangle,
  Phone, 
  MessageSquare,
  Filter,
  Download,
  Search,
  RefreshCw
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
    fetchStats();
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

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/leads/stats`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const calculateStats = (leadsData) => {
    const stats = {
      total: leadsData.length,
      hot: leadsData.filter(lead => 
        lead.classification && lead.classification.toLowerCase() === 'hot'
      ).length,
      cold: leadsData.filter(lead => 
        lead.classification && lead.classification.toLowerCase() === 'cold'
      ).length,
      invalid: leadsData.filter(lead => 
        lead.classification && lead.classification.toLowerCase() === 'invalid'
      ).length,
      pending: leadsData.filter(lead => 
        !lead.classification || lead.classification.toLowerCase() === 'pending'
      ).length
    };
    setStats(stats);
    console.log('Calculated stats:', stats); // Debug log
  };

  const filterLeads = () => {
    let filtered = leads;

    // Apply classification filter
    if (filter !== 'all') {
      if (filter === 'pending') {
        filtered = filtered.filter(lead => 
          !lead.classification || lead.classification.toLowerCase() === 'pending'
        );
      } else {
        filtered = filtered.filter(lead => 
          lead.classification && lead.classification.toLowerCase() === filter.toLowerCase()
        );
      }
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

  const reclassifyLead = async (leadId) => {
    try {
      const response = await axios.post(`${API_BASE}/api/leads/${leadId}/reclassify`);
      if (response.data.success) {
        // Refresh leads after reclassification
        fetchLeads();
        alert('Lead reclassified successfully!');
      }
    } catch (error) {
      console.error('Error reclassifying lead:', error);
      alert('Error reclassifying lead');
    }
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
    if (!classification) return '#95a5a6'; // Gray for pending
    
    switch (classification.toLowerCase()) {
      case 'hot': return '#e74c3c'; // Red for hot
      case 'cold': return '#3498db'; // Blue for cold  
      case 'invalid': return '#95a5a6'; // Gray for invalid
      default: return '#f39c12'; // Orange for pending
    }
  };

  const getClassificationIcon = (classification) => {
    if (!classification) return <MessageSquare size={16} />;
    
    switch (classification.toLowerCase()) {
      case 'hot': return <TrendingUp size={16} />;
      case 'cold': return <Thermometer size={16} />;
      case 'invalid': return <AlertTriangle size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const exportLeads = () => {
    const csvContent = [
      ['Name', 'Phone', 'Source', 'Classification', 'Confidence', 'Reason', 'Created At', 'Location', 'Budget', 'Timeline', 'Intent', 'Property Type'],
      ...filteredLeads.map(lead => [
        lead.name,
        lead.phone,
        lead.source,
        lead.classification || 'Pending',
        lead.metadata?.confidence || '',
        lead.metadata?.classificationReason || '',
        formatDate(lead.createdAt),
        lead.metadata?.location || '',
        lead.metadata?.budget || '',
        lead.metadata?.timeline || '',
        lead.metadata?.intent || '',
        lead.metadata?.propertyType || ''
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
          <button onClick={fetchLeads} className="refresh-button">
            <RefreshCw size={16} />
            Refresh
          </button>
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
            <Thermometer size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.cold}</h3>
            <p>Cold Leads</p>
          </div>
        </div>

        <div className="stat-card invalid">
          <div className="stat-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.invalid}</h3>
            <p>Invalid Leads</p>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">
            <MessageSquare size={24} />
          </div>
          <div className="stat-content">
            <h3>{stats.pending}</h3>
            <p>Pending</p>
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
            All ({stats.total})
          </button>
          <button 
            className={filter === 'hot' ? 'active' : ''}
            onClick={() => setFilter('hot')}
          >
            🔥 Hot ({stats.hot})
          </button>
          <button 
            className={filter === 'cold' ? 'active' : ''}
            onClick={() => setFilter('cold')}
          >
            ❄️ Cold ({stats.cold})
          </button>
          <button 
            className={filter === 'invalid' ? 'active' : ''}
            onClick={() => setFilter('invalid')}
          >
            ❌ Invalid ({stats.invalid})
          </button>
          <button 
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            ⏳ Pending ({stats.pending})
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
              <th>AI Analysis</th>
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
                  <div className="classification-container">
                    <span 
                      className="classification-badge"
                      style={{ 
                        backgroundColor: getClassificationColor(lead.classification),
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {getClassificationIcon(lead.classification)}
                      {lead.classification || 'Pending'}
                    </span>
                    {lead.metadata?.confidence && (
                      <div className="confidence-score">
                        {lead.metadata.confidence}% confident
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="lead-metadata">
                    {lead.metadata?.location && (
                      <div>📍 {lead.metadata.location}</div>
                    )}
                    {lead.metadata?.budget && (
                      <div>💰 ₹{lead.metadata.budget}</div>
                    )}
                    {lead.metadata?.timeline && (
                      <div>⏰ {lead.metadata.timeline}</div>
                    )}
                    {lead.metadata?.intent && (
                      <div>🎯 {lead.metadata.intent}</div>
                    )}
                    {lead.metadata?.propertyType && (
                      <div>🏠 {lead.metadata.propertyType}</div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="ai-analysis">
                    {lead.metadata?.classificationReason && (
                      <div className="classification-reason">
                        <small>{lead.metadata.classificationReason}</small>
                      </div>
                    )}
                    {lead.metadata?.priority && (
                      <div className="priority-badge">
                        Priority: {lead.metadata.priority}
                      </div>
                    )}
                  </div>
                </td>
                <td>
                  <div className="lead-date">
                    {formatDate(lead.createdAt)}
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="view-chat-button"
                      onClick={() => onLeadSelect(lead)}
                    >
                      <MessageSquare size={14} />
                      Chat
                    </button>
                    {lead.classification && lead.classification !== 'Invalid' && (
                      <button 
                        className="reclassify-button"
                        onClick={() => reclassifyLead(lead.id)}
                        title="Reclassify with AI"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>
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

      {/* Summary Footer */}
      <div className="dashboard-summary">
        <p>
          Showing {filteredLeads.length} of {stats.total} leads
          {filter !== 'all' && ` (filtered by ${filter})`}
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
