import React, { useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextAreaField from '../../../components/common/TextAreaField';
import vlogService from '../../../api/services/vlogService';

const CreateVlogModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft',
    video: null,
    thumbnail: null,
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
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('status', formData.status);
      // backend expects field names 'video_file' and 'thumbnail_file'
      if (formData.video) {
        formDataToSend.append('video_file', formData.video);
      }
      if (formData.thumbnail) {
        formDataToSend.append('thumbnail_file', formData.thumbnail);
      }

      await vlogService.createVlog(formDataToSend);
      onSuccess();
    } catch {
      setError('Failed to create vlog. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-sm">
        <h2 className="modal-title">Create New Vlog</h2>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <InputField
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <TextAreaField
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
          />

          <div className="form-field">
            <label className="form-label">
              Status <span className="form-required">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="form-input"
              required
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">
              Video File <span className="form-required">*</span>
            </label>
            <input
              type="file"
              name="video"
              accept="video/*"
              onChange={handleFileChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label className="form-label">
              Thumbnail Image <span className="form-required">*</span>
            </label>
            <input
              type="file"
              name="thumbnail"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="form-input"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateVlogModal;