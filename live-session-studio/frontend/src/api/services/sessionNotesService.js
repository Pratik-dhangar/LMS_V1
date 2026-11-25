import api from '../axios';

const sessionNotesService = {
  saveNotes: async (sessionId, notes) => {
    const text = typeof notes === 'string' ? notes : '';
    const res = await api.post(`/rooms/${sessionId}/notes`, { notes: text, content: text });
    return res.data;
  },

  getNotes: async (sessionId) => {
    const res = await api.get(`/rooms/${sessionId}/notes`);
    return res.data;
  },

  updateNotes: async (sessionId, notes) => {
    return sessionNotesService.saveNotes(sessionId, notes);
  },

  clearNotes: async (sessionId) => {
    const res = await api.delete(`/rooms/${sessionId}/notes`);
    return res.data;
  },

  forceSaveNotes: async (sessionId, notes) => {
    return sessionNotesService.saveNotes(sessionId, notes);
  },

  finalizeNotes: async (sessionId, notes = null) => {
    if (notes !== null) {
      await sessionNotesService.saveNotes(sessionId, notes);
    }
    return { status: 'finalized' };
  },
};

export default sessionNotesService;
