/**
 * Chat Window Page
 * Individual conversation view - WhatsApp-like chat interface
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Send, 
  Paperclip, 
  Smile,
  MoreVertical,
  Users
} from 'lucide-react';
import { useChat } from '../../context/chat/ChatContext';
import { useAuth } from '../../context/AuthContext';
import '../../styles/ManageUsersLayout.css';
import '../../styles/chats/ChatWindowPage.css';

const ChatWindowPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const {
    currentConversation,
    messages,
    onlineUsers,
    typingUsers,
    selectConversation,
    loadMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    conversations,
    sendTypingStatus,
    connectChat,
    disconnectChat,
  } = useChat();

  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const markedAsReadRef = useRef(new Set()); // Track which messages have been marked as read

  // Connect to chat when component mounts
  useEffect(() => {
    connectChat();
    
    return () => {
      disconnectChat();
    };
  }, [connectChat, disconnectChat]);

  // Load conversation and messages
  useEffect(() => {
    const conversation = conversations.find(c => c.id === parseInt(conversationId));
    if (conversation) {
      selectConversation(conversation);
    } else {
      // If conversation not found in list, try loading it
      loadMessages(parseInt(conversationId));
    }
  }, [conversationId, conversations, selectConversation, loadMessages]);

  // Mark messages as read when viewing conversation (with infinite loop prevention)
  useEffect(() => {
    if (currentConversation && messages[currentConversation.id]?.length > 0) {
      // Only mark as read if there are unread messages from other users
      const unreadMessages = messages[currentConversation.id].filter(
        msg => !msg.is_read && 
               msg.sender_id !== currentUser?.id && 
               !markedAsReadRef.current.has(msg.id)
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        
        // Mark these messages in our ref to prevent re-marking
        messageIds.forEach(id => markedAsReadRef.current.add(id));
        
        markAsRead(currentConversation.id, messageIds);
      }
    }
  }, [currentConversation, messages, markAsRead, currentUser]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping && currentConversation) {
      setIsTyping(true);
      sendTypingStatus(currentConversation.id, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (currentConversation) {
        sendTypingStatus(currentConversation.id, false);
      }
    }, 3000);
  }, [isTyping, currentConversation, sendTypingStatus]);

  // Handle send message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    
    if (!messageInput.trim() || !currentConversation) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      sendTypingStatus(currentConversation.id, false);
    }

    try {
      await sendMessage(currentConversation.id, content);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentConversation) return;

    // Check file size (60MB max)
    if (file.size > 60 * 1024 * 1024) {
      alert('File size must be less than 60MB');
      return;
    }

    setUploadingFile(true);
    
    try {
      await sendFileMessage(currentConversation.id, file);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Format message time
  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Get typing users names (excluding current user)
  const getTypingUsersNames = () => {
    if (!currentConversation || !typingUsers[currentConversation.id]) return [];
    
    const typingSet = typingUsers[currentConversation.id];
    const typingArray = Array.from(typingSet).filter(id => id !== currentUser?.id);
    
    // Get names from conversation members
    const names = currentConversation.members
      ?.filter(m => typingArray.includes(m.user_id))
      .map(m => m.user_name.split(' ')[0]) || [];
    
    return names;
  };

  const typingNames = getTypingUsersNames();

  // Check if other user is online (for direct chats)
  const isOtherUserOnline = () => {
    if (currentConversation?.type === 'DIRECT') {
      const otherUserId = currentConversation.member_ids?.find(id => id !== currentUser?.id);
      return otherUserId && onlineUsers.has(otherUserId);
    }
    return false;
  };

  if (!currentConversation) {
    return (
      <div className="page-container">
        <main className="page-main">
          <div className="chat-window-loading-container">
            <div className="chat-window-loading-spinner"></div>
          </div>
        </main>
      </div>
    );
  }

  const conversationMessages = messages[currentConversation.id] || [];

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="chat-window-header">
            <div className="chat-window-header-flex">
              <button
                onClick={() => navigate('/chat')}
                className="chat-window-back-btn"
              >
                <ArrowLeft size={24} />
              </button>

              {/* Avatar & Name */}
              <div className="chat-window-info-wrapper">
                <div className="chat-window-avatar-container">
                  <div className="chat-window-avatar">
                    {currentConversation.type === 'GROUP' ? (
                      <Users size={20} />
                    ) : (
                      currentConversation.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  {isOtherUserOnline() && (
                    <div className="chat-window-online-indicator" />
                  )}
                </div>

                <div className="chat-window-info">
                  <h2 className="chat-window-name">{currentConversation.name}</h2>
                  <p className="chat-window-status">
                    {isOtherUserOnline() ? 'Online' : 
                     currentConversation.type === 'GROUP' ? 
                     `${currentConversation.members?.length || 0} members` : 
                     'Offline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="chat-window-actions">
              <button className="chat-window-menu-btn">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="chat-window-messages">
            <div className="chat-window-messages-list">
              {conversationMessages.map((message, index) => {
                const isOwnMessage = message.sender_id === currentUser?.id;
                const showSenderName = currentConversation.type === 'GROUP' && !isOwnMessage;

                return (
                  <div
                    key={message.id}
                    className={`chat-message ${isOwnMessage ? 'sent' : 'received'}`}
                  >
                    <div className="chat-message-avatar">
                      {message.sender_name?.charAt(0).toUpperCase() || 'U'}
                    </div>

                    <div className="chat-message-content">
                      {showSenderName && (
                        <p className="chat-message-sender">
                          {message.sender_name}
                        </p>
                      )}

                      <div className="chat-message-bubble">
                        {/* File Message */}
                        {message.file_url && (
                          <div className="chat-message-file-container">
                            {message.message_type === 'IMAGE' ? (
                              <img
                                src={message.file_url}
                                alt={message.file_name}
                                className="chat-message-image"
                              />
                            ) : message.message_type === 'VIDEO' ? (
                              <video
                                src={message.file_url}
                                controls
                                className="chat-message-video"
                              />
                            ) : message.message_type === 'AUDIO' ? (
                              <audio src={message.file_url} controls className="chat-message-audio" />
                            ) : (
                              <a
                                href={message.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-message-file-link"
                              >
                                <Paperclip size={16} />
                                {message.file_name}
                              </a>
                            )}
                          </div>
                        )}

                        {/* Text Content */}
                        {message.content && (
                          <p className="chat-message-text">
                            {message.content}
                          </p>
                        )}
                      </div>

                      {/* Time & Read Receipts */}
                      <div className="chat-message-footer">
                        <span className="chat-message-time">
                          {formatMessageTime(message.created_at)}
                        </span>
                        
                        {isOwnMessage && message.read_receipts && message.read_receipts.length > 0 && (
                          <span className="chat-message-read-receipt">✓✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {typingNames.length > 0 && (
                <div className="chat-typing-indicator">
                  <p className="chat-typing-text">
                    {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
                  </p>
                  <div className="chat-typing-dots">
                    <div className="chat-typing-dot"></div>
                    <div className="chat-typing-dot"></div>
                    <div className="chat-typing-dot"></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="chat-input-container">
            <div className="chat-input-wrapper">
              {/* File Upload */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="chat-input-file-hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="chat-input-file-btn"
              >
                <Paperclip size={24} />
              </button>

              {/* Message Input */}
              <div className="chat-input-field-wrapper">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTypingStart();
                  }}
                  placeholder="Type a message..."
                  className="chat-input-field"
                />
                <button
                  type="button"
                  className="chat-input-emoji-btn"
                >
                  <Smile size={20} />
                </button>
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="chat-input-send-btn"
              >
                <Send size={20} />
              </button>
            </div>

            {uploadingFile && (
              <div className="chat-uploading-indicator">
                <div className="chat-uploading-spinner"></div>
                <span>Uploading file...</span>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChatWindowPage;
