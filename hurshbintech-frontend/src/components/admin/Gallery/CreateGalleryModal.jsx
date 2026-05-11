import React, { useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextAreaField from '../../../components/common/TextAreaField';
import galleryService from '../../../api/services/galleryService';
import '../../../styles/components/common/Modal.css';

const CreateGalleryModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        status: 'draft',
        photo: null,
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
            [name]: files[0]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const formDataToSend = new FormData();
            // only send image + status
            formDataToSend.append('status', formData.status);
            // backend expects field name 'photo_file'
            if (formData.photo) {
                formDataToSend.append('photo_file', formData.photo);
            }

            await galleryService.createGallery(formDataToSend);
            onSuccess();
        } catch {
            setError('Failed to create gallery photo. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-modal-overlay">
            <div className="app-modal-container app-modal-container--md">
                <div className="app-modal-header app-modal-header--primary">
                    <h2 className="app-modal-title">Add Photo to Gallery</h2>
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
                        {/* Title and Description removed — only image is required */}

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
                                Photo Image <span className="form-required">*</span>
                            </label>
                            <input
                                type="file"
                                name="photo"
                                accept="image/*"
                                onChange={handleFileChange}
                                required
                                className="app-modal-form-input"
                            />
                            <small className="form-helper-text">
                                Accepted formats: JPEG, PNG, WebP, GIF. Max size: 50MB. Thumbnail will be auto-generated.
                            </small>
                        </div>
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
                            disabled={loading}
                        >
                            {loading ? 'Adding...' : 'Add Photo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGalleryModal;
