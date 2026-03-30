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
    },
    head: {
        getAll: async () => {
            const response = await api.get("/learning-skills/head");
            return response.data;
        },
    },
};

export default learningSkillsService;
