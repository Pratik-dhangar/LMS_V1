import React, { useState } from 'react';
import learningContentService from '../../api/services/learningContentService';
import '../../styles/components/common/Modal.css';

/**
 * ViewSessionModal - Display session details in read-only mode
 * Similar to EditSessionModal but without edit options
 */
const ViewSessionModal = ({ session, onClose }) => {
    const [selectedContent, setSelectedContent] = useState(null);

    if (!session) return null;

    // Get actual session status considering expiration based on duration
    const getSessionStatus = (sess) => {
        // First check if already cancelled or ended or active
        if (sess.status === 'cancelled') {
            return 'cancelled';
        }
        if (sess.status === 'active') {
            return 'active';
        }
        if (sess.status === 'ended') {
            return 'ended';
        }

        // Check if session is expired (check scheduled_date + duration)
        if (sess.scheduled_date) {
            try {
                const now = new Date();
                const scheduled = new Date(sess.scheduled_date);

                // Calculate session end time based on duration
                const durationMs = (sess.duration || 0) * 60 * 1000; // Convert minutes to milliseconds
                const sessionEndTime = new Date(scheduled.getTime() + durationMs);

                // If current time is past the session end time (scheduled + duration), it's expired
                if (now >= sessionEndTime) {
                    return 'expired';
                }
            } catch (e) {
                console.warn('Error parsing session date:', e);
            }
        }
        return sess.status || 'scheduled';
    };

    const getContentIcon = (type) => {
        const icons = {
            image: '🖼️',
            pdf: '📄',
            video: '🎥',
            audio: '🎵',
            document: '📝'
        };
        return icons[type] || '📁';
    };

    const renderLearningGoals = () => {
        if (!session.learning_goals || session.learning_goals.length === 0) {
            return <p className="text-gray-500 text-center py-4">No learning goals assigned</p>;
        }

        return (
            <div className="space-y-3">
                {session.learning_goals.map((goal, index) => (
                    <div key={goal.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="font-semibold text-gray-900 mb-1">{goal.goal}</div>
                        {goal.goal_description && (
                            <div className="text-sm text-gray-600 mb-3">{goal.goal_description}</div>
                        )}
                        {(goal.prompt_meter || goal.reinforcement_meter) && (
                            <div className="flex gap-2 flex-wrap">
                                {goal.prompt_meter && (
                                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-300">
                                        Prompt: {goal.prompt_meter}
                                    </span>
                                )}
                                {goal.reinforcement_meter && (
                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full border border-green-300">
                                        Reinforcement: {goal.reinforcement_meter}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderLearningContent = () => {
        if (!session.learning_contents || session.learning_contents.length === 0) {
            return <p className="text-gray-500 text-center py-4">No learning content assigned</p>;
        }

        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {session.learning_contents.map((content, index) => (
                    <div
                        key={content.id || index}
                        onClick={() => setSelectedContent(content)}
                        className="border border-gray-200 rounded-lg overflow-hidden bg-white hover:border-[#DB9D32] hover:shadow-md transition cursor-pointer"
                    >
                        {/* Content Preview */}
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center overflow-hidden relative">
                            {content.content_type === 'image' && content.file_url && (
                                <img
                                    src={learningContentService.getFileUrl(content.file_url)}
                                    alt={content.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = e.target.nextElementSibling;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            )}
                            {content.content_type === 'video' && (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#DB9D32] to-[#9C4D0B]">
                                    <span className="text-3xl">🎥</span>
                                </div>
                            )}
                            {content.content_type === 'audio' && (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#FE971E] to-[#9C4D0B]">
                                    <span className="text-3xl">🎵</span>
                                </div>
                            )}
                            {content.content_type === 'pdf' && (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-400 to-red-600">
                                    <span className="text-3xl">📄</span>
                                </div>
                            )}
                            {content.content_type === 'document' && (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
                                    <span className="text-3xl">📝</span>
                                </div>
                            )}
                            {(!content.file_url || !['image', 'video', 'audio', 'pdf', 'document'].includes(content.content_type)) && (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-600">
                                    <span className="text-2xl">{getContentIcon(content.content_type)}</span>
                                </div>
                            )}
                            {/* Fallback icon if image fails to load */}
                            <div style={{ display: 'none' }} className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-600">
                                <span className="text-2xl">{getContentIcon(content.content_type)}</span>
                            </div>
                        </div>

                        {/* Content Info */}
                        <div className="p-2">
                            <div className="font-semibold text-gray-900 break-words text-sm">{content.title}</div>
                            <div className="text-xs text-gray-500 capitalize">
                                {content.content_type}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Prevent body scroll when modal is open
    React.useEffect(() => {
        document.body.classList.add('modal-open');
        return () => document.body.classList.remove('modal-open');
    }, []);

    return (
        <div className="app-modal-overlay">
            <div className="app-modal-container app-modal-container--lg" style={{ maxHeight: '90vh' }}>
                {/* Modal Header */}
                <div className="app-modal-header app-modal-header--primary">
                    <div className="app-modal-header-content">
                        <h2 className="app-modal-title">View Session Details</h2>
                        <p className="app-modal-subtitle">{session.learner_name} - {session.trainer_name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="app-modal-close"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div className="app-modal-content" style={{ maxWidth: 'none' }}>
                    {/* Session Information */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Session Title</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900 font-medium">{session.title}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                {(() => {
                                    const actualStatus = getSessionStatus(session);
                                    const statusColors = {
                                        scheduled: 'bg-[#fef3e2] text-[#9C4D0B]',
                                        active: 'bg-green-100 text-green-800',
                                        ended: 'bg-gray-100 text-gray-800',
                                        expired: 'bg-gray-100 text-gray-800',
                                        cancelled: 'bg-red-100 text-red-800'
                                    };
                                    return (
                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColors[actualStatus] || 'bg-red-100 text-red-800'}`}>
                                            {actualStatus.charAt(0).toUpperCase() + actualStatus.slice(1)}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {session.description && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-700 whitespace-pre-wrap">{session.description}</p>
                            </div>
                        </div>
                    )}

                    {/* Session Details */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date & Time</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900">
                                    {session.scheduled_date
                                        ? new Date(session.scheduled_date).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                        })
                                        : 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900 font-medium">{session.duration} minutes</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Trainer</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900 font-medium">{session.trainer_name || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Learning Goals */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span>🎯</span> Learning Goals
                        </h3>
                        {renderLearningGoals()}
                    </div>

                    {/* Learning Content */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span>📚</span> Learning Content
                        </h3>
                        {renderLearningContent()}
                    </div>

                    {/* Session Notes */}
                    {session.session_notes && session.session_notes.trim() && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📝</span> Session Notes
                            </h3>
                            <div className="p-4 bg-[#fef3e2] rounded-lg border border-[#DB9D32]">
                                <p className="text-gray-700 whitespace-pre-wrap">{session.session_notes}</p>
                            </div>
                        </div>
                    )}

                    {/* Head Notes (if any) */}
                    {session.head_notes && String(session.head_notes).trim() && (
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>👔</span> Head Notes
                            </h3>
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                <p className="text-gray-700 whitespace-pre-wrap">{session.head_notes}</p>
                            </div>
                        </div>
                    )}

                     {/* Modal Actions */}
                <div className="app-modal-footer">
                    <button
                        onClick={onClose}
                        className="app-modal-btn app-modal-btn--secondary"
                    >
                        Close
                    </button>
                </div>
                </div>

               
            </div>

            {/* Learning Content Popup Modal */}
            {selectedContent && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedContent(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Popup Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-[#DB9D32] to-[#9C4D0B] text-white p-6 flex items-center justify-between rounded-t-lg">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{getContentIcon(selectedContent.content_type)}</span>
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedContent.title}</h2>
                                    <p className="text-white opacity-90 text-sm capitalize mt-1">{selectedContent.content_type}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedContent(null)}
                                className="text-white hover:bg-[#9C4D0B] p-2 rounded-lg transition"
                                title="Close"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Popup Content */}
                        <div className="p-6 space-y-6">
                            {selectedContent.description && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap">{selectedContent.description}</p>
                                </div>
                            )}

                            {(selectedContent.file_url || selectedContent.thumbnail_url) && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Content</h3>
                                    {selectedContent.content_type === 'video' && (
                                        <video
                                            src={learningContentService.getFileUrl(selectedContent.file_url)}
                                            controls
                                            className="w-full rounded-lg border border-gray-300"
                                        />
                                    )}
                                    {selectedContent.content_type === 'audio' && (
                                        <audio
                                            src={learningContentService.getFileUrl(selectedContent.file_url)}
                                            controls
                                            className="w-full rounded-lg border border-gray-300"
                                        />
                                    )}
                                    {selectedContent.content_type === 'image' && (
                                        <img
                                            src={learningContentService.getFileUrl(selectedContent.file_url)}
                                            alt={selectedContent.title}
                                            className="w-full rounded-lg border border-gray-300 object-cover max-h-96"
                                        />
                                    )}
                                    {selectedContent.content_type === 'pdf' && (
                                        <div className="space-y-3">
                                            <p className="text-gray-600">PDF Document</p>
                                            <a
                                                href={learningContentService.getFileUrl(selectedContent.file_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block px-4 py-2 bg-[#DB9D32] text-white rounded-lg hover:bg-[#9C4D0B] transition"
                                            >
                                                📥 Download / View PDF
                                            </a>
                                        </div>
                                    )}
                                    {selectedContent.content_type === 'document' && (
                                        <div className="space-y-3">
                                            <p className="text-gray-600">Document</p>
                                            <a
                                                href={learningContentService.getFileUrl(selectedContent.file_url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block px-4 py-2 bg-[#DB9D32] text-white rounded-lg hover:bg-[#9C4D0B] transition"
                                            >
                                                📥 Open Document
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedContent.metadata && (
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <h4 className="font-semibold text-gray-900 mb-2">Details</h4>
                                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedContent.metadata}</p>
                                </div>
                            )}
                        </div>

                        {/* Popup Footer */}
                        <div className="bg-gray-50 border-t border-gray-200 p-6 flex justify-end rounded-b-lg">
                            <button
                                onClick={() => setSelectedContent(null)}
                                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewSessionModal;
