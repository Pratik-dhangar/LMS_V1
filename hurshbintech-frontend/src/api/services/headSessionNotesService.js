import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const getAuthHeader = () => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
};

const headSessionNotesService = {
    saveHeadNotes: async (sessionId, notes) => {
        try {
            const response = await axios.post(
                `${API_URL}/head-session-notes/${sessionId}`,
                { notes },
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('[headSessionNotesService] Error saving head notes:', error);
            throw error;
        }
    },

    getHeadNotes: async (sessionId) => {
        try {
            const response = await axios.get(
                `${API_URL}/head-session-notes/${sessionId}`,
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('[headSessionNotesService] Error fetching head notes:', error);
            throw error;
        }
    }
};

export default headSessionNotesService;
