import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import programAssignmentService from '../../api/services/programAssignmentService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/FeedbackPage.css';

const FeedbackPage = () => {
    const { contentAssignmentId } = useParams();
    const navigate = useNavigate();
    const [contentAssignment, setContentAssignment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resubmitting, setResubmitting] = useState(false);
    const [showResubmitConfirm, setShowResubmitConfirm] = useState(false);

    useEffect(() => {
        fetchFeedback();
    }, [contentAssignmentId]);

    const fetchFeedback = async () => {
        try {
            setLoading(true);
            const data = await programAssignmentService.getContentAssignmentFeedback(contentAssignmentId);
            setContentAssignment(data);
        } catch (error) {
            console.error('Error loading feedback:', error);
            toast.error('Failed to load feedback');
            navigate('/learner/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleResubmit = async () => {
        try {
            setResubmitting(true);
            await programAssignmentService.resubmitContent(contentAssignmentId);
            toast.success('Content resubmitted successfully');

            // Refresh the page
            await fetchFeedback();
            setShowResubmitConfirm(false);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to resubmit content');
        } finally {
            setResubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <Navbar />
                <div className="page-main">
                    <div className="page-content">
                        <div className="feedback-loading">Loading feedback...</div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (!contentAssignment) {
        return (
            <div className="page-container">
                <Navbar />
                <div className="page-main">
                    <div className="page-content">
                        <div className="feedback-error">Feedback not found</div>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const renderStars = (rating) => {
        if (!rating) return null;
        return (
            <div className="feedback-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} className={star <= rating ? 'feedback-star active' : 'feedback-star'}>
                        ⭐
                    </span>
                ))}
            </div>
        );
    };

    const statusColor = {
        'SUBMITTED': '#3b82f6',
        'LATE_SUBMITTED': '#f59e0b',
        'REVIEWED': '#10b981',
        'RESUBMISSION_REQUIRED': '#ef4444'
    };

    return (
        <div className="page-container">
            <Navbar />
            <div className="page-main">
                <div className="page-content">
                    <div className="feedback-page">
                        {/* Header */}
                        <div className="feedback-header">
                            <div>
                                <h1 className="feedback-title">Assignment Feedback</h1>
                                <p className="feedback-subtitle">{contentAssignment.learning_content?.title}</p>
                            </div>
                            <button
                                onClick={() => navigate(-1)}
                                className="feedback-btn-back"
                            >
                                ← Back
                            </button>
                        </div>

                        {/* Status Section */}
                        <div className="feedback-status-section">
                            <div className="feedback-status-item">
                                <span className="feedback-label">Current Status:</span>
                                <span
                                    className="feedback-status-badge"
                                    style={{ background: statusColor[contentAssignment.completion_status] }}
                                >
                                    {contentAssignment.completion_status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="feedback-status-item">
                                <span className="feedback-label">Submitted on:</span>
                                <span className="feedback-value">
                                    {contentAssignment.submitted_at
                                        ? new Date(contentAssignment.submitted_at).toLocaleString()
                                        : 'Not submitted'}
                                </span>
                            </div>
                        </div>

                        {/* Head Feedback Section (only if reviewed) */}
                        {contentAssignment.completion_status === 'REVIEWED' && (
                            <div className="feedback-container">
                                <div className="feedback-card">
                                    <h2 className="feedback-card-title">📝 Head Feedback & Rating</h2>

                                    {/* Star Rating */}
                                    <div className="feedback-rating-section">
                                        <h3 className="feedback-subsection-title">Rating</h3>
                                        {renderStars(contentAssignment.head_rating)}
                                        <p className="feedback-rating-text">
                                            {contentAssignment.head_rating} out of 5 stars
                                        </p>
                                    </div>

                                    {/* Remarks */}
                                    {contentAssignment.head_feedback_text && (
                                        <div className="feedback-remarks-section">
                                            <h3 className="feedback-subsection-title">Remarks</h3>
                                            <div className="feedback-remarks-content">
                                                {contentAssignment.head_feedback_text}
                                            </div>
                                        </div>
                                    )}

                                    {/* Feedback Given Date */}
                                    <div className="feedback-meta">
                                        <p className="feedback-text-muted">
                                            Feedback given on: {new Date(contentAssignment.feedback_given_at).toLocaleString()}
                                        </p>
                                    </div>

                                    {/* Resubmission Option */}
                                    {contentAssignment.completion_status === 'RESUBMISSION_REQUIRED' && contentAssignment.resubmit_allowed && (
                                        <div className="feedback-resubmit-section">
                                            <p className="feedback-info-text">
                                                ⚠️ Head has requested you to resubmit this assignment. You can resubmit your work now.
                                            </p>
                                            {!showResubmitConfirm ? (
                                                <button
                                                    onClick={() => setShowResubmitConfirm(true)}
                                                    className="feedback-btn-resubmit"
                                                >
                                                    Resubmit Assignment
                                                </button>
                                            ) : (
                                                <div className="feedback-confirm-section">
                                                    <p className="feedback-confirm-text">
                                                        Are you sure you want to resubmit? Your previous feedback will be cleared.
                                                    </p>
                                                    <div className="feedback-confirm-actions">
                                                        <button
                                                            onClick={() => setShowResubmitConfirm(false)}
                                                            className="feedback-btn-cancel"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleResubmit}
                                                            className="feedback-btn-confirm"
                                                            disabled={resubmitting}
                                                        >
                                                            {resubmitting ? 'Resubmitting...' : 'Yes, Resubmit'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Feedback History */}
                                {contentAssignment.feedback_history && contentAssignment.feedback_history.length > 0 && (
                                    <div className="feedback-card">
                                        <h2 className="feedback-card-title">📋 Feedback History</h2>
                                        <div className="feedback-history-list">
                                            {contentAssignment.feedback_history.map((item, index) => (
                                                <div key={index} className="feedback-history-item">
                                                    <div className="feedback-history-header">
                                                        <div className="feedback-history-rating">
                                                            {renderStars(item.rating)}
                                                            <span className="feedback-history-rating-text">{item.rating}/5</span>
                                                        </div>
                                                        <span className="feedback-history-date">
                                                            {new Date(item.feedback_given_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {item.feedback_text && (
                                                        <div className="feedback-history-text">
                                                            {item.feedback_text}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Waiting for Feedback Section */}
                        {contentAssignment.completion_status !== 'REVIEWED' && contentAssignment.completion_status !== 'RESUBMISSION_REQUIRED' && (
                            <div className="feedback-card feedback-card-waiting">
                                <h2 className="feedback-card-title">⏳ Awaiting Feedback</h2>
                                <p className="feedback-waiting-text">
                                    Your assignment has been submitted. The head will review it and provide feedback soon.
                                </p>
                                <div className="feedback-progress-steps">
                                    <div className={`feedback-step ${['SUBMITTED', 'LATE_SUBMITTED', 'REVIEWED', 'RESUBMISSION_REQUIRED'].includes(contentAssignment.completion_status) ? 'active' : ''}`}>
                                        <div className="feedback-step-number">1</div>
                                        <div className="feedback-step-label">Submitted</div>
                                    </div>
                                    <div className="feedback-step-connector"></div>
                                    <div className={`feedback-step ${contentAssignment.completion_status === 'REVIEWED' || contentAssignment.completion_status === 'RESUBMISSION_REQUIRED' ? 'active' : ''}`}>
                                        <div className="feedback-step-number">2</div>
                                        <div className="feedback-step-label">Under Review</div>
                                    </div>
                                    <div className="feedback-step-connector"></div>
                                    <div className={`feedback-step ${contentAssignment.completion_status === 'REVIEWED' ? 'active' : ''}`}>
                                        <div className="feedback-step-number">3</div>
                                        <div className="feedback-step-label">Feedback Received</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content Details Section */}
                        {contentAssignment.learning_content && (
                            <div className="feedback-card">
                                <h2 className="feedback-card-title">📚 Content Details</h2>
                                <div className="feedback-content-details">
                                    <div className="feedback-detail-item">
                                        <span className="feedback-detail-label">Title:</span>
                                        <span className="feedback-detail-value">{contentAssignment.learning_content.title}</span>
                                    </div>
                                    {contentAssignment.learning_content.description && (
                                        <div className="feedback-detail-item">
                                            <span className="feedback-detail-label">Description:</span>
                                            <span className="feedback-detail-value">{contentAssignment.learning_content.description}</span>
                                        </div>
                                    )}
                                    <div className="feedback-detail-item">
                                        <span className="feedback-detail-label">Type:</span>
                                        <span className="feedback-detail-value">{contentAssignment.learning_content.content_type}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Timeline Section */}
                        <div className="feedback-card">
                            <h2 className="feedback-card-title">⏱️ Timeline</h2>
                            <div className="feedback-timeline">
                                <div className="feedback-timeline-item">
                                    <div className="feedback-timeline-marker">→</div>
                                    <div className="feedback-timeline-content">
                                        <span className="feedback-timeline-label">Assigned:</span>
                                        <span className="feedback-timeline-value">
                                            {new Date(contentAssignment.assigned_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                {contentAssignment.started_at && (
                                    <div className="feedback-timeline-item">
                                        <div className="feedback-timeline-marker">→</div>
                                        <div className="feedback-timeline-content">
                                            <span className="feedback-timeline-label">Started:</span>
                                            <span className="feedback-timeline-value">
                                                {new Date(contentAssignment.started_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {contentAssignment.submitted_at && (
                                    <div className="feedback-timeline-item">
                                        <div className="feedback-timeline-marker">→</div>
                                        <div className="feedback-timeline-content">
                                            <span className="feedback-timeline-label">Submitted:</span>
                                            <span className="feedback-timeline-value">
                                                {new Date(contentAssignment.submitted_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {contentAssignment.reviewed_at && (
                                    <div className="feedback-timeline-item feedback-timeline-item-last">
                                        <div className="feedback-timeline-marker">✓</div>
                                        <div className="feedback-timeline-content">
                                            <span className="feedback-timeline-label">Feedback Received:</span>
                                            <span className="feedback-timeline-value">
                                                {new Date(contentAssignment.reviewed_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default FeedbackPage;
