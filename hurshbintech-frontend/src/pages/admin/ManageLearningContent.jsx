import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import learningContentService from "../../api/services/learningContentService";
import SearchBar from "../../components/common/SearchBar";
import '../../styles/components/common/Modal.css';
import '../../styles/admin/AdminManageLearningContent.css';
import '../../styles/ManageUsersLayout.css';

const ManageLearningContent = () => {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content_type: "",
    file_url: "",
    file_size: null,
    thumbnail_url: "",
    youtube_url: "",
    is_youtube: false,
  });
  const [useYoutube, setUseYoutube] = useState(false);

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    try {
      const data = await learningContentService.admin.getAll();
      setContents(data);
    } catch (error) {
      console.error("Error fetching contents:", error);
      toast.error("Failed to load learning contents");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size exceeds 100MB limit");
      return;
    }

    setUploading(true);
    try {
      const result = await learningContentService.uploadFile(file);
      setFormData((prev) => ({
        ...prev,
        file_url: result.file_url,
        file_size: result.file_size,
        content_type: result.content_type,
      }));
      toast.success(`File uploaded successfully: ${result.original_filename}`);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(error.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title) {
      toast.error("Title is required");
      return;
    }

    if (!useYoutube && !formData.file_url) {
      toast.error("Please upload a file or provide a YouTube URL");
      return;
    }

    if (useYoutube && !formData.youtube_url) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    // Check for duplicate title
    const duplicateExists = contents.some(
      content => content.title.toLowerCase().trim() === formData.title.toLowerCase().trim()
    );

    if (duplicateExists) {
      toast.error("A learning content with this name already exists. Please use a different name.");
      return;
    }

    try {
      const submitData = {
        title: formData.title,
        description: formData.description,
      };

      if (useYoutube) {
        submitData.youtube_url = formData.youtube_url;
      } else {
        submitData.file_url = formData.file_url;
        submitData.content_type = formData.content_type;
        submitData.thumbnail_url = formData.thumbnail_url;
      }

      await learningContentService.admin.create(submitData);
      toast.success("Learning content created successfully!");
      setShowAddModal(false);
      setFormData({
        title: "",
        description: "",
        content_type: "",
        file_url: "",
        file_size: null,
        thumbnail_url: "",
        youtube_url: "",
        is_youtube: false,
      });
      setUseYoutube(false);
      fetchContents();
    } catch (error) {
      console.error("Error creating content:", error);
      toast.error("Failed to create learning content");
    }
  };

  const handleEdit = (content) => {
    setSelectedContent(content);
    setFormData({
      title: content.title,
      description: content.description || "",
      thumbnail_url: content.thumbnail_url || "",
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      await learningContentService.admin.update(selectedContent.id, {
        title: formData.title,
        description: formData.description,
        thumbnail_url: formData.thumbnail_url,
      });
      toast.success("Content updated successfully!");
      setShowEditModal(false);
      fetchContents();
    } catch (error) {
      console.error("Error updating content:", error);
      toast.error("Failed to update content");
    }
  };

  const handleDelete = async (contentId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this content? The file will also be deleted."
      )
    )
      return;

    try {
      await learningContentService.admin.delete(contentId);
      toast.success("Content and file deleted successfully!");
      fetchContents();
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content");
    }
  };

  const getContentIcon = (type) => {
    const icons = {
      image: "🖼️",
      pdf: "📄",
      video: "🎥",
      audio: "🎵",
      document: "📝",
      youtube: "🎥",
    };
    return icons[type] || "📁";
  };


  const handleSearch = (query) => {
    setActiveSearchQuery(query);
  };

  const filteredContents = contents.filter(
    (content) =>
      content.title.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      content.content_type.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      (content.description &&
        content.description.toLowerCase().includes(activeSearchQuery.toLowerCase()))
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const renderPreview = (content) => {
    // Handle YouTube content
    if (content.is_youtube && content.youtube_video_id) {
      const thumbnailUrl = `https://img.youtube.com/vi/${content.youtube_video_id}/hqdefault.jpg`;
      return (
        <div className="youtube-preview">
          <img
            src={thumbnailUrl}
            alt={content.title}
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.target.style.display = "none";
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div className="hidden items-center justify-center h-32 bg-gradient-to-br from-gray-100 to-gray-200" style={{ display: 'none' }}>
            <div className="text-center">
              <span className="text-4xl mb-2 block">🎥</span>
              <span className="text-xs text-gray-600">YouTube unavailable</span>
            </div>
          </div>
        </div>
      );
    }

    const fileUrl = learningContentService.getFileUrl(content.file_url);

    if (content.content_type === "image") {
      return (
        <>
          <img
            src={fileUrl}
            alt={content.title}
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = "none";
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div className="hidden items-center justify-center h-32 bg-gradient-to-br from-gray-100 to-gray-200" style={{ display: 'none' }}>
            <div className="text-center">
              <span className="text-4xl mb-2 block">🖼️</span>
              <span className="text-xs text-gray-600">Image unavailable</span>
            </div>
          </div>
        </>
      );
    }

    if (content.content_type === "video") {
      return (
        <video
          src={fileUrl}
          className="w-full h-32 object-cover"
          controls
          onError={(e) => {
            e.target.style.display = "none";
            e.target.parentElement.innerHTML =
              '<div class="flex items-center justify-center h-32 bg-gray-200"><span class="text-gray-500">Video preview unavailable</span></div>';
          }}
        />
      );
    }

    if (content.thumbnail_url) {
      const thumbUrl = learningContentService.getFileUrl(content.thumbnail_url);
      return (
        <>
          <img
            src={thumbUrl}
            alt={content.title}
            className="w-full h-32 object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = "none";
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div className="hidden items-center justify-center h-32 bg-gradient-to-br from-gray-100 to-gray-200" style={{ display: 'none' }}>
            <div className="text-center">
              <span className="text-4xl mb-2 block">
                {getContentIcon(content.content_type)}
              </span>
              <span className="text-xs text-gray-600">No thumbnail</span>
            </div>
          </div>
        </>
      );
    }

    // Fallback for other content types
    return (
      <div className="flex items-center justify-center h-32 bg-gradient-to-br from-gray-100 to-gray-200">
        <div className="text-center">
          <span className="text-4xl mb-2 block">
            {getContentIcon(content.content_type)}
          </span>
          <span className="text-xs text-gray-600 uppercase font-medium">
            {content.content_type || 'content'}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container loading-fullscreen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">
                Manage Learning Content
              </h1>
              <p className="page-description">
                Upload and manage learning resources
              </p>
            </div>
          </div>

          {/* Search Bar and Add Button */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by title, type, or description..."
            />
            <button
              onClick={() => setShowAddModal(true)}
              className="app-modal-btn app-modal-btn--success"
            >
              + Add New Content
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredContents.length} of {contents.length} items
              </p>
            </div>
          )}

          {/* Content Grid */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : filteredContents.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                {activeSearchQuery
                  ? "No content matches your search"
                  : "No learning content available. Add some content to get started!"}
              </p>
            </div>
          ) : (
            <div className="admin-content-grid">
              {filteredContents.map((content) => (
                <div
                  key={content.id}
                  className="admin-content-card"
                  data-type={content.content_type}
                >
                  {/* Card Header */}
                  <div className="admin-content-card-header">
                    <div className="admin-content-card-header-left">
                      <span className="admin-content-icon">
                        {content.is_youtube ? "🎥" : getContentIcon(content.content_type)}
                      </span>
                      <div>
                        <p className="admin-content-type-text">
                          {content.is_youtube ? "YouTube" : content.content_type}
                        </p>
                        <p className="admin-content-size-text">
                          {content.is_youtube ? "Video" : formatFileSize(content.file_size)}
                        </p>
                      </div>

                    </div>
                    <div className="admin-content-id-badge">
                      <span>#{content.id}</span>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="admin-content-preview">
                    {renderPreview(content)}
                  </div>

                  {/* Card Content */}
                  <div className="admin-content-card-body">
                    <h3 className="admin-content-title">
                      {content.title}
                    </h3>

                    {content.description && (
                      <p className="admin-content-description">
                        {content.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="admin-content-meta">
                      <div className="admin-content-meta-item">
                        <span>👤</span>
                        <span className="admin-content-meta-text">
                          By: <strong>{content.created_by_name}</strong>
                        </span>
                      </div>
                      <div className="admin-content-meta-item">
                        <span>📅</span>
                        <span className="admin-content-meta-text">
                          {new Date(content.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="admin-content-actions">
                      {content.is_youtube ? (
                        <a
                          href={content.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-modal-btn app-modal-btn--secondary btn-sm"
                        >
                          View
                        </a>
                      ) : (
                        <a
                          href={learningContentService.getFileUrl(content.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            const finalUrl = learningContentService.getFileUrl(content.file_url);
                            console.log('[📂 VIEW BUTTON] Content:', {
                              id: content.id,
                              title: content.title,
                              original_file_url: content.file_url,
                              final_url: finalUrl,
                              content_type: content.content_type,
                              timestamp: new Date().toISOString()
                            });
                          }}
                          className="app-modal-btn app-modal-btn--secondary btn-sm"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleEdit(content)}
                        className="app-modal-btn app-modal-btn--primary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(content.id)}
                        className="app-modal-btn app-modal-btn--danger btn-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Add Modal */}
      {showAddModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Add Learning Content</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({
                    title: "",
                    description: "",
                    content_type: "",
                    file_url: "",
                    file_size: null,
                    thumbnail_url: "",
                  });
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="app-modal-content">
                {/* Toggle between File and YouTube */}
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Content Type</label>
                  <div className="content-type-toggle">
                    <button
                      type="button"
                      className={`btn-primary ${!useYoutube ? 'active' : ''}`}
                      onClick={() => {
                        setUseYoutube(false);
                        setFormData({ ...formData, youtube_url: "" });
                      }}
                    >
                      📁 File Upload
                    </button>
                    <button
                      type="button"
                      className={`btn-primary ${useYoutube ? 'active' : ''}`}
                      onClick={() => {
                        setUseYoutube(true);
                        setFormData({ ...formData, file_url: "", content_type: "", thumbnail_url: "" });
                      }}
                    >
                      🎥 YouTube URL
                    </button>
                  </div>
                </div>

                {/* File Upload Section */}
                {!useYoutube && (
                  <>
                    <div className="app-modal-form-field">
                      <label className="app-modal-form-label">
                        Upload File <span className="form-required">*</span>
                      </label>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="app-modal-form-input"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
                        required
                        disabled={uploading}
                      />
                      <p className="form-help-text">Max size: 100MB</p>
                      {uploading && (
                        <div className="mt-2">
                          <div className="animate-pulse flex space-x-2 items-center">
                            <div className="h-2 bg-amber-400 rounded flex-1"></div>
                            <span className="text-sm text-amber-700">
                              Uploading...
                            </span>
                          </div>
                        </div>
                      )}
                      {formData.file_url && !uploading && (
                        <p className="text-sm text-green-600 mt-2 flex items-center">
                          <span className="mr-1">✓</span> File uploaded successfully
                        </p>
                      )}
                    </div>

                    <div className="app-modal-form-field">
                      <label className="app-modal-form-label">
                        Thumbnail URL (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.thumbnail_url}
                        onChange={(e) =>
                          setFormData({ ...formData, thumbnail_url: e.target.value })
                        }
                        className="app-modal-form-input"
                        placeholder="https://example.com/thumbnail.jpg"
                      />
                    </div>
                  </>
                )}

                {/* YouTube URL Section */}
                {useYoutube && (
                  <div className="app-modal-form-field">
                    <label className="app-modal-form-label">
                      YouTube URL <span className="form-required">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.youtube_url}
                      onChange={(e) =>
                        setFormData({ ...formData, youtube_url: e.target.value })
                      }
                      className="app-modal-form-input"
                      placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      required
                    />
                    <p className="form-help-text">
                      Paste a YouTube URL. Thumbnail will be generated automatically.
                    </p>
                  </div>
                )}

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Title <span className="form-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="app-modal-form-input"
                    required
                    placeholder="Enter content title"
                  />
                </div>

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="app-modal-form-textarea"
                    rows="3"
                    placeholder="Enter description (optional)"
                  />
                </div>

              </div>
              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      title: "",
                      description: "",
                      content_type: "",
                      file_url: "",
                      file_size: null,
                      thumbnail_url: "",
                      youtube_url: "",
                      is_youtube: false,
                    });
                    setUseYoutube(false);
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-modal-btn app-modal-btn--primary"
                  disabled={uploading || (useYoutube ? !formData.youtube_url : !formData.file_url)}
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Edit Content Details</h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="app-modal-content">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="app-modal-form-input"
                    required
                  />
                </div>

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="app-modal-form-textarea"
                    rows="3"
                  />
                </div>

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Thumbnail URL
                  </label>
                  <input
                    type="text"
                    value={formData.thumbnail_url}
                    onChange={(e) =>
                      setFormData({ ...formData, thumbnail_url: e.target.value })
                    }
                    className="app-modal-form-input"
                  />
                </div>

              </div>
              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="app-modal-btn app-modal-btn--primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageLearningContent;
