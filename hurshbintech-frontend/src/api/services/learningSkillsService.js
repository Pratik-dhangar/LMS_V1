import api from "../axios";

const learningSkillsService = {
    admin: {
        create: async (skillData) => {
            const response = await api.post("/learning-skills/admin", skillData);
            return response.data;
        },
        getAll: async () => {
            const response = await api.get("/learning-skills/admin");
            return response.data;
        },
        update: async (skillId, skillData) => {
            const response = await api.patch(`/learning-skills/admin/${skillId}`, skillData);
            return response.data;
        },
        delete: async (skillId) => {
            await api.delete(`/learning-skills/admin/${skillId}`);
        },
    },
    head: {
        getAll: async () => {
            const response = await api.get("/learning-skills/head");
            return response.data;
        },
    },
};

export default learningSkillsService;
