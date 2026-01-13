// AssignedTrainingsList.jsx - View assigned trainings for regular users

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { BookOpen, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import AssignedTrainingCard from "../../components/AssignedTrainingCard";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/Pages.css";
import "../../styles/admin/AssignedTrainingsList.css";

const AssignedTrainingsList = () => {
    const navigate = useNavigate();
    const { id: trainingId } = useParams();
    const { user } = useAuth();

    // List Management
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState({ skip: 0, limit: 10, total: 0 });

    // Detail Modal
    const [selectedTraining, setSelectedTraining] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    // Fetch trainings on mount and when pagination changes
    useEffect(() => {
        fetchTrainings();
    }, [pagination.skip]);

    // Open detail modal if trainingId in URL
    useEffect(() => {
        if (trainingId) {
            handleViewTraining(parseInt(trainingId));
        }
    }, [trainingId]);

    const fetchTrainings = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await assignedTrainingService.getMyAssignedTrainings({
                skip: pagination.skip,
                limit: pagination.limit,
            });
            setTrainings(data.items || []);
            setPagination((prev) => ({ ...prev, total: data.total || 0 }));
        } catch (err) {
            console.error("Error fetching trainings:", err);
            setError("Failed to load your assigned trainings. Please try again.");
            toast.error("Failed to load trainings", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleViewTraining = async (training_id) => {
        try {
            setDetailLoading(true);
            const training = await assignedTrainingService.getAssignedTraining(training_id);
            setSelectedTraining(training);
            setShowDetailModal(true);
        } catch (err) {
            console.error("Error loading training:", err);
            toast.error("Failed to load training details", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setDetailLoading(false);
        }
    };

    const handleMarkInProgress = async (trainingId) => {
        try {
            const updated = await assignedTrainingService.markInProgress(trainingId);

            // Update local state
            setTrainings((prev) =>
                prev.map((t) =>
                    t.id === trainingId
                        ? { ...t, user_status: updated.user_status, user_started_at: updated.user_started_at }
                        : t
                )
            );

            if (showDetailModal && selectedTraining?.id === trainingId) {
                setSelectedTraining({
                    ...selectedTraining,
                    user_status: updated.user_status,
                    user_started_at: updated.user_started_at,
                });
            }

            toast.success("Training started!", {
                position: "top-center",
                autoClose: 3000,
            });
        } catch (err) {
            console.error("Error marking training in progress:", err);
            toast.error("Failed to start training", {
                position: "top-center",
                autoClose: 3000,
            });
        }
    };

    const handleMarkComplete = async (trainingId, evidence = null) => {
        try {
            const updated = await assignedTrainingService.markComplete(trainingId, { evidence });

            // Update local state
            setTrainings((prev) =>
                prev.map((t) =>
                    t.id === trainingId
                        ? {
                            ...t,
                            user_status: updated.user_status,
                            user_completed_at: updated.user_completed_at,
                        }
                        : t
                )
            );

            if (showDetailModal && selectedTraining?.id === trainingId) {
                setSelectedTraining({
                    ...selectedTraining,
                    user_status: updated.user_status,
                    user_completed_at: updated.user_completed_at,
                });
            }

            toast.success("Training marked as complete!", {
                position: "top-center",
                autoClose: 3000,
            });
        } catch (err) {
            console.error("Error marking training complete:", err);
            toast.error("Failed to mark training complete", {
                position: "top-center",
                autoClose: 3000,
            });
        }
    };

    const getCompletionStats = () => {
        const completed = trainings.filter((t) => t.user_status === "COMPLETED").length;
        const inProgress = trainings.filter((t) => t.user_status === "IN_PROGRESS").length;
        const notStarted = trainings.filter((t) => t.user_status === "NEW").length;

        return { completed, inProgress, notStarted };
    };

    const stats = getCompletionStats();

    return (
        <div className="page-container">
            <Navbar />
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <div>
                            <h1 className="page-title">Assigned Learning</h1>
                            <p className="page-description">
                                View and complete trainings assigned to you
                            </p>
                        </div>
                    </div>

                    {/* Stats Section */}
                    {!loading && trainings.length > 0 && (
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon completed">
                                    <CheckCircle size={24} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-number">{stats.completed}</div>
                                    <div className="stat-label">Completed</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon in-progress">
                                    <BookOpen size={24} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-number">{stats.inProgress}</div>
                                    <div className="stat-label">In Progress</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon not-started">
                                    <AlertCircle size={24} />
                                </div>
                                <div className="stat-content">
                                    <div className="stat-number">{stats.notStarted}</div>
                                    <div className="stat-label">New</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="icon-md error-icon" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading your trainings...</p>
                        </div>
                    ) : (
                        <>
                            {/* Training Cards Grid */}
                            <div className="trainings-grid">
                                {trainings.length === 0 ? (
                                    <div className="empty-state">
                                        <BookOpen className="empty-state-icon" />
                                        <h3 className="empty-state-title">
                                            No trainings assigned yet
                                        </h3>
                                        <p className="empty-state-description">
                                            Check back later for new training assignments
                                        </p>
                                    </div>
                                ) : (
                                    trainings.map((training) => (
                                        <AssignedTrainingCard
                                            key={training.id}
                                            training={training}
                                            isAdmin={false}
                                            onView={handleViewTraining}
                                            onMarkInProgress={handleMarkInProgress}
                                            onMarkComplete={handleMarkComplete}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Pagination */}
                            {trainings.length > 0 && (
                                <div className="pagination-section">
                                    <button
                                        disabled={pagination.skip === 0}
                                        onClick={() =>
                                            setPagination((prev) => ({
                                                ...prev,
                                                skip: Math.max(0, prev.skip - prev.limit),
                                            }))
                                        }
                                        className="pagination-btn"
                                    >
                                        Previous
                                    </button>
                                    <span className="pagination-info">
                                        Showing {pagination.skip + 1} to{" "}
                                        {Math.min(
                                            pagination.skip + pagination.limit,
                                            pagination.total
                                        )}{" "}
                                        of {pagination.total}
                                    </span>
                                    <button
                                        disabled={
                                            pagination.skip + pagination.limit >= pagination.total
                                        }
                                        onClick={() =>
                                            setPagination((prev) => ({
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
            </main>

            {/* Training Detail Modal */}
            {showDetailModal && selectedTraining && (
                <div className="detail-modal-overlay">
                    <div className="detail-modal">
                        <button
                            onClick={() => setShowDetailModal(false)}
                            className="detail-modal-close"
                            title="Close"
                        >
                            ✕
                        </button>

                        {detailLoading ? (
                            <div className="detail-loading">
                                <Loader2 className="loading-spinner" />
                                <p>Loading training details...</p>
                            </div>
                        ) : (
                            <>
                                {/* Modal Header */}
                                <div className="detail-modal-header">
                                    <span className="training-type-badge">
                                        {selectedTraining.training_type === "custom"
                                            ? "Internal Training"
                                            : selectedTraining.training_type}
                                    </span>
                                    <h2>{selectedTraining.title}</h2>
                                </div>

                                {/* Modal Content */}
                                <div className="detail-modal-content">
                                    {selectedTraining.description && (
                                        <div className="detail-section">
                                            <h3 className="detail-section-title">Description</h3>
                                            <p className="detail-text">{selectedTraining.description}</p>
                                        </div>
                                    )}

                                    {selectedTraining.custom_content && (
                                        <div className="detail-section">
                                            <h3 className="detail-section-title">Content</h3>
                                            <div className="detail-content">
                                                {selectedTraining.custom_content}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dates */}
                                    {(selectedTraining.start_date || selectedTraining.end_date) && (
                                        <div className="detail-section">
                                            <h3 className="detail-section-title">Timeline</h3>
                                            <div className="detail-dates">
                                                {selectedTraining.start_date && (
                                                    <div className="date-item">
                                                        <span className="date-label">Start Date:</span>
                                                        <span className="date-value">
                                                            {new Date(
                                                                selectedTraining.start_date
                                                            ).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                                {selectedTraining.end_date && (
                                                    <div className="date-item">
                                                        <span className="date-label">Due Date:</span>
                                                        <span className="date-value">
                                                            {new Date(
                                                                selectedTraining.end_date
                                                            ).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Status */}
                                    <div className="detail-section">
                                        <h3 className="detail-section-title">Your Progress</h3>
                                        <div className="detail-status">
                                            {selectedTraining.user_status === "COMPLETED" && (
                                                <div className="status-badge completed">
                                                    <CheckCircle size={18} />
                                                    Completed
                                                </div>
                                            )}
                                            {selectedTraining.user_status === "IN_PROGRESS" && (
                                                <div className="status-badge in-progress">
                                                    <BookOpen size={18} />
                                                    In Progress
                                                </div>
                                            )}
                                            {selectedTraining.user_status === "NEW" && (
                                                <div className="status-badge not-started">
                                                    <AlertCircle size={18} />
                                                    Not Started
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Actions */}
                                <div className="detail-modal-footer">
                                    <button
                                        onClick={() => setShowDetailModal(false)}
                                        className="detail-btn secondary"
                                    >
                                        Close
                                    </button>

                                    {selectedTraining.user_status === "NOT_STARTED" && (
                                        <button
                                            onClick={() => {
                                                handleMarkInProgress(selectedTraining.id);
                                            }}
                                            className="detail-btn primary"
                                        >
                                            Start Training
                                        </button>
                                    )}

                                    {selectedTraining.user_status === "IN_PROGRESS" && (
                                        <button
                                            onClick={() => {
                                                handleMarkComplete(selectedTraining.id);
                                            }}
                                            className="detail-btn success"
                                        >
                                            Mark as Complete
                                        </button>
                                    )}

                                    {selectedTraining.user_status === "COMPLETED" && (
                                        <div className="completed-message">
                                            ✓ Completed on{" "}
                                            {new Date(
                                                selectedTraining.user_completed_at
                                            ).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default AssignedTrainingsList;
