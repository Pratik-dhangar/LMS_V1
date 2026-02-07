import api from '../axios';

const headSessionNotesService = {
    saveHeadNotes: async (sessionId, notes) => {
        try {
            const response = await api.post(
                `/head-session-notes/${sessionId}`,
                { notes }
            );
            return response.data;
        } catch (error) {
            console.error('[headSessionNotesService] Error saving head notes:', error);
            throw error;
        }
    },

    getHeadNotes: async (sessionId) => {
        try {
            const response = await api.get(
                `/head-session-notes/${sessionId}`
            );
            return response.data;
        } catch (error) {
            console.error('[headSessionNotesService] Error fetching head notes:', error);
            throw error;
        }
    }
};

export default headSessionNotesService;
