import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getAuthHeader = () => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
};

const sessionNotesService = {
    /**
     * Create or update session notes (auto-save)
     * @param {string} sessionId - Session ID
     * @param {string} notes - Notes content
     * @returns {Promise} Response with saved notes
     */
    saveNotes: async (sessionId, notes) => {
        try {
            const response = await axios.post(
                `${API_URL}/session-notes/${sessionId}`,
                { notes },
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('Error saving session notes:', error);
            throw error;
        }
    },

    /**
     * Get session notes
     * @param {string} sessionId - Session ID
     * @returns {Promise} Response with notes
     */
    getNotes: async (sessionId) => {
        try {
            const response = await axios.get(
                `${API_URL}/session-notes/${sessionId}`,
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching session notes:', error);
            throw error;
        }
    },

    /**
     * Update session notes
     * @param {string} sessionId - Session ID
     * @param {string} notes - Notes content
     * @returns {Promise} Response with updated notes
     */
    updateNotes: async (sessionId, notes) => {
        try {
            const response = await axios.put(
                `${API_URL}/session-notes/${sessionId}`,
                { notes },
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('Error updating session notes:', error);
            throw error;
        }
    },

    /**
     * Get session notes by internal session ID (for Head)
     * @param {number} sessionInternalId - Internal session ID
     * @returns {Promise} Response with notes
     */
    getNotesByInternalId: async (sessionInternalId) => {
        try {
            const response = await axios.get(
                `${API_URL}/session-notes/by-session-internal/${sessionInternalId}`,
                { headers: getAuthHeader() }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching session notes by internal ID:', error);
            throw error;
        }
    }
};

export default sessionNotesService;
