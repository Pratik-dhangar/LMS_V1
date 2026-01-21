/**
 * Chat API Service
 * Handles all REST API calls for chat functionality
 */

import axiosInstance from '../../axios';

const CHAT_BASE_URL = '/chat';

export const chatApi = {
  // ============ USER OPERATIONS ============
  
  /**
   * Get all active users for chat
   */
  async getAllUsers() {
    const response = await axiosInstance.get(`${CHAT_BASE_URL}/users`);
    return response.data;
  },

  /**
   * Get currently online users
   */
  async getOnlineUsers() {
    const response = await axiosInstance.get(`${CHAT_BASE_URL}/online-users`);
    return response.data;
  },

  // ============ CONVERSATION OPERATIONS ============
  
  /**
   * Get all conversations for current user
   */
  async getConversations(skip = 0, limit = 50) {
    const response = await axiosInstance.get(`${CHAT_BASE_URL}/conversations`, {
      params: { skip, limit }
    });
    return response.data;
  },

  /**
   * Create new conversation (direct or group)
   */
  async createConversation(data) {
    const response = await axiosInstance.post(`${CHAT_BASE_URL}/conversations`, data);
    return response.data;
  },

  /**
   * Get conversation details by ID
   */
  async getConversation(conversationId) {
    const response = await axiosInstance.get(`${CHAT_BASE_URL}/conversations/${conversationId}`);
    return response.data;
  },

  /**
   * Add members to group conversation
   */
  async addMembers(conversationId, userIds) {
    const response = await axiosInstance.post(
      `${CHAT_BASE_URL}/conversations/${conversationId}/members`,
      { user_ids: userIds }
    );
    return response.data;
  },

  /**
   * Remove member from group conversation
   */
  async removeMember(conversationId, userId) {
    const response = await axiosInstance.delete(
      `${CHAT_BASE_URL}/conversations/${conversationId}/members`,
      { data: { user_id: userId } }
    );
    return response.data;
  },

  // ============ MESSAGE OPERATIONS ============
  
  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, skip = 0, limit = 50, beforeMessageId = null) {
    const params = { skip, limit };
    if (beforeMessageId) {
      params.before_message_id = beforeMessageId;
    }
    
    const response = await axiosInstance.get(
      `${CHAT_BASE_URL}/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  },

  /**
   * Send text message
   */
  async sendMessage(data) {
    const response = await axiosInstance.post(`${CHAT_BASE_URL}/messages`, data);
    return response.data;
  },

  /**
   * Send message with file attachment
   */
  async sendMessageWithFile(conversationId, file, content = null) {
    const formData = new FormData();
    formData.append('conversation_id', conversationId);
    formData.append('file', file);
    if (content) {
      formData.append('content', content);
    }

    const response = await axiosInstance.post(`${CHAT_BASE_URL}/messages/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId, messageIds = []) {
    const response = await axiosInstance.post(`${CHAT_BASE_URL}/messages/read`, {
      conversation_id: conversationId,
      message_ids: messageIds.length > 0 ? messageIds : null
    });
    return response.data;
  },
};

export default chatApi;
