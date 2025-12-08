import React from 'react';
import '../../styles/components/common/MessageList.css';

/**
 * Reusable component for displaying message lists with consistent styling
 * @param {Array} messages - Array of message objects
 * @param {string} currentUserRole - 'trainer' or 'learner' to determine message alignment
 */
const MessageList = ({ messages, currentUserRole = 'trainer' }) => {
  return (
    <div className="message-list-container">
      {messages.length > 0 ? (
        <div className="message-list-content">
          {messages.map((msg, idx) => {
            const isCurrentUser = msg.sender === currentUserRole;
            return (
              <div
                key={idx}
                className={`message-bubble ${isCurrentUser ? 'message-bubble-sent' : 'message-bubble-received'}`}
              >
                <div className="message-bubble-content">
                  <div className="message-header">
                    <strong className="message-sender">
                      {msg.sender === 'trainer' ? 'Trainer' : msg.sender === 'learner' ? 'Learner' : msg.sender}:
                    </strong>
                    <span className="message-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <span className="message-text">{msg.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="message-list-empty">
          <p className="message-list-empty-title">No messages yet</p>
          <p className="message-list-empty-subtitle">Start a conversation!</p>
        </div>
      )}
    </div>
  );
};

export default MessageList;
