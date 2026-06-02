import api from '../axios';

const contactService = {
    // Public endpoint - Submit contact form
    submitContact: async (contactData) => {
        const response = await api.post('/contacts', {
            parent_name: contactData.parent_name,
            child_name: contactData.child_name?.trim() || null,
            child_age: contactData.child_age?.trim() || null,
            address: contactData.address?.trim() || null,
            email: contactData.email,
            phone: contactData.phone || '',
            message: contactData.message,
        });
        return response.data;
    },

    // Public endpoint - Submit free assessment form
    submitFreeAssessment: async (assessmentData) => {
        const response = await api.post('/free-assessments', assessmentData);
        return response.data;
    },

    // Public endpoint - Submit free appointment form
    submitFreeAppointment: async (appointmentData) => {
        const response = await api.post('/free-appointments-form', {
            child_name: appointmentData.child_name,
            age: parseInt(appointmentData.age, 10),
            concerns: appointmentData.concerns?.trim() || null,
            diagnosis: appointmentData.diagnosis?.trim() || null,
            address: appointmentData.address?.trim() || null,
            contact_number: appointmentData.contact_number,
            reference_by: appointmentData.reference_by?.trim() || null,
        });
        return response.data;
    },

    // Admin endpoints - Get all contacts with filters
    getAdminContacts: async (skip = 0, limit = 10, filters = {}) => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
        });

        if (filters.status) {
            params.append('status', filters.status);
        }
        if (filters.search) {
            params.append('search', filters.search);
        }
        if (filters.unresolved_only) {
            params.append('unresolved_only', 'true');
        }

        const response = await api.get(`/admin/contacts?${params.toString()}`);
        return response.data;
    },

    // Admin endpoint - Get contact statistics
    getContactStats: async () => {
        const response = await api.get('/admin/contacts/stats');
        return response.data;
    },

    // Admin endpoints - Free assessment previews
    getAdminFreeAssessments: async (skip = 0, limit = 10, search = '') => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
        });

        if (search) {
            params.append('search', search);
        }

        const response = await api.get(`/admin/free-assessments?${params.toString()}`);
        return response.data;
    },

    getAdminFreeAssessmentDetail: async (assessmentId) => {
        const response = await api.get(`/admin/free-assessments/${assessmentId}`);
        return response.data;
    },

    // Admin endpoint - Get specific contact
    getContactDetail: async (contactId) => {
        const response = await api.get(`/admin/contacts/${contactId}`);
        return response.data;
    },

    // Admin endpoint - Update contact
    updateContact: async (contactId, updateData) => {
        const response = await api.patch(`/admin/contacts/${contactId}`, {
            status: updateData.status || undefined,
            admin_notes: updateData.admin_notes || undefined,
            is_resolved: updateData.is_resolved !== undefined ? updateData.is_resolved : undefined,
        });
        return response.data;
    },

    // Admin endpoint - Delete contact
    deleteContact: async (contactId) => {
        try {
            const response = await api.delete(`/admin/contacts/${contactId}`);
            return { success: true };
        } catch (error) {
            console.error('Delete contact error:', error);
            throw error;
        }
    },

    // Helper to mark contact as replied
    markAsReplied: async (contactId, adminNotes) => {
        return contactService.updateContact(contactId, {
            status: 'replied',
            admin_notes: adminNotes,
            is_resolved: true,
        });
    },

    // Helper to mark contact as resolved without changing status
    markAsResolved: async (contactId) => {
        return contactService.updateContact(contactId, {
            is_resolved: true,
        });
    },

    // Helper to archive contact
    archiveContact: async (contactId) => {
        return contactService.updateContact(contactId, {
            status: 'archived',
        });
    },
};

export default contactService;
