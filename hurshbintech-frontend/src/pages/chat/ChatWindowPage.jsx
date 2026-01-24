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
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const conversationMessages = messages[currentConversation.id] || [];

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => navigate('/chat')}
              className="p-2 hover:bg-blue-700 rounded-full transition"
            >
              <ArrowLeft size={24} />
            </button>

            {/* Avatar & Name */}
            <div className="flex items-center gap-3 flex-1">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-blue-800 flex items-center justify-center text-white font-bold">
                  {currentConversation.type === 'GROUP' ? (
                    <Users size={20} />
                  ) : (
                    currentConversation.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                {isOtherUserOnline() && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-blue-600" />
                )}
              </div>

              <div className="flex-1">
                <h2 className="font-bold">{currentConversation.name}</h2>
                <p className="text-xs text-blue-100">
                  {isOtherUserOnline() ? 'Online' : 
                   currentConversation.type === 'GROUP' ? 
                   `${currentConversation.members?.length || 0} members` : 
                   'Offline'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-blue-700 rounded-full transition">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {conversationMessages.map((message, index) => {
          const isOwnMessage = message.sender_id === currentUser?.id;
          const showSenderName = currentConversation.type === 'GROUP' && !isOwnMessage;

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 shadow'
                }`}
              >
                {showSenderName && (
                  <p className="text-xs font-semibold text-blue-600 mb-1">
                    {message.sender_name}
                  </p>
                )}

                {/* File Message */}
                {message.file_url && (
                  <div className="mb-2">
                    {message.message_type === 'IMAGE' ? (
                      <img
                        src={message.file_url}
                        alt={message.file_name}
                        className="rounded max-w-full h-auto"
                      />
                    ) : message.message_type === 'VIDEO' ? (
                      <video
                        src={message.file_url}
                        controls
                        className="rounded max-w-full"
                      />
                    ) : message.message_type === 'AUDIO' ? (
                      <audio src={message.file_url} controls className="w-full" />
                    ) : (
                      <a
                        href={message.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm underline"
                      >
                        <Paperclip size={16} />
                        {message.file_name}
                      </a>
                    )}
                  </div>
                )}

                {/* Text Content */}
                {message.content && (
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                )}

                {/* Time & Read Receipts */}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className={`text-xs ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                    {formatMessageTime(message.created_at)}
                  </span>
                  
                  {isOwnMessage && message.read_receipts && message.read_receipts.length > 0 && (
                    <span className="text-blue-100 text-xs">✓✓</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {typingNames.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-300 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-600">
                {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-50"
          >
            <Paperclip size={24} />
          </button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => {
                setMessageInput(e.target.value);
                handleTypingStart();
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-600 hover:text-blue-600"
            >
              <Smile size={20} />
            </button>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!messageInput.trim()}
            className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            <Send size={20} />
          </button>
        </div>

        {uploadingFile && (
          <p className="text-sm text-gray-500 mt-2">Uploading file...</p>
        )}
      </form>
    </div>
  );
};

export default ChatWindowPage;
