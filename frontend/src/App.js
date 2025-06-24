import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import LeadForm from './components/LeadForm';
import Dashboard from './components/Dashboard';
import { ArrowLeft, MessageCircle, Users, Bot, Home } from 'lucide-react';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('form'); // 'form', 'chat', 'dashboard'
  const [currentLead, setCurrentLead] = useState(null);
  const [leads, setLeads] = useState([]);

  const handleLeadCreated = (leadData) => {
    setCurrentLead({
      id: leadData.leadId,
      ...leadData.lead
    });
    setLeads(prev => [...prev, leadData.lead]);
    setCurrentView('chat');
  };

  const handleClassificationComplete = () => {
    // Refresh lead data after classification
    fetchLeadData();
  };

  const fetchLeadData = async () => {
    // This would fetch updated lead data from the API
    // For now, we'll just switch to dashboard
    setTimeout(() => {
      setCurrentView('dashboard');
    }, 2000);
  };

  const resetToForm = () => {
    setCurrentView('form');
    setCurrentLead(null);
  };

  const goToDashboard = () => {
    setCurrentView('dashboard');
  };

  const goToChat = (lead) => {
    setCurrentLead(lead);
    setCurrentView('chat');
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'form': return 'New Lead';
      case 'chat': return `Chat with ${currentLead?.name || 'Lead'}`;
      case 'dashboard': return 'Lead Dashboard';
      default: return 'GrowEasy Lead Bot';
    }
  };

  return (
    <div className="app">
      {/* Enhanced Navigation Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            {currentView !== 'form' && (
              <button onClick={resetToForm} className="back-button">
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="brand">
              <div className="brand-icon">
                <Home size={24} />
              </div>
              <div className="brand-text">
                <h1 className="brand-title">GrowEasy Lead Bot</h1>
                <p className="brand-subtitle">{getViewTitle()}</p>
              </div>
            </div>
          </div>
          
          <nav className="header-nav">
            <button 
              onClick={() => setCurrentView('form')}
              className={`nav-button ${currentView === 'form' ? 'active' : ''}`}
              title="New Lead"
            >
              <MessageCircle size={20} />
              <span>New Lead</span>
            </button>
            <button 
              onClick={goToDashboard}
              className={`nav-button ${currentView === 'dashboard' ? 'active' : ''}`}
              title="Dashboard"
            >
              <Users size={20} />
              <span>Dashboard</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="app-main">
        <div className="main-content">
          {currentView === 'form' && (
            <div className="view-container form-view">
              <LeadForm onLeadCreated={handleLeadCreated} />
            </div>
          )}

          {currentView === 'chat' && currentLead && (
            <div className="view-container chat-view">
              <ChatInterface
                leadId={currentLead.id}
                leadInfo={currentLead}
                onClassificationComplete={handleClassificationComplete}
              />
            </div>
          )}

          {currentView === 'dashboard' && (
            <div className="view-container dashboard-view">
              <Dashboard onLeadSelect={goToChat} />
            </div>
          )}
        </div>
      </main>

      {/* Enhanced Status Bar */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>WhatsApp Lead Bot Active</span>
          </div>
          {currentLead && (
            <div className="current-lead-info">
              <Bot size={16} />
              <span>Chatting with: <strong>{currentLead.name}</strong></span>
            </div>
          )}
          <div className="footer-meta">
            <span>GrowEasy AI © 2024</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;