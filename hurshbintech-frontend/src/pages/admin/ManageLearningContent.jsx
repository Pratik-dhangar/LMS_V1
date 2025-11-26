import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import learningContentService from "../../api/services/learningContentService";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import SearchBar from "../../components/common/SearchBar";

const ManageLearningContent = () => {
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
  });

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

    if (!formData.title || !formData.file_url) {
      toast.error("Please fill in all required fields and upload a file");
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
      await learningContentService.admin.create(formData);
      toast.success("Learning content created successfully!");
      setShowAddModal(false);
      setFormData({
        title: "",
        description: "",
        content_type: "",
        file_url: "",
        file_size: null,
        thumbnail_url: "",
      });
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
    };
    return icons[type] || "📁";
  };

  const getContentColor = (type) => {
    const colors = {
      image: "from-purple-500 to-pink-500",
      pdf: "from-red-500 to-orange-500",
      video: "from-blue-500 to-cyan-500",
      audio: "from-green-500 to-teal-500",
      document: "from-yellow-500 to-orange-500",
    };
    return colors[type] || "from-gray-500 to-gray-600";
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
            {content.content_type}
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div className="flex-1 bg-[#f5f6fa] p-8 m-6 min-h-screen md:p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-[3px] border-[#2c3e50] md:flex-col md:gap-4 md:items-start">
            <div>
              <h1 className="text-[#2c3e50] text-[2rem] m-0 font-bold md:text-2xl">
                Manage Learning Content
              </h1>
              <p className="text-gray-600 mt-2">
                Upload and manage learning resources
              </p>
            </div>
          </div>

          {/* Search Bar and Add Button */}
          <div className="mb-6 flex justify-center items-center gap-4">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by title, type, or description..."
            />
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#27ae60] hover:bg-[#229954] text-white px-6 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              + Add New Content
            </button>
          </div>
          {activeSearchQuery && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Found {filteredContents.length} of {contents.length} items
              </p>
            </div>
          )}

          {/* Content Grid */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredContents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <p className="text-gray-500 text-lg">
                {activeSearchQuery
                  ? "No content matches your search"
                  : "No learning content available. Add some content to get started!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredContents.map((content) => (
                <div
                  key={content.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  {/* Card Header with Gradient */}
                  <div
                    className={`bg-gradient-to-r ${getContentColor(
                      content.content_type
                    )} p-2 relative`}
                  >
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">
                          {getContentIcon(content.content_type)}
                        </span>
                        <div>
                          <p className="text-xs uppercase font-semibold opacity-90">
                            {content.content_type}
                          </p>
                          <p className="text-xs opacity-75">
                            {formatFileSize(content.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                        <span className="text-xs font-medium">
                          #{content.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="relative h-32 bg-gray-100 overflow-hidden">
                    {renderPreview(content)}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>

                  {/* Card Content */}
                  <div className="p-3">
                    <h3 className="font-bold text-base text-gray-800 mb-2 line-clamp-1">
                      {content.title}
                    </h3>

                    {content.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {content.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="space-y-1 mb-3 text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-1">👤</span>
                        <span className="truncate">
                          By:{" "}
                          <span className="font-medium text-gray-700">
                            {content.created_by_name}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="mr-1">📅</span>
                        <span>
                          {new Date(content.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-1">
                      <a
                        href={learningContentService.getFileUrl(
                          content.file_url
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center bg-blue-50 text-blue-600 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors text-xs"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleEdit(content)}
                        className="flex-1 bg-indigo-50 text-indigo-600 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(content.id)}
                        className="flex-1 bg-red-50 text-red-600 py-1.5 rounded-lg hover:bg-red-100 font-medium transition-colors text-xs"
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
      <Footer />

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 mx-auto">
            <h2 className="text-2xl font-bold mb-4">Add Learning Content</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="w-full border rounded p-2"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.ppt,.pptx"
                  required
                  disabled={uploading}
                />
                <p className="text-xs text-gray-500 mt-1">Max size: 100MB</p>
                {uploading && (
                  <div className="mt-2">
                    <div className="animate-pulse flex space-x-2 items-center">
                      <div className="h-2 bg-blue-400 rounded flex-1"></div>
                      <span className="text-sm text-blue-600">
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

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  placeholder="Enter content title"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                  placeholder="Enter description (optional)"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Thumbnail URL (optional)
                </label>
                <input
                  type="text"
                  value={formData.thumbnail_url}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnail_url: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/thumbnail.jpg"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 btn btn-primary"
                  disabled={uploading || !formData.file_url}
                >
                  Create
                </button>
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
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 mx-auto">
            <h2 className="text-2xl font-bold mb-4">Edit Content Details</h2>
            <form onSubmit={handleUpdate}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="3"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Thumbnail URL
                </label>
                <input
                  type="text"
                  value={formData.thumbnail_url}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnail_url: e.target.value })
                  }
                  className="w-full border rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex space-x-2">
                <button type="submit" className="flex-1 btn btn-primary">
                  Update
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageLearningContent;
