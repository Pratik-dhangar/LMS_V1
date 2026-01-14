import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Trash2, Edit3 } from "lucide-react";
import "../styles/admin/AssignedTrainingCard.css";

/**
 * AssignedTrainingCard - Reusable card component for displaying assigned trainings
 * Similar to blog cards, shows training title, description, dates, and CTAs
 * 
 * @param {Object} training - Training object
 * @param {number} training.id - Training ID
 * @param {string} training.title - Training title
 * @param {string} training.description - Short description
 * @param {string} training.training_type - Type: 'custom', 'program', 'content', 'vlog'
 * @param {string} training.custom_content - Full HTML content (optional)
 * @param {Date} training.start_date - Start date
 * @param {Date} training.end_date - End date
 * @param {boolean} training.active - Is active
 * @param {Object} props
 * @param {boolean} props.isAdmin - Show admin actions (edit, delete)
 * @param {function} props.onView - Callback when View/Open clicked (optional, used by AssignedTrainingsList for modal)
 * @param {function} props.onEdit - Callback when Edit clicked (admin only)
 * @param {function} props.onDelete - Callback when Delete clicked (admin only)
 */
const AssignedTrainingCard = ({
    training,
    isAdmin = false,
    onView,
    onEdit,
    onDelete,
}) => {
    const navigate = useNavigate();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Navigate to detail page for non-admin users
    const handleViewTraining = () => {
        if (isAdmin) {
            // Admin: Use provided callback or navigate to admin detail page
            if (onView) {
                onView(training.id);
            } else {
                navigate(`/admin/assigned-trainings/${training.id}`);
            }
        } else {
            // Non-admin users: Navigate to dedicated detail page
            navigate(`/assigned-trainings/${training.id}`);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
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

            {/* Card Footer with CTAs */}
            <div className="training-card-footer">
                {/* User Actions */}
                {!isAdmin && (
                    <button
                        onClick={handleViewTraining}
                        className="training-card-btn primary"
                        title="View training details"
                    >
                        <Eye size={16} />
                        Open
                    </button>
                )}

                {/* Admin Actions */}
                {isAdmin && (
                    <button
                        onClick={handleViewTraining}
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
