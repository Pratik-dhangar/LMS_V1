/**
 * Chat Context
 * Global state management for chat functionality
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import chatApi from '../../api/services/chat/chatApi';

const ChatContext = createContext();

// WebSocket configuration
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const CHAT_WS_ENDPOINT = `${WS_URL}/api/chat/ws`;
const RECONNECT_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 30000;

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
  
  // WebSocket state
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

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
    console.log('[ChatContext] handleNewMessage called with:', message);
    const { conversation_id } = message;
    
    if (!conversation_id) {
      console.error('[ChatContext] Message missing conversation_id:', message);
      return;
    }
    
    // Add message to state
    setMessages(prev => {
      const updated = {
        ...prev,
        [conversation_id]: [...(prev[conversation_id] || []), message]
      };
      console.log('[ChatContext] Updated messages for conversation', conversation_id, ':', updated[conversation_id]);
      return updated;
    });
    
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

  // ============ WEBSOCKET ============

  const connectWebSocket = useCallback(() => {
    if (!user || wsRef.current) return;

    try {
      console.log('[ChatWS] Connecting to:', CHAT_WS_ENDPOINT);
      const ws = new WebSocket(CHAT_WS_ENDPOINT);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[ChatWS] Connected');
        setIsConnected(true);
        setReconnectAttempts(0);

        // Get token from localStorage
        const token = localStorage.getItem('access_token');

        // Send join message
        ws.send(JSON.stringify({
          type: 'join',
          user_id: user.id,
          token: token
        }));

        // Start heartbeat
        startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (err) {
          console.error('[ChatWS] Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[ChatWS] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[ChatWS] Disconnected');
        setIsConnected(false);
        stopHeartbeat();
        wsRef.current = null;

        // Attempt reconnect
        scheduleReconnect();
      };
    } catch (error) {
      console.error('[ChatWS] Connection error:', error);
      scheduleReconnect();
    }
  }, [user]);

  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      console.log('[ChatWS] Disconnecting...');
      wsRef.current.close();
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();
    setIsConnected(false);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    const backoffTime = Math.min(RECONNECT_INTERVAL * (reconnectAttempts + 1), 30000);
    
    console.log(`[ChatWS] Reconnecting in ${backoffTime}ms...`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      setReconnectAttempts(prev => prev + 1);
      connectWebSocket();
    }, backoffTime);
  }, [connectWebSocket, reconnectAttempts]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'pong' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const handleWebSocketMessage = useCallback((data) => {
    console.log('[ChatWS] Received message:', data);
    const { type } = data;

    switch (type) {
      case 'connected':
        console.log('[ChatWS] Connection confirmed');
        break;

      case 'new_message':
        console.log('[ChatWS] New message received:', data.message);
        handleNewMessage(data.message);
        break;

      case 'user_online':
        console.log('[ChatWS] User online:', data.user_id);
        handleUserOnline(data.user_id);
        break;

      case 'user_offline':
        console.log('[ChatWS] User offline:', data.user_id);
        handleUserOffline(data.user_id);
        break;

      case 'user_typing':
        console.log('[ChatWS] User typing:', data);
        handleTypingStatus(data.conversation_id, data.user_id, data.is_typing);
        break;

      case 'message_read':
        console.log('[ChatWS] Message read:', data);
        handleMessageRead(data.conversation_id, data.message_id, data.user_id);
        break;

      case 'conversation_update':
        console.log('[ChatWS] Conversation update:', data);
        handleConversationUpdate(data.conversation_id);
        break;

      case 'ping':
        // Respond to server ping
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'pong' }));
        }
        break;

      default:
        console.log('[ChatWS] Unknown message type:', type, data);
    }
  }, [
    handleNewMessage,
    handleUserOnline,
    handleUserOffline,
    handleTypingStatus,
    handleMessageRead,
    handleConversationUpdate
  ]);

  const sendTypingStatus = useCallback((conversationId, isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: isTyping
      }));
    }
  }, []);

  // ============ INITIALIZATION ============

  useEffect(() => {
    if (user) {
      loadConversations();
      loadAllUsers();
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [user, loadConversations, loadAllUsers, connectWebSocket, disconnectWebSocket]);

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
    
    // WebSocket state
    isConnected,
    reconnectAttempts,
    
    // Actions
    loadConversations,
    createConversation,
    selectConversation,
    loadMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    loadAllUsers,
    sendTypingStatus,
    
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
