import api from '../axios';

const bookingService = {
  /**
   * Get all available coaches for appointment booking
   * @returns {Promise<Array>} List of available coaches
   */
  async getAvailableCoaches() {
    try {
      const response = await api.get('/booking/available-coaches');
      return response.data;
    } catch (error) {
      console.error('Error fetching available coaches:', error);
      throw error;
    }
  },

  /**
   * Book an appointment with a coach
   * @param {FormData} appointmentData - Form data containing appointment details and payment screenshot
   * @returns {Promise<Object>} Created appointment details
   */
  async bookAppointment(appointmentData) {
    try {
      const response = await api.post('/booking/book-appointment', appointmentData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw error;
    }
  },

  /**
   * Get all appointments booked by the current user
   * @returns {Promise<Array>} List of user's appointments
   */
  async getMyAppointments() {
    try {
      const response = await api.get('/booking/my-appointments');
      return response.data;
    } catch (error) {
      console.error('Error fetching my appointments:', error);
      throw error;
    }
  },
};

export default bookingService;
