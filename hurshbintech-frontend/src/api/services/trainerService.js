import api from '../axios';

const trainerService = {
  getIlpPermission: async () => {
    try {
      const res = await api.get('/trainer/settings');
      return res.data;
    } catch (err) {
      console.error('[trainerService] Error fetching ILP permission:', err);
      return { can_trainers_schedule_ilp: false };
    }
  },

  getLearnersForScheduling: async () => {
    try {
      const res = await api.get('/trainer/learners/for-session-scheduling');
      return res.data;
    } catch (err) {
      console.error('[trainerService] Error fetching learners for scheduling:', err);
      return [];
    }
  },
};

export default trainerService;
