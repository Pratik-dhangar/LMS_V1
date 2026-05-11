import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import galleryService from '../../api/services/galleryService';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import '../../styles/admin/AdminEditGallery.css';
import '../../styles/ManageUsersLayout.css';

const EditGallery = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('draft');
    const [photo, setPhoto] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const gallery = await galleryService.getGalleryById(id);
                setStatus(gallery.status || 'draft');
            } catch {
                setError('Failed to fetch gallery photo details');
            } finally {
                setLoading(false);
            }
        };

        fetchGallery();
    }, [id]);

    const handleFileChange = (e) => {
        const { files } = e.target;
        setPhoto(files[0] || null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('status', status);
            if (photo) {
                formDataToSend.append('photo_file', photo);
            }

            await galleryService.updateGallery(id, formDataToSend);
            navigate('/admin/gallery');
        } catch {
            setError('Failed to update gallery photo. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loader />;
    if (error) return <ErrorState message={error} />;

    return (
        <div className="page-main">
            <div className="page-content">
                <div className="page-header">
                    <button
                        onClick={() => navigate("/admin/gallery")}
                        className="back-button"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M15 19l-7-7 7-7"></path>
                        </svg>
                        Back to Gallery
                    </button>
                    {/* Left Side: Title and Subtitle */}
                    <div>
                        <h1 className="page-title">Replace Gallery Photo</h1>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="admin-edit-gallery-error">
                        {error}
                    </div>
                )}

                {/* Form Container */}
                <div className="admin-edit-gallery-form">
                    <form onSubmit={handleSubmit}>
                        {/* File Upload Section */}
                        <div className="admin-edit-gallery-section">
                            <h2 className="admin-edit-gallery-section-title">Photo Status</h2>

                            <div className="app-modal-form-field">
                                <label className="app-modal-form-label">
                                    Status <span className="form-required">*</span>
                                </label>
                                <select
                                    name="status"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="app-modal-form-input"
                                    required
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                </select>
                                <p className="form-hint">
                                    💡 Draft photos are admin-only; published photos are visible publicly.
                                </p>
                            </div>
                        </div>

                        <div className="admin-edit-gallery-section">
                            <h2 className="admin-edit-gallery-section-title">Image File</h2>

                            {/* Photo File */}
                            <div className="app-modal-form-field">
                                <label className="app-modal-form-label">
                                    🖼️ Photo Image <span className="form-required">*</span>
                                </label>
                                <input
                                    type="file"
                                    name="photo"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="app-modal-form-input"
                                />
                                <p className="form-hint">
                                    💡 Upload an image to replace the current photo. Accepted formats: JPEG, PNG, WebP, GIF. Max size: 50MB.
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/gallery')}
                                className="app-modal-btn app-modal-btn--secondary"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="app-modal-btn app-modal-btn--primary"
                                disabled={saving}
                            >
                                {saving ? (
                                    <span className="btn-loading">
                                        <svg className="btn-spinner" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </span>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditGallery;
