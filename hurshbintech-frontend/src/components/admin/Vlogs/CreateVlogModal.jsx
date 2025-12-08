import React, { useState } from 'react';
import InputField from '../../../components/common/InputField';
import TextAreaField from '../../../components/common/TextAreaField';
import vlogService from '../../../api/services/vlogService';
import '../../../styles/components/admin/CreateVlogModal.css';

const CreateVlogModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
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
    <div className="create-vlog-overlay">
      <div className="create-vlog-modal">
        <h2 className="create-vlog-title">Create New Vlog</h2>

        {error && (
          <div className="create-vlog-error">
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

          <div className="create-vlog-field">
            <label className="create-vlog-label">
              Video File
            </label>
            <input
              type="file"
              name="video"
              accept="video/*"
              onChange={handleFileChange}
              required
              className="create-vlog-file-input"
            />
          </div>

          <div className="create-vlog-field">
            <label className="create-vlog-label">
              Thumbnail Image
            </label>
            <input
              type="file"
              name="thumbnail"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="create-vlog-file-input"
            />
          </div>

          <div className="create-vlog-buttons">
            <button
              type="button"
              onClick={onClose}
              className="create-vlog-btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-vlog-btn-submit"
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