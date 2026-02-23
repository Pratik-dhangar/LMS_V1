import api from '../axios';

/**
 * programService — manages Programs (head-scoped, learner-scoped containers
 * that bundle locked goals with mutable learning content).
 *
 * All endpoints require a Head-authenticated token.
 */
const programService = {
  /**
   * Create a new program.
   * goal_ids are locked at creation; content_ids are mutable.
   *
   * @param {{ name: string, description?: string, learner_id: number, goal_ids: number[], content_ids: number[] }} data
   */
  createProgram: async (data) => {
    try {
      const response = await api.post('/head/programs/', data);
      return response.data;
    } catch (error) {
      console.error('[programService] Error creating program:', error);
      throw error;
    }
  },

  /**
   * List all active programs for the current head.
   * Pass learnerId to narrow the list to programs for a specific learner.
   *
   * @param {number|null} learnerId
   * @returns {Promise<Array>}
   */
  getPrograms: async (learnerId = null) => {
    try {
      const params = learnerId ? { learner_id: learnerId } : {};
      const response = await api.get('/head/programs/', { params });
      return response.data;
    } catch (error) {
      console.error('[programService] Error fetching programs:', error);
      throw error;
    }
  },

  /**
   * Get full details of a single program by ID.
   *
   * @param {number} programId
   */
  getProgramById: async (programId) => {
    try {
      const response = await api.get(`/head/programs/${programId}`);
      return response.data;
    } catch (error) {
      console.error('[programService] Error fetching program:', error);
      throw error;
    }
  },

  /**
   * Update a program's name, description, and/or content_ids.
   * goal_ids are intentionally not accepted here — they are locked.
   *
   * @param {number} programId
   * @param {{ name?: string, description?: string, content_ids?: number[] }} data
   */
  updateProgram: async (programId, data) => {
    try {
      const response = await api.patch(`/head/programs/${programId}`, data);
      return response.data;
    } catch (error) {
      console.error('[programService] Error updating program:', error);
      throw error;
    }
  },

  /**
   * Soft-delete a program (is_active = false).
   * Sessions that already reference it are not affected.
   *
   * @param {number} programId
   */
  deleteProgram: async (programId) => {
    try {
      const response = await api.delete(`/head/programs/${programId}`);
      return response.data;
    } catch (error) {
      console.error('[programService] Error deleting program:', error);
      throw error;
    }
  },
};

export default programService;
