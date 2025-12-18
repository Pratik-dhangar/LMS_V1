import React from 'react';
import '../../styles/Pages.css';

/**
 * ViewSessionModal - Display session details in read-only mode
 * Similar to EditSessionModal but without edit options
 */
const ViewSessionModal = ({ session, onClose }) => {
    if (!session) return null;

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

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {session.learning_contents.map((content, index) => (
                    <div key={content.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">{getContentIcon(content.content_type)}</span>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 break-words">{content.title}</div>
                                <div className="text-xs text-gray-500 mt-1 capitalize">
                                    {content.content_type}
                                </div>
                                {content.description && (
                                    <div className="text-sm text-gray-600 mt-2 line-clamp-2">{content.description}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '1024px', maxHeight: '90vh', overflowY: 'auto' }}>
                {/* Modal Header */}
                <div className="modal-header modal-header-blue">
                    <div className="modal-header-content">
                        <h2 className="modal-title">👁️ View Session Details</h2>
                        <p className="modal-subtitle">{session.learner_name} - {session.trainer_name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="modal-close-button"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content">
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
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${session.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                    session.status === 'active' ? 'bg-green-100 text-green-800' :
                                        session.status === 'ended' ? 'bg-gray-100 text-gray-800' :
                                            'bg-red-100 text-red-800'
                                    }`}>
                                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                                </span>
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
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
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
                </div>

                {/* Modal Actions */}
                <div className="modal-actions">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ViewSessionModal;
