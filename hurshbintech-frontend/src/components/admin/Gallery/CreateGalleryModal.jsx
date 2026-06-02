import React, { useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextAreaField from '../../../components/common/TextAreaField';
import galleryService from '../../../api/services/galleryService';
import '../../../styles/components/common/Modal.css';

const CreateGalleryModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        status: 'draft',
        photo: null,
        video: null,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const { name, files } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: files[0],
            // Clear the other file type when a new one is selected
            ...(name === 'photo' && { video: null }),
            ...(name === 'video' && { photo: null }),
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Validate that at least one file is provided
            if (!formData.photo && !formData.video) {
                setError('Please upload either a photo or a video.');
                setLoading(false);
                return;
            }

            const formDataToSend = new FormData();
            formDataToSend.append('status', formData.status);

            if (formData.photo) {
                formDataToSend.append('photo_file', formData.photo);
            }
            if (formData.video) {
                formDataToSend.append('video_file', formData.video);
            }

            await galleryService.createGallery(formDataToSend);
            onSuccess();
        } catch (err) {
            setError('Failed to create gallery item. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-modal-overlay">
            <div className="app-modal-container app-modal-container--md">
                <div className="app-modal-header app-modal-header--primary">
                    <h2 className="app-modal-title">Add Photo or Video to Gallery</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="app-modal-close"
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="app-modal-content">
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <div className="app-modal-form-field">
                            <label className="app-modal-form-label">
                                Status <span className="form-required">*</span>
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="app-modal-form-input"
                                required
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>

                        <div className="app-modal-form-field">
                            <label className="app-modal-form-label">
                                Photo Image {!formData.video && <span className="form-required">*</span>}
                            </label>
                            <input
                                type="file"
                                name="photo"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={!!formData.video}
                                className="app-modal-form-input"
                            />
                            <small className="form-helper-text">
                                Accepted formats: JPEG, PNG, WebP, GIF. Max size: 50MB. Thumbnail will be auto-generated.
                            </small>
                        </div>

                        <div style={{ textAlign: 'center', margin: '10px 0', color: '#999' }}>
                            — OR —
                        </div>

                        <div className="app-modal-form-field">
                            <label className="app-modal-form-label">
                                Video File {!formData.photo && <span className="form-required">*</span>}
                            </label>
                            <input
                                type="file"
                                name="video"
                                accept="video/*"
                                onChange={handleFileChange}
                                disabled={!!formData.photo}
                                className="app-modal-form-input"
                            />
                            <small className="form-helper-text">
                                Accepted formats: MP4, WebM, OGG, QuickTime. Max size: 500MB. Thumbnail will be auto-generated.
                            </small>
                        </div>

                        {(formData.photo || formData.video) && (
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                                <small>
                                    <strong>Selected:</strong> {formData.photo ? formData.photo.name : formData.video.name}
                                </small>
                            </div>
                        )}
                    </div>

                    <div className="app-modal-footer">
                        <button
                            type="button"
                            onClick={onClose}
                            className="app-modal-btn app-modal-btn--secondary"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="app-modal-btn app-modal-btn--primary"
                            disabled={loading || (!formData.photo && !formData.video)}
                        >
                            {loading ? 'Adding...' : 'Add to Gallery'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGalleryModal;
