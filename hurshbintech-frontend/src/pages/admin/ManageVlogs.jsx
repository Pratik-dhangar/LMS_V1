import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import vlogService from "../../api/services/vlogService";
import ConfirmModal from "../../components/common/ConfirmModal";
import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/ErrorState";
import CreateVlogModal from "../../components/admin/Vlogs/CreateVlogModal";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";

const ManageVlogs = () => {
  const [vlogs, setVlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVlog, setSelectedVlog] = useState(null);
  const navigate = useNavigate();

  const fetchVlogs = async () => {
    try {
      setLoading(true);
      const data = await vlogService.getAllVlogs();
      setVlogs(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch vlogs. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVlogs();
  }, []);

  const handleEdit = (vlog) => {
    navigate(`/admin/vlogs/${vlog.id}/edit`);
  };

  const handleDelete = async () => {
    console.log("Delete initiated for vlog:", selectedVlog);
    try {
      const result = await vlogService.deleteVlog(selectedVlog.id);
      console.log("Delete result:", result);
      setVlogs(vlogs.filter((vlog) => vlog.id !== selectedVlog.id));
      setShowDeleteModal(false);
      setSelectedVlog(null);
    } catch (err) {
      console.error("Delete error:", err);
      console.error("Error details:", err.response?.data || err.message);
      setError("Failed to delete vlog. Please try again later.");
      setShowDeleteModal(false);
    }
  };

  const handlePlayVideo = (vlog) => {
    setSelectedVlog(vlog);
    setShowVideoPlayer(true);
  };

  const getFullUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `http://127.0.0.1:8000${url}`;
  };

  const formatFileSize = (size) => {
    if (!size) return "N/A";
    if (size < 1) return (size * 1024).toFixed(2) + " KB";
    return size.toFixed(2) + " MB";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) return <Loader />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <Navbar />
      <div className="flex-1 bg-[#f5f6fa] p-8 m-6 min-h-screen md:p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div
            className="
        flex flex-col items-start gap-4  /* <-- Default: stacked for mobile */
        md:flex-row md:justify-between md:items-center  /* <-- md: and up: side-by-side */
        mb-6 pb-4 border-b-[3px] border-[#2c3e50]"
          >
            {/* Left Side: Title and Subtitle */}
            <div>
              <h1 className="text-[#2c3e50] text-[2rem] m-0 font-bold md:text-2xl">
                Manage Training Vlogs
              </h1>
              <p className="text-gray-600 mt-2">
                Upload and manage training Vlogs
              </p>
            </div>

            {/* Right Side: Button (now outside the div) */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="
          w-full md:w-auto 
          bg-[#27ae60] hover:bg-[#229954] text-white px-6 py-3 
          rounded-lg font-medium shadow-md hover:shadow-lg 
          transition-all whitespace-nowrap"
            >
              + Add New Vlog
            </button>
          </div>

          {/* Vlogs Grid */}
          {vlogs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <p className="text-gray-500 text-lg">
                No training vlogs available. Create your first vlog to get
                started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {vlogs.map((vlog) => (
                <div
                  key={vlog.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                >
                  {/* Card Header with Gradient */}
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 relative">
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">🎥</span>
                        <div>
                          <p className="text-xs uppercase font-semibold opacity-90">
                            Video
                          </p>
                          <p className="text-xs opacity-75">
                            {formatFileSize(vlog.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                        <span className="text-xs font-medium">#{vlog.id}</span>
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail Section with Play Button */}
                  <div className="relative h-32 bg-gray-100 overflow-hidden group/thumbnail">
                    {vlog.thumbnail_url ? (
                      <img
                        src={getFullUrl(vlog.thumbnail_url)}
                        alt={vlog.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = "none";
                          e.target.nextElementSibling?.classList.remove(
                            "hidden"
                          );
                        }}
                      />
                    ) : null}
                    <div
                      className={`flex items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200 ${
                        vlog.thumbnail_url ? "hidden" : ""
                      }`}
                    >
                      <span className="text-4xl">🎬</span>
                    </div>

                    {/* Play Button Overlay */}
                    <div
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumbnail:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      onClick={() => handlePlayVideo(vlog)}
                    >
                      <div className="bg-white/90 rounded-full p-4 transform scale-100 group-hover/thumbnail:scale-110 transition-transform">
                        <svg
                          className="w-8 h-8 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3 relative z-10">
                    <h3 className="font-bold text-base text-gray-800 mb-2 line-clamp-1">
                      {vlog.title}
                    </h3>

                    {vlog.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {vlog.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="space-y-1 mb-3 text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-1">📅</span>
                        <span>Created: {formatDate(vlog.created_at)}</span>
                      </div>
                      {vlog.updated_at &&
                        vlog.updated_at !== vlog.created_at && (
                          <div className="flex items-center">
                            <span className="mr-1">🔄</span>
                            <span>Updated: {formatDate(vlog.updated_at)}</span>
                          </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handlePlayVideo(vlog)}
                        className="flex-1 bg-blue-50 text-blue-600 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors text-xs"
                      >
                        Play
                      </button>
                      <button
                        onClick={() => handleEdit(vlog)}
                        className="flex-1 bg-indigo-50 text-indigo-600 py-1.5 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("Delete button clicked for vlog:", vlog);
                          setSelectedVlog(vlog);
                          setShowDeleteModal(true);
                        }}
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

      {showCreateModal && (
        <CreateVlogModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchVlogs();
          }}
        />
      )}

      {showDeleteModal && selectedVlog && (
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedVlog(null);
          }}
          onConfirm={handleDelete}
          title="Delete Vlog"
          message={`Are you sure you want to delete "${selectedVlog.title}"?`}
          confirmText="Delete"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
        />
      )}

      {/* Video Player Modal */}
      {showVideoPlayer && selectedVlog && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4">
          <div className="relative w-full max-w-3xl">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowVideoPlayer(false);
                setSelectedVlog(null);
              }}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close video"
            >
              <svg
                className="w-8 h-8"
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

            {/* Video Player Container */}
            <div className="bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
              <div className="p-3 bg-gray-800 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white truncate">
                  {selectedVlog.title}
                </h2>
                {selectedVlog.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {selectedVlog.description}
                  </p>
                )}
              </div>

              <div className="relative bg-black">
                <video
                  src={getFullUrl(selectedVlog.file_url)}
                  controls
                  autoPlay
                  className="w-full h-auto"
                  style={{ maxHeight: "60vh" }}
                  controlsList="download"
                  onError={(e) => {
                    console.error("Video load error:", e);
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="p-3 bg-gray-800 border-t border-gray-700">
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>📦 {formatFileSize(selectedVlog.file_size)}</span>
                  <span>📅 {formatDate(selectedVlog.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ManageVlogs;
