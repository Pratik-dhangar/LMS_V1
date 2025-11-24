import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import vlogService from '../../api/services/vlogService';
import InputField from '../../components/common/InputField';
import TextAreaField from '../../components/common/TextAreaField';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

const EditVlog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
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
          video: null,
          thumbnail: null,
        });
      } catch (err) {
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
      if (formData.video) {
        formDataToSend.append('video_file', formData.video);
      }
      if (formData.thumbnail) {
        formDataToSend.append('thumbnail_file', formData.thumbnail);
      }

      await vlogService.updateVlog(id, formDataToSend);
      navigate('/admin/vlogs');
    } catch (_err) {
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
      <div className="flex-1 bg-[#f5f6fa] p-8 m-6 min-h-screen md:p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 pb-4 border-b-[3px] border-[#2c3e50]">
            <h1 className="text-[#2c3e50] text-[2rem] m-0 font-bold md:text-2xl">
              Edit Training Vlog
            </h1>
            <p className="text-gray-600 mt-2">
              Update vlog information and files
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-white rounded-xl shadow-md p-6 md:p-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter vlog title"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="4"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Enter vlog description"
                />
              </div>

              {/* File Upload Section */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Video File */}
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🎥 Video File (Optional)
                  </label>
                  <input
                    type="file"
                    name="video"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Upload only to replace current video
                  </p>
                </div>

                {/* Thumbnail File */}
                <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🖼️ Thumbnail Image (Optional)
                  </label>
                  <input
                    type="file"
                    name="thumbnail"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    💡 Upload only to replace current thumbnail
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate('/admin/vlogs')}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-all disabled:opacity-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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