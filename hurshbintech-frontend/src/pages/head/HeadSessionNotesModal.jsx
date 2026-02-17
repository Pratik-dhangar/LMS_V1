import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import headSessionNotesService from '../../api/services/headSessionNotesService';
import '../../styles/components/common/Modal.css';


/**
 * HeadSessionNotesModal - Modal for adding/editing head notes on completed sessions
 */
const HeadSessionNotesModal = ({ session, onClose, onSuccess }) => {
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingNotes, setFetchingNotes] = useState(true);

    // Fetch existing notes when modal opens
    useEffect(() => {
        const fetchExistingNotes = async () => {
            try {
                setFetchingNotes(true);
                const existingNotes = await headSessionNotesService.getHeadNotes(session.id);
                if (existingNotes && existingNotes.notes) {
                    setNotes(existingNotes.notes);
                }
            } catch (error) {
                // If 404, it means no notes exist yet - that's okay
                if (error.response?.status !== 404) {
                    console.error('Error fetching existing notes:', error);
                }
            } finally {
                setFetchingNotes(false);
            }
        };

        fetchExistingNotes();
    }, [session.id]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            await headSessionNotesService.saveHeadNotes(session.id, notes);
            toast.success('Head notes saved successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving head notes:', error);
            const errorMsg = error.response?.data?.detail || 'Failed to save head notes';
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-modal-overlay">
            <div className="app-modal-container" style={{ maxWidth: '768px' }}>
                {/* Modal Header */}
                <div className="app-modal-header app-modal-header--primary modal-header-gold">
                    <div className="app-modal-header-content">
                        <h2 className="app-modal-title">👔 Head Session Notes</h2>
                        <p className="app-modal-subtitle">{session.learner_name} - {session.trainer_name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="app-modal-close"
                        title="Close"
                        disabled={loading}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div className="app-modal-content">
                    {/* Session Info */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Session Title</label>
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-gray-900 font-medium">{session.title}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Completed Date</label>
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
                    </div>

                    {/* Notes Editor */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📝 Head Notes {fetchingNotes && <span className="text-sm text-gray-500">(Loading...)</span>}
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Write your observations, feedback, or recommendations about this session..."
                            className="app-modal-form-textarea"
                            rows="8"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid #d1d5db',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                minHeight: '200px'
                            }}
                            disabled={loading || fetchingNotes}
                        />
                        <p className="text-xs text-gray-500 mt-2">Character count: {notes.length}</p>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="app-modal-footer">
                    <button
                        onClick={onClose}
                        className="app-modal-btn app-modal-btn--secondary"
                        disabled={loading || fetchingNotes}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="app-modal-btn app-modal-btn--primary"
                        disabled={loading || fetchingNotes}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {loading && <div className="loading-spinner-small"></div>}
                        💾 Save Notes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeadSessionNotesModal;
