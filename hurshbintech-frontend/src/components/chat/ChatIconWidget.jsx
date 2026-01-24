/**
 * Chat Icon Widget
 * Floating chat button in bottom-right corner
 * Visible on all pages except session pages and login
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import '../../styles/components/chat/chatWidget.css';

const ChatIconWidget = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCounts } = useChat();

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
    navigate('/chat');
  };

  return (
    <div className="chat-widget-container">
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
  );
};

export default ChatIconWidget;
