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
    const [video, setVideo] = useState(null);
    const [currentGallery, setCurrentGallery] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const gallery = await galleryService.getGalleryById(id);
                setStatus(gallery.status || 'draft');
                setCurrentGallery(gallery);
            } catch {
                setError('Failed to fetch gallery item details');
            } finally {
                setLoading(false);
            }
        };

        fetchGallery();
    }, [id]);

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        if (name === 'photo') {
            setPhoto(files[0] || null);
            setVideo(null); // Clear video when photo is selected
        } else if (name === 'video') {
            setVideo(files[0] || null);
            setPhoto(null); // Clear photo when video is selected
        }
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
            if (video) {
                formDataToSend.append('video_file', video);
            }

            await galleryService.updateGallery(id, formDataToSend);
            navigate('/admin/gallery');
        } catch {
            setError('Failed to update gallery item. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loader />;
    if (error) return <ErrorState message={error} />;

    const isVideo = currentGallery?.video_url;
    const isSaveable = photo || video || false;

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
                        <h1 className="page-title">Edit Gallery {isVideo ? "Video" : "Photo"}</h1>
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
                            <h2 className="admin-edit-gallery-section-title">Item Status</h2>

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
                                    💡 Draft items are admin-only; published items are visible publicly.
                                </p>
                            </div>
                        </div>

                        <div className="admin-edit-gallery-section">
                            <h2 className="admin-edit-gallery-section-title">Media File</h2>

                            {/* Photo File */}
                            <div className="app-modal-form-field">
                                <label className="app-modal-form-label">
                                    🖼️ Photo Image {!isVideo && <span className="form-required">*</span>}
                                </label>
                                <input
                                    type="file"
                                    name="photo"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    disabled={!!video}
                                    className="app-modal-form-input"
                                />
                                <p className="form-hint">
                                    💡 Upload an image to replace the current photo. Accepted formats: JPEG, PNG, WebP, GIF. Max size: 50MB.
                                </p>
                            </div>

                            <div style={{ textAlign: 'center', margin: '15px 0', color: '#999' }}>
                                — OR —
                            </div>

                            {/* Video File */}
                            <div className="app-modal-form-field">
                                <label className="app-modal-form-label">
                                    🎬 Video File {isVideo && <span className="form-required">*</span>}
                                </label>
                                <input
                                    type="file"
                                    name="video"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    disabled={!!photo}
                                    className="app-modal-form-input"
                                />
                                <p className="form-hint">
                                    💡 Upload a video to replace the current video. Accepted formats: MP4, WebM, OGG, QuickTime. Max size: 500MB.
                                </p>
                            </div>

                            {(photo || video) && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                                    <small>
                                        <strong>Selected:</strong> {photo ? photo.name : video?.name}
                                    </small>
                                </div>
                            )}
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
                                disabled={saving || !isSaveable}
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
