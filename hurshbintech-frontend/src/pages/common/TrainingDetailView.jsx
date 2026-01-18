// TrainingDetailView.jsx - Dedicated detail page for non-admin users to view assigned trainings

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, AlertCircle, Loader2, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/animations.css";
import "../../styles/admin/AdminTrainingDetail.css";

const TrainingDetailView = () => {
    const navigate = useNavigate();
    const { id: trainingId } = useParams();
    const { user } = useAuth();

    // Training Data
    const [training, setTraining] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    const fetchTrainingDetails = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await assignedTrainingService.getAssignedTraining(trainingId);
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
                <main className="page-main">
                    <div className="page-content">
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading training details...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (error || !training) {
        return (
            <div className="page-container">
                <main className="page-main">
                    <div className="page-content">
                        <button
                            onClick={() => navigate("/assigned-learning")}
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
            </div>
        );
    }

    return (
        <div className="page-container">
            <main className="page-main">
                <div className={`page-content ${pageLoaded ? 'fade-transition' : ''}`}>


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

                    {/* Thumbnail Image */}
                    {training.featured_image_url && (
                        <div className="featured-image-section">
                            <img
                                src={training.featured_image_url}
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
                                            <Eye size={16} />
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
                        {training.training_files && training.training_files.length > 0 && (
                            <section className="detail-section">
                                <h2 className="section-title">Training Materials</h2>
                                <div className="files-list">
                                    {training.training_files.map((file, index) => {
                                        // Handle both string and object file formats
                                        const fileName = typeof file === 'string' ? file : (file.name || file);
                                        let fileUrl = typeof file === 'object' && file.url ? file.url : null;

                                        // If URL is a relative path, prepend the base URL
                                        if (fileUrl && !fileUrl.startsWith('http')) {
                                            const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
                                            // Remove /api from the end and append the file path
                                            const baseUrl = apiBase.replace('/api', '');
                                            fileUrl = `${baseUrl}${fileUrl}`;
                                        }

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
                </div>
            </main>
        </div>
    );
};

export default TrainingDetailView;
