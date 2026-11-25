import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import chatApi from '../../api/services/chat/chatApi';

const ChatContext = createContext(null);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(true);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const msgs = await chatApi.getMessages(conversationId);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: msgs || [],
      }));
    } catch (err) {
      console.error('Failed to load chat messages', err);
    }
  }, []);

  const sendMessage = useCallback(async (data) => {
    try {
      const sent = await chatApi.sendMessage(data);
      const convId = data.room_id || data.conversation_id;
      if (convId) {
        setMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), sent],
        }));
      }
      return sent;
    } catch (err) {
      console.error('Failed to send message', err);
      throw err;
    }
  }, []);

  const uploadFile = useCallback(async (conversationId, file) => {
    try {
      const sent = await chatApi.uploadFile(conversationId, file);
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), sent],
      }));
      return sent;
    } catch (err) {
      console.error('Failed to upload chat file', err);
      throw err;
    }
  }, []);

  const markAsRead = useCallback(async (conversationId, msgId) => {
    if (!conversationId || !msgId) return;
    try {
      await chatApi.markAsRead(conversationId, msgId);
    } catch (_) {}
  }, []);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        setConversations,
        currentConversation,
        setCurrentConversation,
        messages,
        setMessages,
        onlineUsers,
        typingUsers,
        unreadCounts,
        allUsers,
        loading,
        error,
        isConnected,
        loadMessages,
        sendMessage,
        uploadFile,
        markAsRead,
        totalUnreadCount: 0,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
