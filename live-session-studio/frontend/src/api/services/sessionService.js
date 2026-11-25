import api from '../axios';

const sessionService = {
  getSessionDetails: async (sessionId) => {
    const response = await api.get(`/rooms/${sessionId}`);
    return response.data;
  },

  joinSession: async (sessionId) => {
    const response = await api.post(`/rooms/${sessionId}/join`);
    return response.data;
  },

  leaveSession: async (sessionId) => {
    const response = await api.post(`/rooms/${sessionId}/leave`);
    return response.data;
  },

  endSession: async (sessionId, notes = '') => {
    const response = await api.post(`/rooms/${sessionId}/end`, { notes });
    return response.data;
  },

  submitFeedback: async (sessionId, { rating, remark }) => {
    const response = await api.post(`/rooms/${sessionId}/feedback`, {
      rating: parseInt(rating, 10),
      remark: remark || null,
    });
    return response.data;
  },

  uploadRecordingChunk: async (formData) => {
    const response = await api.post('/recordings/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  finalizeRecording: async (finalizationData) => {
    const response = await api.post(
      `/recordings/${finalizationData.get ? finalizationData.get('recording_id') : finalizationData.recording_id}/finalize`,
      finalizationData
    );
    return response.data;
  },

  getRecordingStatus: async (recordingId) => {
    const response = await api.get(`/recordings/${recordingId}/status`);
    return response.data;
  },
};

export default sessionService;
