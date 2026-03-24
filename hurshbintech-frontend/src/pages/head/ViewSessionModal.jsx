import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2 } from 'lucide-react';
import '../../styles/components/common/Modal.css';

/**
 * ViewSessionModal - Display session details in read-only mode
 * Similar to EditSessionModal but without edit options
 */
const ViewSessionModal = ({ session, onClose }) => {
    const navigate = useNavigate();

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

    const program = session.program || {};
    const learningContents = session.learning_contents || [];
    const selectedProgramGoalIds = (program.goal_ids || []).map((id) => Number(id));

    // Selected programs from "Select Programs" are represented by learning goals.
    const selectedProgramItems = selectedProgramGoalIds.length > 0
        ? (session.learning_goals || []).filter((goal) => selectedProgramGoalIds.includes(Number(goal.id)))
        : (session.learning_goals || []);

    // Skills: use the previous sidebar-style resolver logic.
    const resolvedSkillNames = (() => {
        const fromProgramDescription = (program.skill || program.description || program.descrption || '').trim();
        if (fromProgramDescription) return fromProgramDescription;

        const candidateList =
            program.skill_names ||
            program.skills ||
            program.goal_names ||
            program.learning_goal_names ||
            [];

        if (Array.isArray(candidateList) && candidateList.length > 0) {
            const names = candidateList
                .map((item) => {
                    if (typeof item === 'string') return item.trim();
                    return (item?.goal || item?.name || item?.title || '').trim();
                })
                .filter(Boolean);
            if (names.length > 0) return names.join(', ');
        }

        const descriptionsFromGoals = (session.learning_goals || [])
            .map((goal) => (goal?.goal_description || '').trim())
            .filter(Boolean);
        if (descriptionsFromGoals.length > 0) return descriptionsFromGoals.join(', ');

        return '';
    })();

    const selectedSkills = resolvedSkillNames ? [resolvedSkillNames] : [];

    // Learning Goals should display selected program names (goal names).
    const subPrograms = selectedProgramItems
        .map((goal) => ({
            id: goal?.id,
            title: (goal?.goal || '').trim(),
        }))
        .filter((item) => item.title);

    // Learning Content is all session-selected learning content.
    const selectedLearningContents = learningContents;

    const renderSkills = () => {
        if (selectedSkills.length === 0) {
            return <p className="text-gray-500 text-center py-4">No skills assigned</p>;
        }

        return (
            <div className="space-y-3">
                {selectedSkills.map((description, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="font-semibold text-gray-900">{description || 'No description available'}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderSubPrograms = () => {
        if (subPrograms.length === 0) {
            return <p className="text-gray-500 text-center py-4">No sub-programs assigned</p>;
        }

        return (
            <div className="space-y-3">
                {subPrograms.map((subProgram, index) => (
                    <div key={subProgram.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="font-semibold text-gray-900">{subProgram.title || 'Unnamed Learning Goals'}</div>
                    </div>
                ))}
            </div>
        );
    };

    const renderLearningContents = () => {
        if (selectedLearningContents.length === 0) {
            return <p className="text-gray-500 text-center py-4">No learning content assigned</p>;
        }

        return (
            <div className="space-y-3">
                {selectedLearningContents.map((content, index) => (
                    <div key={content.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="font-semibold text-gray-900">{content.title || 'Unnamed Learning Content'}</div>
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
        <>
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

                        {/* Program (if linked) */}
                        {session.program && (
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2 justify-between">
                                    <span>📋 Program Mapping</span>
                                    <button
                                        onClick={() => navigate(`/head/edit-program/${session.program.id}`)}
                                        className="p-2 hover:bg-gray-200 rounded transition-colors"
                                        title="Edit this program"
                                        style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                                    >
                                        <Edit2 size={16} style={{ color: '#9C4D0B' }} />
                                    </button>
                                </h3>
                                <div className="p-3 bg-[#fef3e2] rounded-lg border border-[#DB9D32] inline-flex items-center gap-2">
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#9C4D0B' }}>
                                        Program: {session.program.name}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: '#b07320' }}>
                                        — Skills: {(session.program.goal_ids || []).length}, Learning Goals: {(session.program.content_ids || []).length}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Learning Goals */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>🎯</span> Learning Skills
                            </h3>
                            {renderSkills()}
                        </div>

                        {/* Learning Content */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📚</span> Learning Goals
                            </h3>
                            {renderSubPrograms()}
                        </div>

                        {/* Learning Content */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span>📘</span> Learning Content
                            </h3>
                            {renderLearningContents()}
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
                    </div>

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

        </>
    );
};

export default ViewSessionModal;