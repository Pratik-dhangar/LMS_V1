/**
 * Chat Icon Widget
 * Floating chat button in bottom-right corner
 * Visible on all pages except session pages and login
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';

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
    '/login'
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
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleClick}
        className="relative bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
        aria-label="Open Chat"
        title="Chat"
      >
        <MessageCircle size={28} />
        
        {/* Unread Badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
};

export default ChatIconWidget;
