/**
 * Chat Context
 * Global state management for chat functionality
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import chatApi from '../../api/services/chat/chatApi';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState({});  // { conversationId: [messages] }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // { conversationId: Set(userIds) }
  const [unreadCounts, setUnreadCounts] = useState({}); // { conversationId: count }
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ============ CONVERSATIONS ============

  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await chatApi.getConversations();
      setConversations(data.conversations || []);
      
      // Update unread counts
      const counts = {};
      (data.conversations || []).forEach(conv => {
        counts[conv.id] = conv.unread_count || 0;
      });
      setUnreadCounts(counts);
      
      setError(null);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createConversation = useCallback(async (type, memberIds, name = null) => {
    try {
      const data = await chatApi.createConversation({
        type,
        member_ids: memberIds,
        name
      });
      
      // Add to conversations list
      setConversations(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      throw err;
    }
  }, []);

  const selectConversation = useCallback(async (conversation) => {
    setCurrentConversation(conversation);
    
    // Load messages if not already loaded
    if (!messages[conversation.id]) {
      await loadMessages(conversation.id);
    }
  }, [messages]);

  // ============ MESSAGES ============

  const loadMessages = useCallback(async (conversationId, beforeMessageId = null) => {
    try {
      const data = await chatApi.getMessages(conversationId, 0, 50, beforeMessageId);
      
      setMessages(prev => ({
        ...prev,
        [conversationId]: data.messages || []
      }));
      
      return data;
    } catch (err) {
      console.error('Failed to load messages:', err);
      throw err;
    }
  }, []);

  const sendMessage = useCallback(async (conversationId, content, messageType = 'TEXT') => {
    try {
      const data = await chatApi.sendMessage({
        conversation_id: conversationId,
        content,
        message_type: messageType
      });
      
      // Add message to local state
      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), data]
      }));
      
      return data;
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  }, []);

  const sendFileMessage = useCallback(async (conversationId, file, caption = null) => {
    try {
      const data = await chatApi.sendMessageWithFile(conversationId, file, caption);
      
      // Add message to local state
      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), data]
      }));
      
      return data;
    } catch (err) {
      console.error('Failed to send file message:', err);
      throw err;
    }
  }, []);

  const markAsRead = useCallback(async (conversationId, messageIds = []) => {
    try {
      await chatApi.markMessagesAsRead(conversationId, messageIds);
      
      // Update unread count
      setUnreadCounts(prev => ({
        ...prev,
        [conversationId]: 0
      }));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // ============ USERS ============

  const loadAllUsers = useCallback(async () => {
    try {
      const users = await chatApi.getAllUsers();
      setAllUsers(users);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  // ============ WEBSOCKET HANDLERS ============

  const handleNewMessage = useCallback((message) => {
    const { conversation_id } = message;
    
    // Add message to state
    setMessages(prev => ({
      ...prev,
      [conversation_id]: [...(prev[conversation_id] || []), message]
    }));
    
    // Update conversation's last message
    setConversations(prev => prev.map(conv => 
      conv.id === conversation_id
        ? { ...conv, last_message: message, updated_at: message.created_at }
        : conv
    ));
    
    // Increment unread count if not current conversation
    if (!currentConversation || currentConversation.id !== conversation_id) {
      setUnreadCounts(prev => ({
        ...prev,
        [conversation_id]: (prev[conversation_id] || 0) + 1
      }));
    }
  }, [currentConversation]);

  const handleUserOnline = useCallback((userId) => {
    setOnlineUsers(prev => new Set([...prev, userId]));
  }, []);

  const handleUserOffline = useCallback((userId) => {
    setOnlineUsers(prev => {
      const updated = new Set(prev);
      updated.delete(userId);
      return updated;
    });
  }, []);

  const handleTypingStatus = useCallback((conversationId, userId, isTyping) => {
    setTypingUsers(prev => {
      const conversationTyping = new Set(prev[conversationId] || []);
      
      if (isTyping) {
        conversationTyping.add(userId);
      } else {
        conversationTyping.delete(userId);
      }
      
      return {
        ...prev,
        [conversationId]: conversationTyping
      };
    });
  }, []);

  const handleMessageRead = useCallback((conversationId, messageId, userId) => {
    // Update message read receipts
    setMessages(prev => ({
      ...prev,
      [conversationId]: (prev[conversationId] || []).map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              read_receipts: [...(msg.read_receipts || []), { user_id: userId }]
            }
          : msg
      )
    }));
  }, []);

  const handleConversationUpdate = useCallback(async (conversationId) => {
    // Reload conversations
    await loadConversations();
  }, [loadConversations]);

  // ============ INITIALIZATION ============

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAllUsers();
    }
  }, [user, loadConversations, loadAllUsers]);

  const value = {
    // State
    conversations,
    currentConversation,
    messages,
    onlineUsers,
    typingUsers,
    unreadCounts,
    allUsers,
    loading,
    error,
    
    // Actions
    loadConversations,
    createConversation,
    selectConversation,
    loadMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    loadAllUsers,
    
    // WebSocket handlers
    handleNewMessage,
    handleUserOnline,
    handleUserOffline,
    handleTypingStatus,
    handleMessageRead,
    handleConversationUpdate,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export default ChatContext;
