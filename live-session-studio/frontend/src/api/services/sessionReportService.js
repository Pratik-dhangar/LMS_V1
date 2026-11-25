const sessionReportService = {
  create: async (payload) => {
    console.log('[sessionReportService] saved report:', payload);
    return { status: 'saved', data: payload };
  },
  getReport: async (sessionId) => {
    return null;
  },
};

export default sessionReportService;
