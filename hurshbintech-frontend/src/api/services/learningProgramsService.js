import axiosInstance from "../axios";

const learningProgramsService = {
  // ✅ Get all programs (learning_goals created by admin)
  getAllPrograms: async () => {
    const res = await axiosInstance.get("/learning-goals/head");
    return res.data;
  },

  // ✅ Assign multiple programs to learner
  assignPrograms: async (data) => {
    const res = await axiosInstance.post("/head/assign-learning-programs", data);
    return res.data;
  },

  // ✅ Get assigned programs per learner (Head view)
  getAssignedPrograms: async (learnerId) => {
    const res = await axiosInstance.get(`/head/assigned-learning-programs/${learnerId}`);
    return res.data;
  },

  // ✅ Remove assigned program
  removeAssignedProgram: async (assignedId) => {
    const res = await axiosInstance.delete(`/head/assigned-learning-program/${assignedId}`);
    return res.data;
  },

  // ✅ Final: learner assigned programs list
  getAssignedProgramsForLearner: async () => {
    const res = await axiosInstance.get("/learner/my-learning-programs");
    return res.data;
  },

  // ✅ Program details (Learner side)
  getProgramDetails: async (assigned_id) => {
    const res = await axiosInstance.get(`/learner/my-learning-program/details/${assigned_id}`);
    return res.data;
  },

};

export default learningProgramsService;
