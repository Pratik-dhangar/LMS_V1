import { useState, useCallback } from 'react';

/**
 * Custom hook for managing messaging functionality in session components
 * @param {Object} webRTC - WebRTC service instance
 * @param {string} senderRole - 'trainer' or 'learner'
 * @returns {Object} - Message state and handlers
 */
const useMessages = (webRTC, senderRole = 'trainer') => {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');

  /**
   * Send a message via WebRTC and add to local state
   */
  const sendMessage = useCallback(() => {
    if (!currentMessage.trim()) return;

    const messageData = {
      sender: senderRole,
      text: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Send via WebRTC if available
    if (webRTC) {
      webRTC.sendMessage(currentMessage.trim(), senderRole);
    }

    // Add to local messages
    setMessages(prev => [...prev, messageData]);

    // Clear input
    setCurrentMessage('');
  }, [currentMessage, webRTC, senderRole]);

  /**
   * Handle Enter key press in message input
   */
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  /**
   * Add a received message to the messages list
   * Used for messages received from other participants
   */
  const addReceivedMessage = useCallback((messageData) => {
    setMessages(prev => [...prev, {
      ...messageData,
      timestamp: messageData.timestamp || new Date().toISOString()
    }]);
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    sendMessage,
    handleKeyPress,
    addReceivedMessage,
    clearMessages
  };
};

export default useMessages;
