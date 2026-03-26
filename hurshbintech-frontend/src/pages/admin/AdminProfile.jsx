import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    User, Mail, Phone, Edit3, X, Save, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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



    // Fetch admin profile on mount
    useEffect(() => {
        fetchAdminProfile();
    }, []);

    const fetchAdminProfile = async () => {
        try {
            setLoading(true);
            // Fetch admin profile from API to get the latest data
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/profile/me/user`, {
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
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/profile/admin/update`, {
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
                        <p className="admin-profile-subtitle">Manage your profile</p>
                    </div>

                    {
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
                    }
                    
                </div>
            </main>
        </div>
    );
};

export default AdminProfile;
