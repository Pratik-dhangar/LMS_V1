import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import vlogService from '../../api/services/vlogService';
import InputField from '../../components/common/InputField';
import TextAreaField from '../../components/common/TextAreaField';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/admin/AdminEditVlog.css';

const EditVlog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'draft',
    video: null,
    thumbnail: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVlog = async () => {
      try {
        const vlog = await vlogService.getVlogById(id);
        setFormData({
          title: vlog.title,
          description: vlog.description,
          status: vlog.status || 'draft',
          video: null,
          thumbnail: null,
        });
      } catch {
        setError('Failed to fetch vlog details');
      } finally {
        setLoading(false);
      }
    };

    fetchVlog();
  }, [id]);

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
    setSaving(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('status', formData.status);
      if (formData.video) {
        formDataToSend.append('video_file', formData.video);
      }
      if (formData.thumbnail) {
        formDataToSend.append('thumbnail_file', formData.thumbnail);
      }

      await vlogService.updateVlog(id, formDataToSend);
      navigate('/admin/vlogs');
    } catch {
      setError('Failed to update vlog. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <Navbar />
      <div className="page-main">
        <div className="page-content-narrow">
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">
              Edit Training Vlog
            </h1>
            <p className="page-description">
              Update vlog information and files
            </p>
          </div>

          {/* Form Container */}
          <div className="form-container">
            <form onSubmit={handleSubmit} className="form-fields">
              {/* Title Field */}
              <div className="form-field">
                <label className="form-label">
                  Title <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="form-input"
                  placeholder="Enter vlog title"
                />
              </div>

              {/* Description Field */}
              <div className="form-field">
                <label className="form-label">
                  Description <span className="form-required">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="form-textarea"
                  placeholder="Enter vlog description"
                />
              </div>

              {/* Status Field */}
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
                <p className="form-help-text">
                  💡 Draft vlogs are only visible to admins. Published vlogs are visible to everyone.
                </p>
              </div>

              {/* File Upload Section */}
              <div className="form-grid form-grid-2">
                {/* Video File */}
                <div className="file-upload-box">
                  <label className="form-label">
                    🎥 Video File (Optional)
                  </label>
                  <input
                    type="file"
                    name="video"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="form-file-input"
                  />
                  <p className="form-help-text">
                    💡 Upload only to replace current video
                  </p>
                </div>

                {/* Thumbnail File */}
                <div className="file-upload-box">
                  <label className="form-label">
                    🖼️ Thumbnail Image (Optional)
                  </label>
                  <input
                    type="file"
                    name="thumbnail"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="form-file-input"
                  />
                  <p className="form-help-text">
                    💡 Upload only to replace current thumbnail
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => navigate('/admin/vlogs')}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
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
                    '💾 Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default EditVlog;