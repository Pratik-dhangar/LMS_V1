import api from '../../axios';

export const chatApi = {
  async getMessages(roomId, skip = 0, limit = 50, beforeId = null) {
    const params = { limit };
    if (beforeId) params.before_id = beforeId;
    const response = await api.get(`/rooms/${roomId}/messages`, { params });
    return response.data;
  },

  async sendMessage(data) {
    const { room_id, conversation_id, content, message_type = 'text' } = data;
    const rid = room_id || conversation_id;
    const response = await api.post(`/rooms/${rid}/messages`, {
      content,
      message_type,
    });
    return response.data;
  },

  async uploadFile(roomId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/rooms/${roomId}/messages/file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async markAsRead(roomId, messageId) {
    const response = await api.post(`/rooms/${roomId}/messages/${messageId}/read`);
    return response.data;
  },

  async getConversations() {
    return [];
  },

  async getAllUsers() {
    return [];
  },

  async getOnlineUsers() {
    return [];
  },
};

export default chatApi;
