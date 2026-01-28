/**
 * Chat Icon Widget
 * Floating chat button in bottom-right corner for mobile
 * LinkedIn-style popup for desktop/tablet
 * Visible on all pages except session pages and login
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import UnifiedChatPage from '../../pages/chat/UnifiedChatPage';
import MessagingWidget from './MessagingWidget';
import '../../styles/components/chat/chatWidget.css';

const ChatIconWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCounts } = useChat();
  const [showChatModal, setShowChatModal] = useState(false);

  // Pages where chat icon should NOT be shown
  const hiddenPages = [
    '/learner-session',
    '/trainer-session',
    '/coach-session',
    '/client-session',
    '/guest-session',
    '/login',
    '/chat',
    '/chat/',
    '/personal-chat',
    '/personal-chat/',
    '/create-session',
    '/create-session/',
    '/register-head',
    '/register-head/',
    '/register-coach',
    '/register-coach/',
    '/register-trainer',
    '/register-trainer/',
    '/register-learner',
    '/register-learner/'
  ];

  // Check if current page is in hidden pages list
  const shouldHide = hiddenPages.some(page => location.pathname.includes(page));

  if (shouldHide) {
    return null;
  }

  // Calculate total unread count
  const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  const handleClick = () => {
    setShowChatModal(true);
  };

  const handleCloseModal = () => {
    setShowChatModal(false);
  };

  return (
    <>
      {/* Mobile: Chat button with modal */}
      <div className="chat-widget-container chat-widget-mobile-only">
        <button
          onClick={handleClick}
          className="chat-widget-button"
          aria-label="Open Chat"
          title="Chat"
        >
          <MessageCircle size={30} />
          
          {/* Unread Badge */}
          {totalUnread > 0 && (
            <span className="chat-widget-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Chat Modal (Mobile only) */}
      {showChatModal && (
        <div className="chat-modal-overlay-fullscreen">
          <div className="chat-modal-container">
            <div className="chat-modal-header-bar">
              <h3 className="chat-modal-title">Chat</h3>
              <button
                onClick={handleCloseModal}
                className="chat-modal-minimize-btn"
                title="Minimize chat"
              >
                <Minimize2 size={20} />
              </button>
            </div>
            <div className="chat-modal-content">
              <UnifiedChatPage isModal={true} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop/Tablet: LinkedIn-style popup widget */}
      <div className="messaging-widget-desktop-only">
        <MessagingWidget />
      </div>
    </>
  );
};

export default ChatIconWidget;
