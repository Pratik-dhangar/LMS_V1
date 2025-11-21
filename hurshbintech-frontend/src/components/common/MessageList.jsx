import React from 'react';

/**
 * Reusable component for displaying message lists with consistent styling
 * @param {Array} messages - Array of message objects
 * @param {string} currentUserRole - 'trainer' or 'learner' to determine message alignment
 */
const MessageList = ({ messages, currentUserRole = 'trainer' }) => {
  return (
    <div className="max-h-[150px] overflow-y-auto mb-2 space-y-2">
      {messages.length > 0 ? (
        messages.map((msg, idx) => {
          const isCurrentUser = msg.sender === currentUserRole;
          return (
            <div
              key={idx}
              className={`message-bubble ${isCurrentUser ? 'message-bubble-sent' : 'message-bubble-received'}`}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <strong className="text-xs font-semibold">
                    {msg.sender === 'trainer' ? 'Trainer' : msg.sender === 'learner' ? 'Learner' : msg.sender}:
                  </strong>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <span className="text-sm">{msg.text}</span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-4">
          <p className="text-sm font-semibold text-gray-600">No messages yet</p>
          <p className="text-xs text-gray-500">Start a conversation!</p>
        </div>
      )}
    </div>
  );
};

export default MessageList;
