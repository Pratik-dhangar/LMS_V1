import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import galleryService from "../../api/services/galleryService";
import { getFileUrl } from "../../utils/urlHelper";
import ConfirmModal from "../../components/common/ConfirmModal";
import Loader from "../../components/common/Loader";
import ErrorState from "../../components/common/ErrorState";
import CreateGalleryModal from "../../components/admin/Gallery/CreateGalleryModal";
import "../../styles/admin/AdminManageGallery.css";
import "../../styles/ManageUsersLayout.css";

const ManageGallery = () => {
    const navigate = useNavigate();
    const [galleries, setGalleries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedGallery, setSelectedGallery] = useState(null);


    const fetchGalleries = async () => {
        try {
            setLoading(true);
            const data = await galleryService.getAllGalleries();
            setGalleries(data);
            setError(null);
        } catch {
            setError("Failed to fetch gallery photos. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGalleries();
    }, []);

    const handleEdit = (gallery) => {
        navigate(`/admin/gallery/${gallery.id}/edit`);
    };

    const handleDelete = async () => {
        console.log("Delete initiated for gallery:", selectedGallery);
        try {
            const result = await galleryService.deleteGallery(selectedGallery.id);
            console.log("Delete result:", result);
            setGalleries(galleries.filter((gallery) => gallery.id !== selectedGallery.id));
            setShowDeleteModal(false);
            setSelectedGallery(null);
        } catch (err) {
            console.error("Delete error:", err);
            console.error("Error details:", err.response?.data || err.message);
            setError("Failed to delete gallery photo. Please try again later.");
            setShowDeleteModal(false);
        }
    };

    const filteredGalleries = galleries;

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
                            <h1 className="page-title">Manage Gallery</h1>
                            <p className="page-description">Upload and manage gallery photos</p>
                        </div>
                    </div>

                    {/* Search Bar and Add Button */}
                    <div className="search-section">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="app-modal-btn app-modal-btn--success"
                        >
                            + Add New Photo
                        </button>
                    </div>
                    {/* Gallery Grid */}
                    {galleries.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state-description">
                                No gallery photos available. Create your first photo to get started!
                            </p>
                        </div>
                    ) : filteredGalleries.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state-description">
                                No gallery photos available.
                            </p>
                        </div>
                    ) : (
                        <div className="admin-content-grid">
                            {filteredGalleries.map((gallery) => (
                                <div key={gallery.id} className="admin-content-card">
                                    {/* Card Header */}
                                    <div className="admin-content-card-header">
                                        <div className="admin-content-card-header-left">
                                            <span className="admin-content-icon">🖼️</span>
                                            <div>
                                                <p className="admin-content-type-text">Image</p>
                                                <p className="admin-content-size-text">
                                                    {formatFileSize(gallery.photo_size)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="admin-content-id-badge">
                                            <span>#{gallery.id}</span>
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    <div className="admin-content-preview">
                                        {gallery.photo_url || gallery.thumbnail_url ? (
                                            <img
                                                src={getFileUrl(gallery.thumbnail_url || gallery.photo_url)}
                                                alt={`Gallery image ${gallery.id}`}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                }}
                                                onError={(e) => {
                                                    e.target.onerror = null;
                                                    e.target.style.display = "none";
                                                    e.target.nextElementSibling?.classList.remove("hidden");
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className={`hidden ${gallery.photo_url ? "" : "block"}`}
                                            style={{ fontSize: "2rem", color: "rgba(0, 0, 0, 0.2)" }}
                                        >
                                            🖼️
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="admin-content-card-body">
                                        <span
                                            className={`admin-content-status-badge ${gallery.status === "published"
                                                ? "admin-content-status-published"
                                                : "admin-content-status-draft"
                                                }`}
                                        >
                                            {gallery.status === "published" ? "✓ Published" : "📝 Draft"}
                                        </span>

                                        {/* Title and description removed per new requirements */}

                                        {/* Metadata */}
                                        <div className="admin-content-meta">
                                            <div className="admin-content-meta-item">
                                                <span>📅</span>
                                                <span>Created: {formatDate(gallery.created_at)}</span>
                                            </div>
                                            {gallery.updated_at && gallery.updated_at !== gallery.created_at && (
                                                <div className="admin-content-meta-item">
                                                    <span>🔄</span>
                                                    <span>Updated: {formatDate(gallery.updated_at)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="admin-content-actions">
                                            <a
                                                href={getFileUrl(gallery.photo_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="app-modal-btn app-modal-btn--secondary btn-sm"
                                            >
                                                View
                                            </a>
                                            <button
                                                onClick={() => handleEdit(gallery)}
                                                className="app-modal-btn app-modal-btn--primary btn-sm"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedGallery(gallery);
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

            {/* Create Modal */}
            {showCreateModal && (
                <CreateGalleryModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchGalleries();
                    }}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedGallery && (
                <ConfirmModal
                    show={showDeleteModal}
                    title="Delete Gallery Photo"
                    message={`Are you sure you want to delete this photo (#${selectedGallery.id})? This action cannot be undone.`}
                    onConfirm={handleDelete}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setSelectedGallery(null);
                    }}
                    confirmText="Delete"
                    confirmColor="danger"
                />
            )}
        </>
    );
};

export default ManageGallery;
