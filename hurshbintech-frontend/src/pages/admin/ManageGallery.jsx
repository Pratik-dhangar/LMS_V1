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
    const [selectedMedia, setSelectedMedia] = useState(null);


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
            setError("Failed to delete gallery item. Please try again later.");
            setShowDeleteModal(false);
        }
    };

    const filteredGalleries = galleries;

    const inferMediaType = (gallery) => {
        const mediaUrl = gallery.video_url || gallery.photo_url || '';
        const lowerUrl = mediaUrl.toLowerCase();
        const isVideo = Boolean(
            gallery.video_url ||
            lowerUrl.endsWith('.mp4') ||
            lowerUrl.endsWith('.webm') ||
            lowerUrl.endsWith('.ogg') ||
            lowerUrl.endsWith('.mov') ||
            lowerUrl.endsWith('.quicktime')
        );

        return {
            type: isVideo ? 'video' : 'image',
            url: getFileUrl(gallery.video_url || gallery.photo_url),
            poster: getFileUrl(gallery.video_thumbnail_url || gallery.thumbnail_url),
        };
    };

    const handleView = (gallery) => {
        setSelectedMedia(inferMediaType(gallery));
    };

    const renderGalleryPreview = (gallery) => {
        const mediaType = inferMediaType(gallery).type;

        if (mediaType === "video") {
            const posterUrl = gallery.video_thumbnail_url || gallery.thumbnail_url;

            return (
                <div className="admin-gallery-media admin-gallery-media--video">
                    {posterUrl ? (
                        <img
                            src={getFileUrl(posterUrl)}
                            alt={`Video thumbnail ${gallery.id}`}
                            className="admin-gallery-media__image"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                                e.target.nextElementSibling?.classList.remove("hidden");
                            }}
                        />
                    ) : (
                        <video
                            src={getFileUrl(gallery.video_url)}
                            className="admin-gallery-media__video"
                            muted
                            loop
                            playsInline
                            preload="metadata"
                        />
                    )}

                    <div className="admin-gallery-media__badge">
                        <span className="admin-gallery-media__badge-icon">▶</span>
                    </div>
                    
                </div>
            );
        }

        return (
            <div className="admin-gallery-media admin-gallery-media--image">
                {gallery.thumbnail_url || gallery.photo_url ? (
                    <img
                        src={getFileUrl(gallery.thumbnail_url || gallery.photo_url)}
                        alt={`Gallery image ${gallery.id}`}
                        className="admin-gallery-media__image"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = "none";
                            e.target.nextElementSibling?.classList.remove("hidden");
                        }}
                    />
                ) : null}
                
            </div>
        );
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
                            + Add Photo or Video
                        </button>
                    </div>
                    {/* Gallery Grid */}
                    {galleries.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state-description">
                                No gallery items available. Create your first photo or video to get started!
                            </p>
                        </div>
                    ) : filteredGalleries.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state-description">
                                No gallery items available.
                            </p>
                        </div>
                    ) : (
                        <div className="admin-content-grid">
                            {filteredGalleries.map((gallery) => (
                                <div key={gallery.id} className="admin-content-card">
                                    {/* Card Header */}
                                    <div className="admin-content-card-header">
                                        <div className="admin-content-card-header-left">
                                            <span className="admin-content-icon">
                                                {inferMediaType(gallery).type === "video" ? "🎬" : "🖼️"}
                                            </span>
                                            <div>
                                                <p className="admin-content-type-text">
                                                    {inferMediaType(gallery).type === "video" ? "Video" : "Image"}
                                                </p>
                                                <p className="admin-content-size-text">
                                                    {formatFileSize(inferMediaType(gallery).type === "video" ? (gallery.video_size || gallery.photo_size) : gallery.photo_size)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="admin-content-id-badge">
                                            <span>#{gallery.id}</span>
                                        </div>
                                    </div>

                                    {/* Preview Section */}
                                    <div className="admin-content-preview">
                                        {renderGalleryPreview(gallery)}
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
                                            <button
                                                type="button"
                                                onClick={() => handleView(gallery)}
                                                className="app-modal-btn app-modal-btn--secondary btn-sm"
                                            >
                                                View
                                            </button>
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
                    title="Delete Gallery Item"
                    message={`Are you sure you want to delete this ${selectedGallery.video_url ? "video" : "photo"} (#${selectedGallery.id})? This action cannot be undone.`}
                    onConfirm={handleDelete}
                    onClose={() => {
                        setShowDeleteModal(false);
                        setSelectedGallery(null);
                    }}
                    confirmText="Delete"
                    confirmColor="danger"
                />
            )}

            {selectedMedia && (
                <div className="app-modal-overlay" onClick={() => setSelectedMedia(null)}>
                    <div
                        className="app-modal-container app-modal-container--md"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '900px' }}
                    >
                        <div className="app-modal-header app-modal-header--primary">
                            <h2 className="app-modal-title">Media Preview</h2>
                            <button
                                type="button"
                                onClick={() => setSelectedMedia(null)}
                                className="app-modal-close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="app-modal-content" style={{ paddingTop: '1rem' }}>
                            {selectedMedia.type === 'video' ? (
                                <video
                                    src={selectedMedia.url}
                                    poster={selectedMedia.poster || undefined}
                                    controls
                                    autoPlay
                                    playsInline
                                    preload="metadata"
                                    style={{ width: '100%', maxHeight: '70vh', borderRadius: '12px', background: '#000' }}
                                />
                            ) : (
                                <img
                                    src={selectedMedia.url}
                                    alt="Gallery preview"
                                    style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ManageGallery;
