import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.com/api';
const COACH_API = `${API_BASE_URL}/coaches`;

// Get axios instance with auth token
const getAuthConfig = () => {
  const token = localStorage.getItem('access_token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// ============ COACH AVAILABILITY ============

export const updateCoachAvailability = async (payload) => {
  try {
    const response = await axios.patch(
      `${COACH_API}/availability`,
      null,
      {
        ...getAuthConfig(),
        params: {
          is_available: payload.is_available,
          unavailable_from: payload.unavailable_from,
          unavailable_until: payload.unavailable_until,
          unavailable_reason: payload.unavailable_reason,
          availability_days: payload.availability_days,
          time_slots: payload.time_slots,
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCoachAvailability = async () => {
  try {
    const response = await axios.get(
      `${COACH_API}/availability`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCoachAvailabilityPublic = async (coachId) => {
  try {
    const response = await axios.get(
      `${COACH_API}/availability/public/${coachId}`
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// ============ PROFILE PICTURE ============

export const uploadProfilePicture = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${COACH_API}/profile-picture/upload`,
      formData,
      {
        ...getAuthConfig(),
        headers: {
          ...getAuthConfig().headers,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// ============ APPOINTMENTS ============

export const createAppointment = async (appointmentData) => {
  try {
    const response = await axios.post(
      `${COACH_API}/appointments`,
      appointmentData,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCoachAppointments = async () => {
  try {
    const response = await axios.get(
      `${COACH_API}/appointments`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getAppointmentDetails = async (appointmentId) => {
  try {
    const response = await axios.get(
      `${COACH_API}/appointments/${appointmentId}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateAppointment = async (appointmentId, updateData) => {
  try {
    const response = await axios.patch(
      `${COACH_API}/appointments/${appointmentId}`,
      updateData,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const deleteAppointment = async (appointmentId) => {
  try {
    const response = await axios.delete(
      `${COACH_API}/appointments/${appointmentId}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// ============ SESSIONS ============

export const createSession = async (sessionData) => {
  try {
    const response = await axios.post(
      `${COACH_API}/sessions`,
      sessionData,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getCoachSessions = async () => {
  try {
    const response = await axios.get(
      `${COACH_API}/sessions`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getSessionDetails = async (sessionId) => {
  try {
    const response = await axios.get(
      `${COACH_API}/sessions/${sessionId}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateSession = async (sessionId, updateData) => {
  try {
    const response = await axios.patch(
      `${COACH_API}/sessions/${sessionId}`,
      updateData,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const deleteSession = async (sessionId) => {
  try {
    const response = await axios.delete(
      `${COACH_API}/sessions/${sessionId}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// ============ SESSION PARTICIPANTS ============

export const addSessionParticipant = async (sessionId, participantData) => {
  try {
    const response = await axios.post(
      `${COACH_API}/sessions/${sessionId}/participants`,
      participantData,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const updateParticipantStatus = async (sessionId, userId, status) => {
  try {
    const response = await axios.patch(
      `${COACH_API}/sessions/${sessionId}/participants/${userId}`,
      null,
      {
        ...getAuthConfig(),
        params: { status },
      }
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const removeSessionParticipant = async (sessionId, userId) => {
  try {
    const response = await axios.delete(
      `${COACH_API}/sessions/${sessionId}/participants/${userId}`,
      getAuthConfig()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
