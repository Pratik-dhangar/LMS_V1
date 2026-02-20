import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getFileUrl } from "../../utils/urlHelper";
import RichTextEditor from "../../components/RichTextEditor";
import blogService from "../../api/services/blogService";
import "../../styles/admin/AdminEditVlog.css";
import "../../styles/admin/AdminEditBlog.css";
import "../../styles/ManageUsersLayout.css";

const CreateEditBlog = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    status: "draft",
  });
  const [featuredImage, setFeaturedImage] = useState(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit) {
      fetchBlog();
    }
  }, [id]);

  const fetchBlog = async () => {
    try {
      setLoading(true);
      const blog = await blogService.getAdminBlog(id);
      setFormData({
        title: blog.title,
        excerpt: blog.excerpt || "",
        content: blog.content,
        status: blog.status,
      });
      if (blog.featured_image_url) {
        setFeaturedImagePreview(getFileUrl(blog.featured_image_url));
      }
    } catch (err) {
      console.error("Error fetching blog:", err);
      toast.error("Failed to fetch blog");
      navigate("/admin/blogs");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleContentChange = (html) => {
    setFormData((prev) => ({ ...prev, content: html }));
    if (errors.content) {
      setErrors((prev) => ({ ...prev, content: "" }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error(
          "Invalid file type. Please upload a JPEG, PNG, or WebP image."
        );
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size too large. Maximum size is 5MB.");
        return;
      }

      setFeaturedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFeaturedImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFeaturedImage(null);
    setFeaturedImagePreview(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    if (!formData.content.trim() || formData.content === "<p></p>") {
      newErrors.content = "Content is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);

      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("content", formData.content);
      if (formData.excerpt) {
        formDataToSend.append("excerpt", formData.excerpt);
      }
      formDataToSend.append("status", formData.status);

      if (featuredImage) {
        formDataToSend.append("featured_image", featuredImage);
      }

      if (isEdit) {
        await blogService.updateBlog(id, formDataToSend);
        toast.success("Blog updated successfully");
      } else {
        await blogService.createBlog(formDataToSend);
        toast.success("Blog created successfully");
      }

      navigate("/admin/blogs");
    } catch (err) {
      console.error("Error saving blog:", err);
      toast.error(isEdit ? "Failed to update blog" : "Failed to create blog");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/admin/blogs");
  };

  if (loading) {
    return (
      <div className="admin-edit-vlog-container">
        <div className="admin-edit-vlog-main">
          <div className="admin-edit-vlog-loading">
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-main">
        <div className="page-content">
          <div className="page-header">
            <button
              onClick={() => navigate("/admin/blogs")}
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
              Back to Manage Blogs
            </button>
            {/* Left Side: Title and Subtitle */}
            <div>
              <h1 className="page-title">Edit Training Blog</h1>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="admin-edit-vlog-form">
            <div className="admin-edit-vlog-section">
              <h2 className="admin-edit-vlog-section-title">
                Basic Information
              </h2>

              {/* Title */}
              <div className="form-group">
                <label htmlFor="title" className="app-modal-form-label">
                  Title <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`form-input ${
                    errors.title ? "form-input-error" : ""
                  }`}
                  placeholder="Enter blog title"
                />
                {errors.title && <p className="form-error">{errors.title}</p>}
              </div>

              {/* Excerpt */}
              <div className="form-group">
                <label htmlFor="excerpt" className="app-modal-form-label">
                  Excerpt
                </label>
                <textarea
                  id="excerpt"
                  name="excerpt"
                  value={formData.excerpt}
                  onChange={handleChange}
                  rows={3}
                  className="app-modal-form-textarea"
                  placeholder="Brief summary of the blog post (optional)"
                  maxLength={500}
                />
                <p className="form-hint">
                  {formData.excerpt.length}/500 characters
                </p>
              </div>
            </div>

            {/* Featured Image */}
            <div className="admin-edit-vlog-section">
              <h2 className="admin-edit-vlog-section-title">Featured Image</h2>
              {featuredImagePreview ? (
                <div className="form-file-preview">
                  <img
                    src={featuredImagePreview}
                    alt="Featured"
                    className="form-image-preview"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="form-file-remove"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="form-file-upload">
                  <svg
                    className="form-file-icon"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <label htmlFor="featured_image" className="form-file-label">
                    Choose Image
                  </label>
                  <input
                    type="file"
                    id="featured_image"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="form-file-input"
                  />
                  <p className="form-file-hint">
                    JPEG, PNG, or WebP. Max size: 5MB. Recommended: 16:9 aspect
                    ratio
                  </p>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="admin-edit-vlog-section">
              <h2 className="admin-edit-vlog-section-title">
                Content <span className="form-required">*</span>
              </h2>
              <RichTextEditor
                value={formData.content}
                onChange={handleContentChange}
                placeholder="Write your blog content here..."
              />
              {errors.content && <p className="form-error">{errors.content}</p>}
            </div>

            {/* Status */}
            <div className="admin-edit-vlog-section">
              <h2 className="admin-edit-vlog-section-title">Publishing</h2>
              <div className="form-group">
                <label htmlFor="status" className="app-modal-form-label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="app-modal-form-select"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
                <p className="form-hint">
                  {formData.status === "published"
                    ? "Blog will be visible to all users"
                    : "Blog will be saved as draft"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="app-modal-btn app-modal-btn--secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="app-modal-btn app-modal-btn--primary">
                {saving ? (
                  <>
                    <svg
                      className="loading-spinner-sm"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                    {isEdit ? "Update Blog" : "Create Blog"}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

export default CreateEditBlog;
