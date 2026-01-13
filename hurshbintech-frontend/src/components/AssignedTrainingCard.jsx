import React, { useState } from "react";
import { Eye, Trash2, Edit3, CheckCircle, Clock, AlertCircle } from "lucide-react";
import "../styles/admin/AssignedTrainingCard.css";

/**
 * AssignedTrainingCard - Reusable card component for displaying assigned trainings
 * Similar to blog cards, shows training title, description, dates, status, and CTAs
 * 
 * @param {Object} training - Training object
 * @param {number} training.id - Training ID
 * @param {string} training.title - Training title
 * @param {string} training.description - Short description
 * @param {string} training.training_type - Type: 'custom', 'program', 'content', 'vlog'
 * @param {string} training.custom_content - Full HTML content (optional)
 * @param {Date} training.start_date - Start date
 * @param {Date} training.end_date - End date
 * @param {string} training.user_status - User status: 'NEW', 'IN_PROGRESS', 'COMPLETED'
 * @param {Date} training.user_completed_at - When user completed (optional)
 * @param {Object} training.user_progress - User progress data (optional)
 * @param {boolean} training.active - Is active
 * @param {Object} props
 * @param {boolean} props.isAdmin - Show admin actions (edit, delete)
 * @param {function} props.onView - Callback when View/Open clicked
 * @param {function} props.onEdit - Callback when Edit clicked (admin only)
 * @param {function} props.onDelete - Callback when Delete clicked (admin only)
 * @param {function} props.onMarkInProgress - Callback when Start clicked
 * @param {function} props.onMarkComplete - Callback when Mark Complete clicked
 */
const AssignedTrainingCard = ({
    training,
    isAdmin = false,
    onView,
    onEdit,
    onDelete,
    onMarkInProgress,
    onMarkComplete,
}) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    const getStatusBadge = () => {
        const status = training.user_status || "NEW";

        switch (status) {
            case "COMPLETED":
                return (
                    <div className="training-card-status completed">
                        <CheckCircle className="status-icon" />
                        <span>Completed</span>
                    </div>
                );
            case "IN_PROGRESS":
                return (
                    <div className="training-card-status in-progress">
                        <Clock className="status-icon" />
                        <span>In Progress</span>
                    </div>
                );
            case "NEW":
            default:
                return (
                    <div className="training-card-status not-started">
                        <AlertCircle className="status-icon" />
                        <span>New</span>
                    </div>
                );
        }
    };

    const getTrainingTypeLabel = () => {
        const typeMap = {
            custom: "Internal Training",
            program: "Program",
            content: "Learning Content",
            vlog: "Video",
        };
        return typeMap[training.training_type] || training.training_type;
    };

    const isOverdue = (endDate) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    return (
        <article className="training-card">
            {/* Card Header */}
            <div className="training-card-header">
                <div className="training-card-meta">
                    <span className="training-card-type">{getTrainingTypeLabel()}</span>
                    {!training.active && (
                        <span className="training-card-inactive">Inactive</span>
                    )}
                    {isOverdue(training.end_date) && (
                        <span className="training-card-overdue">Overdue</span>
                    )}
                </div>

                {/* Admin Actions */}
                {isAdmin && (
                    <div className="training-card-admin-actions">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(training.id)}
                                className="training-card-action-btn edit"
                                title="Edit training"
                            >
                                <Edit3 size={18} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="training-card-action-btn delete"
                                title="Delete training"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Card Title */}
            <h3 className="training-card-title">{training.title}</h3>

            {/* Card Description */}
            {training.description && (
                <p className="training-card-description">{training.description}</p>
            )}

            {/* Card Dates */}
            <div className="training-card-dates">
                {training.start_date && (
                    <div className="date-item">
                        <span className="date-label">Start:</span>
                        <span className="date-value">{formatDate(training.start_date)}</span>
                    </div>
                )}
                {training.end_date && (
                    <div className="date-item">
                        <span className="date-label">End:</span>
                        <span className="date-value">{formatDate(training.end_date)}</span>
                    </div>
                )}
            </div>

            {/* Status Badge */}
            <div className="training-card-status-section">
                {getStatusBadge()}
            </div>

            {/* Card Footer with CTAs */}
            <div className="training-card-footer">
                {/* User Actions */}
                {!isAdmin && (
                    <>
                        <button
                            onClick={() => onView?.(training.id)}
                            className="training-card-btn primary"
                            title="View training details"
                        >
                            <Eye size={16} />
                            Open
                        </button>

                        {training.user_status === "NEW" && (
                            <button
                                onClick={() => onMarkInProgress?.(training.id)}
                                className="training-card-btn secondary"
                                title="Start training"
                            >
                                Start
                            </button>
                        )}

                        {training.user_status === "IN_PROGRESS" && (
                            <button
                                onClick={() => onMarkComplete?.(training.id)}
                                className="training-card-btn success"
                                title="Mark as complete"
                            >
                                <CheckCircle size={16} />
                                Complete
                            </button>
                        )}

                        {training.user_status === "COMPLETED" && (
                            <span className="training-card-completed-date">
                                Completed {formatDate(training.user_completed_at)}
                            </span>
                        )}
                    </>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                    <button
                        onClick={() => onView?.(training.id)}
                        className="training-card-btn primary"
                        title="View training details"
                    >
                        <Eye size={16} />
                        View
                    </button>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && onDelete && (
                <div className="training-card-delete-confirm">
                    <div className="delete-confirm-content">
                        <p>Are you sure you want to delete this training?</p>
                        <div className="delete-confirm-actions">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="btn-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onDelete(training.id);
                                    setShowDeleteConfirm(false);
                                }}
                                className="btn-confirm-delete"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
};

export default AssignedTrainingCard;
