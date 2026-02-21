import axiosInstance from '../axios';

/**
 * Public Subscription Inquiry Service
 * Handles landing-page subscription inquiry form API calls.
 * No authentication is required for public endpoints.
 */
const publicSubscriptionService = {
    /**
     * Fetch all active subscription packages for the landing-page form dropdown.
     * @returns {Promise<Array>} list of active SubscriptionPackage objects
     */
    getPublicPackages: async () => {
        try {
            const response = await axiosInstance.get('/subscription-packages/public');
            return response.data || [];
        } catch (error) {
            console.error('Error fetching public packages:', error);
            return [];
        }
    },

    /**
     * Submit a subscription purchase inquiry from the landing page.
     * Uses multipart/form-data so the payment receipt file can be included.
     *
     * @param {Object} formData  - Inquiry fields
     * @param {File|null} receiptFile  - Optional payment receipt file
     * @returns {Promise<Object>} Created inquiry record
     */
    submitInquiry: async (formData, receiptFile = null) => {
        const data = new FormData();

        // Personal details
        data.append('learner_name', formData.learner_name || '');
        data.append('email', formData.email || '');
        data.append('contact_number', formData.contact_number || '');
        if (formData.age !== '' && formData.age !== null && formData.age !== undefined) {
            data.append('age', formData.age);
        }
        if (formData.date_of_birth) data.append('date_of_birth', formData.date_of_birth);
        if (formData.date_of_assessment) data.append('date_of_assessment', formData.date_of_assessment);

        // Package & payment
        if (formData.package_id) data.append('package_id', formData.package_id);
        if (formData.package_name) data.append('package_name', formData.package_name);
        if (formData.package_price) data.append('package_price', formData.package_price);
        if (formData.payment_method) data.append('payment_method', formData.payment_method);

        // Receipt file
        if (receiptFile) data.append('payment_receipt', receiptFile);

        const response = await axiosInstance.post('/subscription-inquiries', data);
        return response.data;
    },

    // ─── Admin endpoints ───────────────────────────────────────────────────────

    /**
     * Admin: list all subscription inquiries.
     * @param {Object} params  - Optional filters { review_status, skip, limit }
     */
    getAdminInquiries: async (params = {}) => {
        const response = await axiosInstance.get('/admin/subscription-inquiries', { params });
        return response.data || [];
    },

    /**
     * Admin: update review status / notes for a specific inquiry.
     */
    updateInquiry: async (inquiryId, updateData) => {
        const response = await axiosInstance.patch(
            `/admin/subscription-inquiries/${inquiryId}`,
            updateData,
        );
        return response.data;
    },

    /**
     * Admin: delete a subscription inquiry from the database.
     */
    deleteInquiry: async (inquiryId) => {
        const response = await axiosInstance.delete(
            `/admin/subscription-inquiries/${inquiryId}`,
        );
        return response.data;
    },

    /**
     * Admin: trigger CSV export download.
     * Opens the export URL in a new tab – the browser handles the file download.
     */
    exportCsv: async (reviewStatus = null) => {
        const baseURL =
            import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
        const token = localStorage.getItem('access_token');
        let url = `${baseURL}/admin/subscription-inquiries/export`;
        if (reviewStatus) url += `?review_status=${reviewStatus}`;

        // Use fetch so we can attach the auth header and trigger a proper download
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('CSV export failed');

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        const now = new Date();
        const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
            now.getDate(),
        ).padStart(2, '0')}`;
        link.download = `subscription_inquiries_${stamp}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
    },
};

export default publicSubscriptionService;
