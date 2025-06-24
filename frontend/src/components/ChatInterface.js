import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Phone, User, Clock, MapPin, DollarSign } from 'lucide-react';
import './ChatInterface.css';

const ChatInterface = ({ leadId, leadInfo, onClassificationComplete }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef(null);
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (leadId) {
      fetchChatHistory();
    }
  }, [leadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChatHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/chat/${leadId}`);
      if (response.data.success) {
        setMessages(response.data.chat.messages);
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || isComplete) return;

    setIsLoading(true);
    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Add user message immediately
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      message: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const response = await axios.post(`${API_BASE}/api/chat/${leadId}/message`, {
        message: userMessage
      });

      if (response.data.success) {
        setMessages(response.data.messages);
        setIsComplete(response.data.isComplete);
        
        if (response.data.isComplete && onClassificationComplete) {
          onClassificationComplete();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        message: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="chat-container">
      {/* Main Chat Area */}
      <div className="main-chat-area">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="contact-info">
            <div className="avatar">
              <User size={24} />
            </div>
            <div className="contact-details">
              <h3>{leadInfo?.name || 'Lead'}</h3>
              <span className="phone">
                <Phone size={14} />
                {leadInfo?.phone}
              </span>
            </div>
          </div>
          <div className="lead-status">
            <span className={`status-badge ${leadInfo?.classification?.toLowerCase() || 'pending'}`}>
              {leadInfo?.classification || 'In Progress'}
            </span>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                <p>{message.message}</p>
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="message bot-message">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        {!isComplete && (
          <div className="message-input-container">
            <div className="message-input">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="send-button"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="conversation-complete">
            <p>✅ Conversation completed! Lead has been classified.</p>
          </div>
        )}
      </div>

      {/* Lead Information Sidebar */}
      <div className="lead-info-sidebar">
        <h4>Lead Information</h4>
        <div className="info-item">
          <User size={16} />
          <span>{leadInfo?.name}</span>
        </div>
        <div className="info-item">
          <Phone size={16} />
          <span>{leadInfo?.phone}</span>
        </div>
        <div className="info-item">
          <Clock size={16} />
          <span>{leadInfo?.source}</span>
        </div>
        
        {leadInfo?.metadata && Object.keys(leadInfo.metadata).length > 0 && (
          <>
            <h5>Extracted Information</h5>
            {leadInfo.metadata.location && (
              <div className="info-item">
                <MapPin size={16} />
                <span>{leadInfo.metadata.location}</span>
              </div>
            )}
            {leadInfo.metadata.budget && (
              <div className="info-item">
                <DollarSign size={16} />
                <span>{leadInfo.metadata.budget}</span>
              </div>
            )}
            {leadInfo.metadata.intent && (
              <div className="info-item">
                <span className="info-label">Intent:</span>
                <span>{leadInfo.metadata.intent}</span>
              </div>
            )}
            {leadInfo.metadata.propertyType && (
              <div className="info-item">
                <span className="info-label">Property:</span>
                <span>{leadInfo.metadata.propertyType}</span>
              </div>
            )}
            {leadInfo.metadata.timeline && (
              <div className="info-item">
                <span className="info-label">Timeline:</span>
                <span>{leadInfo.metadata.timeline}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;