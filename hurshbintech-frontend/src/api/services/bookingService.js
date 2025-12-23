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

  /**
   * Get available time slots for a coach on a specific date
   * @param {number} coachId - ID of the coach
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Object>} Available slots data
   */
  async getAvailableSlots(coachId, date) {
    try {
      const response = await api.get(`/booking/slots/${coachId}`, {
        params: { date }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw error;
    }
  },

  // === Guest Booking Flow Methods ===

  /**
   * Send OTP to guest email for verification
   * @param {Object} payload - { email: string }
   * @returns {Promise<Object>} Confirmation message
   */
  async sendGuestOTP(payload) {
    try {
      const response = await api.post('/booking/guest/send-otp', payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Verify OTP (Step 1 verification - doesn't mark as used)
   * @param {Object} payload - { email: string, otp: string }
   * @returns {Promise<Object>} Verification confirmation
   */
  async verifyGuestOTP(payload) {
    try {
      const formData = new FormData();
      formData.append('email', payload.email);
      formData.append('otp', payload.otp);
      
      const response = await api.post('/booking/guest/verify-otp', formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /**
   * Verify OTP and create guest booking intent
   * @param {string} email - Guest email
   * @param {FormData} formData - Form data with OTP and booking details
   * @returns {Promise<Object>} Created appointment details
   */
  async createGuestIntent(email, formData) {
    try {
      formData.append('email', email);
      const response = await api.post('/booking/guest/verify-otp-and-create-intent', formData);
      return response.data;
    } catch (error) {
      console.error('Error creating guest intent:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Upload payment receipt with token
   * @param {string} uploadToken - Upload token from email link
   * @param {File} file - Payment receipt file
   * @returns {Promise<Object>} Upload confirmation
   */
  async uploadGuestPayment(uploadToken, file) {
    try {
      const formData = new FormData();
      formData.append('payment_screenshot', file);
      
      const response = await api.post(
        `/booking/guest/upload-payment/${uploadToken}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error uploading payment:', error);
      throw error.response?.data || error;
    }
  },

  /**
   * Validate payment token (check if it's valid and not expired)
   * @param {string} uploadToken - Upload token to validate
   * @returns {Promise<Object>} Appointment details if valid
   */
  async validatePaymentToken(uploadToken) {
    try {
      const response = await api.get(`/booking/guest/validate-token/${uploadToken}`);
      return response.data;
    } catch (error) {
      console.error('Error validating token:', error);
      throw error.response?.data || error;
    }
  },
};

export default bookingService;
