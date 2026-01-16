import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import vlogService from "../../api/services/vlogService";
import ConfirmModal from "../../components/common/ConfirmModal";
import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/ErrorState";
import CreateVlogModal from "../../components/admin/Vlogs/CreateVlogModal";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/admin/AdminManageVlogs.css";
import "../../styles/ManageUsersLayout.css";

const ManageVlogs = () => {
  const navigate = useNavigate();
  const [vlogs, setVlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedVlog, setSelectedVlog] = useState(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  const fetchVlogs = async () => {
    try {
      setLoading(true);
      const data = await vlogService.getAllVlogs();
      setVlogs(data);
      setError(null);
    } catch {
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

  const handleSearch = (query) => {
    setActiveSearchQuery(query);
  };

  const filteredVlogs = vlogs.filter(
    (vlog) =>
      vlog.title.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      (vlog.description &&
        vlog.description
          .toLowerCase()
          .includes(activeSearchQuery.toLowerCase())) ||
      (vlog.vlog_type &&
        vlog.vlog_type.toLowerCase().includes(activeSearchQuery.toLowerCase()))
  );

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
    <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/admin/dashboard")}
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
              Back to Dashboard
            </button>
            {/* Left Side: Title and Subtitle */}
            <div>
              <h1 className="page-title">Manage Training Vlogs</h1>
              <p className="page-description">
                Upload and manage training Vlogs
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
              onClick={() => setShowCreateModal(true)}
              className="app-modal-btn app-modal-btn--success"
            >
              + Add New Vlog
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredVlogs.length} of {vlogs.length} vlogs
              </p>
            </div>
          )}

          {/* Vlogs Grid */}
          {vlogs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                No training vlogs available. Create your first vlog to get
                started!
              </p>
            </div>
          ) : filteredVlogs.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                No vlogs match your search. Try a different search term.
              </p>
            </div>
          ) : (
            <div className="admin-content-grid">
              {filteredVlogs.map((vlog) => (
                <div key={vlog.id} className="admin-content-card">
                  {/* Card Header */}
                  <div className="admin-content-card-header">
                    <div className="admin-content-card-header-left">
                      <span className="admin-content-icon">🎥</span>
                      <div>
                        <p className="admin-content-type-text">Video</p>
                        <p className="admin-content-size-text">
                          {formatFileSize(vlog.file_size)}
                        </p>
                      </div>
                    </div>
                    <div className="admin-content-id-badge">
                      <span>#{vlog.id}</span>
                    </div>
                  </div>

                  {/* Preview Section */}
                  <div className="admin-content-preview">
                    {vlog.thumbnail_url ? (
                      <img
                        src={getFullUrl(vlog.thumbnail_url)}
                        alt={vlog.title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
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
                      className={`hidden ${vlog.thumbnail_url ? "" : "block"}`}
                      style={{ fontSize: "2rem", color: "rgba(0, 0, 0, 0.2)" }}
                    >
                      🎬
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="admin-content-card-body">
                    <span
                      className={`admin-content-status-badge ${
                        vlog.status === "published"
                          ? "admin-content-status-published"
                          : "admin-content-status-draft"
                      }`}
                    >
                      {vlog.status === "published" ? "✓ Published" : "📝 Draft"}
                    </span>

                    <h3 className="admin-content-title">{vlog.title}</h3>

                    {vlog.description && (
                      <p className="admin-content-description">
                        {vlog.description}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="admin-content-meta">
                      <div className="admin-content-meta-item">
                        <span>📅</span>
                        <span>Created: {formatDate(vlog.created_at)}</span>
                      </div>
                      {vlog.updated_at &&
                        vlog.updated_at !== vlog.created_at && (
                          <div className="admin-content-meta-item">
                            <span>🔄</span>
                            <span>Updated: {formatDate(vlog.updated_at)}</span>
                          </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="admin-content-actions">
                      <a
                        href={getFullUrl(vlog.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-modal-btn app-modal-btn--secondary btn-sm"
                      >
                        Play
                      </a>
                      <button
                        onClick={() => handleEdit(vlog)}
                        className="app-modal-btn app-modal-btn--primary btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVlog(vlog);
                          setShowDeleteModal(true);
                        }}
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
    </>
  );
};

export default ManageVlogs;
