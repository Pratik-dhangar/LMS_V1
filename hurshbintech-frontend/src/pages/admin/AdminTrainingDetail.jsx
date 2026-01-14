// AdminTrainingDetail.jsx - Full detail view for admin with assigned users

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/animations.css";
import "../../styles/admin/AdminTrainingDetail.css";

const AdminTrainingDetail = () => {
    const navigate = useNavigate();
    const { id: trainingId } = useParams();
    const { user } = useAuth();

    // Training Data
    const [training, setTraining] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Users Data
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersPagination, setUsersPagination] = useState({ skip: 0, limit: 50, total: 0 });

    // UI State
    const [showContent, setShowContent] = useState(false);
    const [pageLoaded, setPageLoaded] = useState(false);

    // Fetch training details
    useEffect(() => {
        fetchTrainingDetails();
    }, [trainingId]);

    // Trigger animations after training is loaded
    useEffect(() => {
        if (training && !loading) {
            // Small delay to ensure rendering is complete
            const timer = setTimeout(() => setPageLoaded(true), 50);
            return () => clearTimeout(timer);
        }
    }, [training, loading]);

    // Fetch assigned users
    useEffect(() => {
        if (training?.id) {
            fetchAssignedUsers();
        }
    }, [training?.id, usersPagination.skip]);

    const fetchTrainingDetails = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await assignedTrainingService.adminGet(trainingId);
            console.log("Training data loaded:", data);
            console.log("Training files:", data.custom_metadata?.training_files);
            setTraining(data);
        } catch (err) {
            console.error("Error fetching training:", err);
            setError("Failed to load training details. Please try again.");
            toast.error("Failed to load training details", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAssignedUsers = async () => {
        if (!training?.id) return;

        try {
            setUsersLoading(true);
            const data = await assignedTrainingService.adminGetAssignedUsers(training.id, {
                skip: usersPagination.skip,
                limit: usersPagination.limit,
            });
            setAssignedUsers(data.items || []);
            setUsersPagination((prev) => ({ ...prev, total: data.total || 0 }));
        } catch (err) {
            console.error("Error fetching assigned users:", err);
            toast.error("Failed to load assigned users", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setUsersLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleDownloadFile = async (fileUrl, fileName) => {
        try {
            // Fetch the file
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to download file: ${response.statusText}`);
            }

            // Get the file blob
            const blob = await response.blob();

            // Create a temporary URL for the blob
            const blobUrl = window.URL.createObjectURL(blob);

            // Create a temporary anchor element and trigger download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName || 'download';
            document.body.appendChild(link);
            link.click();

            // Clean up
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);

            toast.success(`${fileName} downloaded successfully`);
        } catch (error) {
            console.error("Download error:", error);
            toast.error(`Failed to download ${fileName}`);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <Navbar />
                <main className="page-main">
                    <div className="page-content">
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading training details...</p>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="page-container">
                <Navbar />
                <main className="page-main">
                    <div className="page-content">
                        <button
                            onClick={() => navigate("/admin/assigned-trainings")}
                            className="back-button"
                        >
                            <ArrowLeft size={20} />
                            Back to Trainings
                        </button>
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="icon-md error-icon" />
                                <p>{error || "Training not found"}</p>
                            </div>
                        </div>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="page-container">
            <Navbar />
            <main className="page-main">
                <div className={`page-content ${pageLoaded ? 'fade-transition' : ''}`}>
                    {/* Back Button */}
                    <button
                        onClick={() => navigate("/admin/assigned-trainings")}
                        className="back-button"
                    >
                        <ArrowLeft size={20} />
                        Back to Trainings
                    </button>

                    {/* Training Header */}
                    <div className="detail-header">
                        <div className="detail-header-content">
                            <h1 className="detail-title">{training.title}</h1>
                            <p className="detail-meta">
                                <span className="meta-text">
                                    {training.training_type || "Internal Training"}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Featured Image */}
                    {training.custom_metadata?.featured_image_url && (
                        <div className="featured-image-section">
                            <img
                                src={training.custom_metadata.featured_image_url}
                                alt={training.title}
                                className="featured-image"
                            />
                        </div>
                    )}

                    {/* Training Details Section */}
                    <div className="detail-sections">
                        {/* Description */}
                        {training.description && (
                            <section className="detail-section">
                                <h2 className="section-title">Description</h2>
                                <p className="section-content">{training.description}</p>
                            </section>
                        )}

                        {/* Key Information */}
                        <section className="detail-section">
                            <h2 className="section-title">Key Information</h2>
                            <div className="info-grid">
                                {training.start_date && (
                                    <div className="info-item">
                                        <span className="info-label">Start Date</span>
                                        <span className="info-value">
                                            {formatDate(training.start_date)}
                                        </span>
                                    </div>
                                )}
                                {training.end_date && (
                                    <div className="info-item">
                                        <span className="info-label">End Date</span>
                                        <span className="info-value">
                                            {formatDate(training.end_date)}
                                        </span>
                                    </div>
                                )}
                                <div className="info-item">
                                    <span className="info-label">Target Roles</span>
                                    <span className="info-value">
                                        {Array.isArray(training.target_roles)
                                            ? training.target_roles.join(", ")
                                            : "All"}
                                    </span>
                                </div>
                                <div className="info-item">
                                    <span className="info-label">Created Date</span>
                                    <span className="info-value">
                                        {formatDate(training.created_at)}
                                    </span>
                                </div>
                            </div>
                        </section>

                        {/* Custom Content */}
                        {training.custom_content && (
                            <section className="detail-section">
                                <h2 className="section-title">Training Content</h2>
                                <button
                                    className="content-toggle-btn"
                                    onClick={() => setShowContent(!showContent)}
                                >
                                    {showContent ? (
                                        <>
                                            <EyeOff size={16} />
                                            Hide Content
                                        </>
                                    ) : (
                                        <>
                                            <Eye size={16} />
                                            Show Content
                                        </>
                                    )}
                                </button>
                                {showContent && (
                                    <div
                                        className="html-content"
                                        dangerouslySetInnerHTML={{ __html: training.custom_content }}
                                    />
                                )}
                            </section>
                        )}

                        {/* Training Files */}
                        {training.custom_metadata?.training_files &&
                            training.custom_metadata.training_files.length > 0 && (
                                <section className="detail-section">
                                    <h2 className="section-title">Training Materials</h2>
                                    <div className="files-list">
                                        {training.custom_metadata.training_files.map((file, index) => {
                                            // Handle both string and object file formats
                                            const fileName = typeof file === 'string' ? file : (file.name || file);
                                            let fileUrl = typeof file === 'object' && file.url ? file.url : null;

                                            // If URL is a relative path, prepend the API base URL
                                            if (fileUrl && !fileUrl.startsWith('http')) {
                                                const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
                                                // Remove /api from the end and append the file path
                                                const baseUrl = apiBase.replace('/api', '');
                                                fileUrl = `${baseUrl}/${fileUrl}`;
                                            }

                                            console.log(`File ${index}:`, { fileName, fileUrl, original: file });

                                            return (
                                                <div key={index} className="file-item">
                                                    <span className="file-name">{fileName}</span>
                                                    {fileUrl && (
                                                        <div className="file-actions">
                                                            <a
                                                                href={fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="file-link view"
                                                                title="View file"
                                                            >
                                                                <Eye size={16} />
                                                                View
                                                            </a>
                                                            <button
                                                                onClick={() => handleDownloadFile(fileUrl, fileName)}
                                                                className="file-link download"
                                                                title="Download file"
                                                            >
                                                                Download
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                    </div>

                    {/* Assigned Users Section */}
                    <div className="users-section">
                        <div className="users-header">
                            <h2 className="section-title">
                                Assigned Users ({usersPagination.total})
                            </h2>
                        </div>

                        {usersLoading ? (
                            <div className="users-loading">
                                <Loader2 className="loading-spinner" />
                                <p>Loading assigned users...</p>
                            </div>
                        ) : assignedUsers.length === 0 ? (
                            <div className="users-empty">
                                <p>No users assigned to this training yet</p>
                            </div>
                        ) : (
                            <>
                                <div className="users-list">
                                    {assignedUsers.map((user) => (
                                        <div key={user.user_id} className="user-item">
                                            <span className="user-name">{user.user_name}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {usersPagination.total > usersPagination.limit && (
                                    <div className="pagination-section">
                                        <button
                                            disabled={usersPagination.skip === 0}
                                            onClick={() =>
                                                setUsersPagination((prev) => ({
                                                    ...prev,
                                                    skip: Math.max(0, prev.skip - prev.limit),
                                                }))
                                            }
                                            className="pagination-btn"
                                        >
                                            Previous
                                        </button>
                                        <span className="pagination-info">
                                            Showing {usersPagination.skip + 1} to{" "}
                                            {Math.min(
                                                usersPagination.skip + usersPagination.limit,
                                                usersPagination.total
                                            )}{" "}
                                            of {usersPagination.total}
                                        </span>
                                        <button
                                            disabled={
                                                usersPagination.skip + usersPagination.limit >=
                                                usersPagination.total
                                            }
                                            onClick={() =>
                                                setUsersPagination((prev) => ({
                                                    ...prev,
                                                    skip: prev.skip + prev.limit,
                                                }))
                                            }
                                            className="pagination-btn"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default AdminTrainingDetail;
