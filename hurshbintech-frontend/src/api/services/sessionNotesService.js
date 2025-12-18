import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

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
            console.log('[SessionNotes] Saving notes for session:', sessionId, 'Content length:', notes?.length || 0);
            const response = await axios.post(
                `${API_URL}/session-notes/${sessionId}`,
                { notes },
                { headers: getAuthHeader() }
            );
            console.log('[SessionNotes] ✅ Notes saved successfully for session:', sessionId);
            return response.data;
        } catch (error) {
            console.error('[SessionNotes] ❌ Error saving session notes:', error);
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
    },

    /**
     * Clear session notes (delete content and reset)
     * @param {string} sessionId - Session ID
     * @returns {Promise} Response after clearing
     */
    clearNotes: async (sessionId) => {
        try {
            console.log('[SessionNotes] Clearing notes for session:', sessionId);
            const response = await axios.post(
                `${API_URL}/session-notes/${sessionId}`,
                { notes: '' },
                { headers: getAuthHeader() }
            );
            console.log('[SessionNotes] ✅ Notes cleared successfully for session:', sessionId);
            return response.data;
        } catch (error) {
            console.error('[SessionNotes] ❌ Error clearing notes:', error);
            throw error;
        }
    },

    /**
     * Force save notes on disconnect recovery (bypass debounce)
     * @param {string} sessionId - Session ID
     * @param {string} notes - Notes content
     * @returns {Promise} Response with saved notes
     */
    forceSaveNotes: async (sessionId, notes) => {
        try {
            console.log('[SessionNotes] ⚠️ Force-saving notes for session (disconnect recovery):', sessionId);
            const response = await axios.post(
                `${API_URL}/session-notes/${sessionId}/force-save`,
                { notes },
                { headers: getAuthHeader() }
            );
            console.log('[SessionNotes] ✅ Notes force-saved successfully:', sessionId);
            return response.data;
        } catch (error) {
            console.error('[SessionNotes] ❌ Error force-saving notes:', error);
            throw error;
        }
    },

    /**
     * Finalize notes when session ends
     * @param {string} sessionId - Session ID
     * @param {string} notes - Optional final notes content
     * @returns {Promise} Response after finalization
     */
    finalizeNotes: async (sessionId, notes = null) => {
        try {
            console.log('[SessionNotes] Finalizing notes for session:', sessionId);
            const response = await axios.post(
                `${API_URL}/session-notes/${sessionId}/finalize`,
                { notes },
                { headers: getAuthHeader() }
            );
            console.log('[SessionNotes] ✅ Notes finalized successfully for session:', sessionId);
            return response.data;
        } catch (error) {
            console.error('[SessionNotes] ❌ Error finalizing notes:', error);
            throw error;
        }
    }
};

export default sessionNotesService;
