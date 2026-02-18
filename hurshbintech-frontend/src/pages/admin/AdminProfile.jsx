import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    User, Mail, Phone, Grid3x3, Plus, Edit3, Trash2, ToggleLeft, ToggleRight,
    AlertCircle, Search, ChevronDown, X, Save, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import vendorService from '../../api/services/vendorService';
import '../../styles/admin/AdminProfile.css';

const AdminProfile = () => {
    const { user: adminUser, updateUserInfo } = useAuth();
    const navigate = useNavigate();

    // State for admin profile
    const [adminInfo, setAdminInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingAdmin, setEditingAdmin] = useState(false);
    const [adminFormData, setAdminFormData] = useState({
        name: '',
        email: '',
        contact_number: '',
    });

    // State for vendors
    const [vendors, setVendors] = useState([]);
    const [vendorLoading, setVendorLoading] = useState(false);
    const [vendorError, setVendorError] = useState('');

    // State for form
    const [showAddVendorForm, setShowAddVendorForm] = useState(false);
    const [editingVendorId, setEditingVendorId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        contact_number: '',
        company_name: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
        website: '',
        tax_id: '',
    });

    // State for search and filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredVendors, setFilteredVendors] = useState([]);
    const [activeTab, setActiveTab] = useState('profile');

    // Fetch admin profile and vendors on mount
    useEffect(() => {
        fetchAdminProfile();
        fetchVendors();
    }, []);

    // Filter vendors based on search
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredVendors(vendors);
        } else {
            const searchLower = searchQuery.toLowerCase();
            const filtered = vendors.filter((vendor) =>
                vendor.name.toLowerCase().includes(searchLower) ||
                vendor.email.toLowerCase().includes(searchLower) ||
                vendor.contact_number.includes(searchLower) ||
                (vendor.company_name && vendor.company_name.toLowerCase().includes(searchLower))
            );
            setFilteredVendors(filtered);
        }
    }, [searchQuery, vendors]);

    const fetchAdminProfile = async () => {
        try {
            setLoading(true);
            // Fetch admin profile from API to get the latest data
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/profile/me/user`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch admin profile');
            }

            const data = await response.json();
            const adminData = data || data;

            setAdminInfo(adminData);
            setAdminFormData({
                name: adminData.name || '',
                email: adminData.email || '',
                contact_number: adminData.contact_number || '',
            });
        } catch (error) {
            console.error('Error fetching admin profile:', error);
            // Fallback to AuthContext data if API fails
            if (adminUser) {
                setAdminInfo(adminUser);
                setAdminFormData({
                    name: adminUser.name || '',
                    email: adminUser.email || '',
                    contact_number: adminUser.contact_number || '',
                });
            }
            toast.error('Failed to load admin profile');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            setVendorLoading(true);
            setVendorError('');
            const data = await vendorService.getAllVendors(0, 100, false);
            setVendors(data);
        } catch (error) {
            console.error('Error fetching vendors:', error);
            setVendorError('Failed to load vendors');
            toast.error('Failed to load vendors');
        } finally {
            setVendorLoading(false);
        }
    };

    const handleAdminFormChange = (e) => {
        const { name, value } = e.target;
        setAdminFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleUpdateAdminProfile = async (e) => {
        e.preventDefault();

        // Validation
        if (!adminFormData.name || !adminFormData.email) {
            toast.error('Name and Email are required');
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/profile/admin/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(adminFormData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update admin profile');
            }

            const updatedAdmin = await response.json();
            setAdminInfo(updatedAdmin);
            setAdminFormData({
                name: updatedAdmin.name || '',
                email: updatedAdmin.email || '',
                contact_number: updatedAdmin.contact_number || '',
            });
            setEditingAdmin(false);

            // Update auth context
            if (updateUserInfo) {
                updateUserInfo(updatedAdmin);
            }

            toast.success('Admin profile updated successfully');
        } catch (error) {
            console.error('Error updating admin profile:', error);
            toast.error(error.message || 'Failed to update admin profile');
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            contact_number: '',
            company_name: '',
            address: '',
            city: '',
            state: '',
            country: '',
            postal_code: '',
            website: '',
            tax_id: '',
        });
        setEditingVendorId(null);
        setShowAddVendorForm(false);
    };

    const handleAddVendor = () => {
        setEditingVendorId(null);
        resetForm();
        setShowAddVendorForm(true);
    };

    const handleEditVendor = (vendor) => {
        setFormData({
            name: vendor.name,
            email: vendor.email,
            contact_number: vendor.contact_number,
            company_name: vendor.company_name || '',
            address: vendor.address || '',
            city: vendor.city || '',
            state: vendor.state || '',
            country: vendor.country || '',
            postal_code: vendor.postal_code || '',
            website: vendor.website || '',
            tax_id: vendor.tax_id || '',
        });
        setEditingVendorId(vendor.id);
        setShowAddVendorForm(true);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.name || !formData.email || !formData.contact_number) {
            toast.error('Name, Email, and Contact Number are required');
            return;
        }

        try {
            if (editingVendorId) {
                const updatedVendor = await vendorService.updateVendor(editingVendorId, formData);
                setVendors((prev) =>
                    prev.map((v) => (v.id === editingVendorId ? updatedVendor : v))
                );
                toast.success('Vendor updated successfully');
            } else {
                const newVendor = await vendorService.createVendor(formData);
                setVendors((prev) => [...prev, newVendor]);
                toast.success('Vendor created successfully');
            }
            resetForm();
        } catch (error) {
            console.error('Error saving vendor:', error);
            toast.error(error.detail || 'Failed to save vendor');
        }
    };

    const handleDeleteVendor = async (vendorId) => {
        if (!window.confirm('Are you sure you want to delete this vendor?')) {
            return;
        }

        try {
            await vendorService.deleteVendor(vendorId);
            setVendors((prev) => prev.filter((v) => v.id !== vendorId));
            toast.success('Vendor deleted successfully');
        } catch (error) {
            console.error('Error deleting vendor:', error);
            toast.error(error.detail || 'Failed to delete vendor');
        }
    };

    const handleToggleVendorStatus = async (vendorId) => {
        try {
            const updatedVendor = await vendorService.toggleVendorStatus(vendorId);
            setVendors((prev) =>
                prev.map((v) => (v.id === vendorId ? updatedVendor : v))
            );
            toast.success(`Vendor ${updatedVendor.is_active ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
            console.error('Error toggling vendor status:', error);
            toast.error(error.detail || 'Failed to toggle vendor status');
        }
    };

    if (loading) {
        return (
            <div className="admin-profile-container">
                <div className="admin-loading">
                    <div className="admin-loading-spinner" style={{ borderTopColor: '#db9d32' }}></div>
                </div>
                <p className="admin-loading-text" style={{ textAlign: 'center', marginTop: '1rem' }}>Loading admin profile...</p>
            </div>
        );
    }

    return (
        <div className="admin-profile-container">
            <main className="admin-profile-main">
                <div className="admin-profile-wrapper">
                    {/* Header */}
                    <div className="admin-profile-header">
                        <h1 className="admin-profile-title">Admin Profile</h1>
                        <p className="admin-profile-subtitle">Manage your profile and vendors</p>
                    </div>

                    {/* Tabs */}
                    <div className="admin-profile-tabs">
                        <button
                            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            <User size={20} />
                            Profile Info
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'vendors' ? 'active' : ''}`}
                            onClick={() => setActiveTab('vendors')}
                        >
                            <Grid3x3 size={20} />
                            Vendors ({vendors.length})
                        </button>
                    </div>

                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="admin-profile-content">
                            <div className="profile-card">
                                <div className="profile-header-section">
                                    <div className="profile-avatar">
                                        <User size={64} />
                                    </div>
                                    <div className="profile-info">
                                        <h2 className="profile-name">{adminInfo?.name}</h2>
                                        <p className="profile-role">{adminInfo?.role?.toUpperCase()}</p>
                                    </div>
                                </div>

                                {!editingAdmin ? (
                                    <>
                                        <div className="profile-details">
                                            <div className="profile-detail-item">
                                                <span className="detail-label">
                                                    <Mail size={20} />
                                                    Email
                                                </span>
                                                <span className="detail-value">{adminInfo?.email}</span>
                                            </div>
                                            <div className="profile-detail-item">
                                                <span className="detail-label">
                                                    <Phone size={20} />
                                                    Contact Number
                                                </span>
                                                <span className="detail-value">{adminInfo?.contact_number || 'Not provided'}</span>
                                            </div>
                                            <div className="profile-detail-item">
                                                <span className="detail-label">
                                                    <Grid3x3 size={20} />
                                                    Total Vendors
                                                </span>
                                                <span className="detail-value">{vendors.length}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="btn-edit-profile"
                                            onClick={() => setEditingAdmin(true)}
                                        >
                                            <Edit3 size={20} />
                                            Edit Profile
                                        </button>
                                    </>
                                ) : (
                                    <form onSubmit={handleUpdateAdminProfile} className="admin-edit-form">
                                        <div className="form-section">
                                            <h4>Update Admin Information</h4>
                                            <div className="form-grid">
                                                <div className="form-group">
                                                    <label htmlFor="admin_name">Name</label>
                                                    <input
                                                        type="text"
                                                        id="admin_name"
                                                        name="name"
                                                        value={adminFormData.name}
                                                        onChange={handleAdminFormChange}
                                                        required
                                                        className="form-input"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="admin_email">Email</label>
                                                    <input
                                                        type="email"
                                                        id="admin_email"
                                                        name="email"
                                                        value={adminFormData.email}
                                                        onChange={handleAdminFormChange}
                                                        required
                                                        className="form-input"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label htmlFor="admin_contact">Contact Number</label>
                                                    <input
                                                        type="tel"
                                                        id="admin_contact"
                                                        name="contact_number"
                                                        value={adminFormData.contact_number}
                                                        onChange={handleAdminFormChange}
                                                        className="form-input"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button type="submit" className="btn-save">
                                                <Check size={20} />
                                                Save Changes
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-cancel"
                                                onClick={() => setEditingAdmin(false)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Vendors Tab */}
                    {activeTab === 'vendors' && (
                        <div className="admin-vendors-content">
                            {/* Add Vendor Button and Search */}
                            <div className="vendors-toolbar">
                                <div className="search-container">
                                    <Search size={20} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search vendors by name, email, or contact..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                                <button
                                    className="btn-add-vendor"
                                    onClick={handleAddVendor}
                                    disabled={showAddVendorForm}
                                >
                                    <Plus size={20} />
                                    Add Vendor
                                </button>
                            </div>

                            {/* Add/Edit Vendor Form */}
                            {showAddVendorForm && (
                                <div className="vendor-form-container">
                                    <div className="vendor-form-card">
                                        <div className="vendor-form-header">
                                            <h3>{editingVendorId ? 'Edit Vendor' : 'Add New Vendor'}</h3>
                                            <button
                                                className="btn-close-form"
                                                onClick={resetForm}
                                            >
                                                <X size={24} />
                                            </button>
                                        </div>

                                        <form onSubmit={handleSubmitForm} className="vendor-form">
                                            {/* Required Fields */}
                                            <div className="form-section">
                                                <h4>Required Information</h4>
                                                <div className="form-grid">
                                                    <div className="form-group">
                                                        <label htmlFor="name">Vendor Name *</label>
                                                        <input
                                                            type="text"
                                                            id="name"
                                                            name="name"
                                                            value={formData.name}
                                                            onChange={handleFormChange}
                                                            required
                                                            placeholder="Enter vendor name"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="email">Email *</label>
                                                        <input
                                                            type="email"
                                                            id="email"
                                                            name="email"
                                                            value={formData.email}
                                                            onChange={handleFormChange}
                                                            required
                                                            placeholder="Enter vendor email"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="contact_number">Contact Number *</label>
                                                        <input
                                                            type="tel"
                                                            id="contact_number"
                                                            name="contact_number"
                                                            value={formData.contact_number}
                                                            onChange={handleFormChange}
                                                            required
                                                            placeholder="Enter contact number"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Optional Fields */}
                                            <div className="form-section">
                                                <h4>Business Information (Optional)</h4>
                                                <div className="form-grid">
                                                    <div className="form-group">
                                                        <label htmlFor="company_name">Company Name</label>
                                                        <input
                                                            type="text"
                                                            id="company_name"
                                                            name="company_name"
                                                            value={formData.company_name}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter company name"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="website">Website</label>
                                                        <input
                                                            type="url"
                                                            id="website"
                                                            name="website"
                                                            value={formData.website}
                                                            onChange={handleFormChange}
                                                            placeholder="https://example.com"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="tax_id">GST No.</label>
                                                        <input
                                                            type="text"
                                                            id="tax_id"
                                                            name="tax_id"
                                                            value={formData.tax_id}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter GST No. "
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Address Fields */}
                                            <div className="form-section">
                                                <h4>Address (Optional)</h4>
                                                <div className="form-grid">
                                                    <div className="form-group form-full">
                                                        <label htmlFor="address">Street Address</label>
                                                        <input
                                                            type="text"
                                                            id="address"
                                                            name="address"
                                                            value={formData.address}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter street address"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="city">City</label>
                                                        <input
                                                            type="text"
                                                            id="city"
                                                            name="city"
                                                            value={formData.city}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter city"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="state">State</label>
                                                        <input
                                                            type="text"
                                                            id="state"
                                                            name="state"
                                                            value={formData.state}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter state"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="country">Country</label>
                                                        <input
                                                            type="text"
                                                            id="country"
                                                            name="country"
                                                            value={formData.country}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter country"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label htmlFor="postal_code">Postal Code</label>
                                                        <input
                                                            type="text"
                                                            id="postal_code"
                                                            name="postal_code"
                                                            value={formData.postal_code}
                                                            onChange={handleFormChange}
                                                            placeholder="Enter postal code"
                                                            className="form-input"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Form Actions */}
                                            <div className="form-actions">
                                                <button type="submit" className="btn-save">
                                                    <Save size={20} />
                                                    {editingVendorId ? 'Update Vendor' : 'Create Vendor'}
                                                </button>
                                                <button type="button" className="btn-cancel" onClick={resetForm}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {/* Vendors Table */}
                            <div className="vendors-table-container">
                                {vendorLoading ? (
                                    <div className="admin-loading">
                                        <div className="admin-loading-spinner" style={{ borderTopColor: '#db9d32' }}></div>
                                    </div>
                                ) : vendorError ? (
                                    <div className="error-message">
                                        <AlertCircle size={24} />
                                        <p>{vendorError}</p>
                                        <button onClick={fetchVendors} className="btn-retry">
                                            Retry
                                        </button>
                                    </div>
                                ) : filteredVendors.length === 0 ? (
                                    <div className="empty-state">
                                        <Grid3x3 size={48} />
                                        <p>{searchQuery ? 'No vendors found matching your search' : 'No vendors yet'}</p>
                                        {!searchQuery && (
                                            <button onClick={handleAddVendor} className="btn-add-first">
                                                <Plus size={20} />
                                                Add First Vendor
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="vendors-grid">
                                        {filteredVendors.map((vendor) => (
                                            <div key={vendor.id} className="vendor-card">
                                                <div className="vendor-card-header">
                                                    <div className="vendor-info">
                                                        <h4 className="vendor-name">{vendor.name}</h4>
                                                        {vendor.company_name && (
                                                            <p className="vendor-company">{vendor.company_name}</p>
                                                        )}
                                                    </div>
                                                    <div className="vendor-status">
                                                        {vendor.is_active ? (
                                                            <span className="status-badge active">Active</span>
                                                        ) : (
                                                            <span className="status-badge inactive">Inactive</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="vendor-details">
                                                    <div className="detail-row">
                                                        <span className="detail-label">Email:</span>
                                                        <span className="detail-value">{vendor.email}</span>
                                                    </div>
                                                    <div className="detail-row">
                                                        <span className="detail-label">Contact:</span>
                                                        <span className="detail-value">{vendor.contact_number}</span>
                                                    </div>
                                                    {vendor.city && (
                                                        <div className="detail-row">
                                                            <span className="detail-label">Location:</span>
                                                            <span className="detail-value">
                                                                {[vendor.city, vendor.state, vendor.country]
                                                                    .filter(Boolean)
                                                                    .join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {vendor.created_at && (
                                                        <div className="detail-row">
                                                            <span className="detail-label">Added:</span>
                                                            <span className="detail-value">
                                                                {new Date(vendor.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="vendor-actions">
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => handleEditVendor(vendor)}
                                                        title="Edit vendor"
                                                    >
                                                        <Edit3 size={18} />
                                                    </button>
                                                    <button
                                                        className="btn-action btn-toggle"
                                                        onClick={() => handleToggleVendorStatus(vendor.id)}
                                                        title={vendor.is_active ? 'Deactivate vendor' : 'Activate vendor'}
                                                    >
                                                        {vendor.is_active ? (
                                                            <ToggleRight size={18} />
                                                        ) : (
                                                            <ToggleLeft size={18} />
                                                        )}
                                                    </button>
                                                    <button
                                                        className="btn-action btn-delete"
                                                        onClick={() => handleDeleteVendor(vendor.id)}
                                                        title="Delete vendor"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminProfile;
