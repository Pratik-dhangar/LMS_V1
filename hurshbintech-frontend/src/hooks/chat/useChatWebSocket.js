/**
 * Custom WebSocket Hook for Chat
 * Handles WebSocket connection with auto-reconnect and message handling
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/chat/ChatContext';

const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000')
  .trim()
  .replace(/^https:/, 'wss:')
  .replace(/^http:/, 'ws:')
  .replace(/\/+$/, '')
  .replace(/\/ws$/i, '');
const CHAT_WS_ENDPOINT = `${WS_URL}/api/chat/ws`;
const RECONNECT_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 30000;

export const useChatWebSocket = () => {
  const { user } = useAuth();
  const {
    handleNewMessage,
    handleUserOnline,
    handleUserOffline,
    handleTypingStatus,
    handleMessageRead,
    handleConversationUpdate,
  } = useChat();

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // ============ CONNECTION ============

  const connect = useCallback(() => {
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

  const disconnect = useCallback(() => {
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
      connect();
    }, backoffTime);
  }, [connect, reconnectAttempts]);

  // ============ HEARTBEAT ============

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

  // ============ MESSAGE HANDLING ============

  const handleWebSocketMessage = useCallback((data) => {
    const { type } = data;

    switch (type) {
      case 'connected':
        console.log('[ChatWS] Connection confirmed');
        break;

      case 'new_message':
        console.log('[ChatWS] New message:', data.message);
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
        handleTypingStatus(data.conversation_id, data.user_id, data.is_typing);
        break;

      case 'message_read':
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

  // ============ SEND MESSAGES ============

  const sendTypingStatus = useCallback((conversationId, isTyping) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: conversationId,
        is_typing: isTyping
      }));
    }
  }, []);

  // ============ LIFECYCLE ============

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected,
    sendTypingStatus,
    reconnectAttempts,
  };
};

export default useChatWebSocket;
