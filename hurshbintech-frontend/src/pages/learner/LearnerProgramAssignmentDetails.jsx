import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import programAssignmentService from '../../api/services/programAssignmentService';
import '../../styles/Pages.css';
import '../../styles/LearnerProgramAssignmentDetails.css';
import { toast } from 'react-toastify';

const LearnerProgramAssignmentDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [assignment, setAssignment] = useState(null);
    const [assignedContents, setAssignedContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showContentModal, setShowContentModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [selectedContent, setSelectedContent] = useState(null);
    const [learnerNotes, setLearnerNotes] = useState('');
    const [proofOfWork, setProofOfWork] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAssignment();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // ============ FETCH ASSIGNMENT ============
    const fetchAssignment = async () => {
        try {
            setLoading(true);
            console.log(`\n📖 FETCHING LEARNING CONTENTS FOR PROGRAM ${id}`);

            // Only fetch learning contents - don't try to get assignment by ID (causes 404)
            const allContents = await programAssignmentService.getMyLearningContents();
            console.log(`✅ API returned ${allContents ? allContents.length : 0} total contents`);

            // Filter contents for this specific program assignment
            const programContents = allContents.filter(c =>
                c.program_assignment_id === parseInt(id)
            );
            console.log(`✅ Filtered to ${programContents.length} contents for program ${id}`);

            if (programContents && programContents.length > 0) {
                programContents.forEach((c, idx) => {
                    console.log(`  [${idx + 1}] ${c.title} - Status: ${c.completion_status}, Type: ${c.content_type}`);
                });

                // Get program title from first content if available
                if (programContents[0]?.program_title) {
                    setAssignment({
                        id: parseInt(id),
                        program_title: programContents[0].program_title
                    });
                }
            }

            setAssignedContents(programContents);
            console.log(`✅ Component state updated\n`);
        } catch (e) {
            console.error('❌ Failed to load contents:', e);
            toast.error('Failed to load assignment details');
        } finally {
            setLoading(false);
        }
    };

    // ============ OPEN/CLOSE MODALS ============
    const openSubmit = () => setShowSubmitModal(true);
    const closeSubmit = () => {
        setShowSubmitModal(false);
        setFile(null);
    };

    const handleViewContent = (content) => {
        setSelectedContent(content);
        setShowContentModal(true);
    };

    const closeContentModal = () => {
        setShowContentModal(false);
        setSelectedContent(null);
    };

    // ============ CONTENT ACTIONS ============
    const handleStartContent = async (content) => {
        if (!content.content_assignment_id) {
            toast.error('Unable to start content - missing assignment ID');
            return;
        }

        try {
            console.log(`🔄 Starting content ${content.content_assignment_id}: ${content.title}`);
            await programAssignmentService.startContent(content.content_assignment_id);
            toast.success(`Started: ${content.title}`);
            await fetchAssignment(); // Refresh to get updated status
        } catch (error) {
            console.error('Failed to start content:', error);
            toast.error('Failed to start content');
        }
    };

    const handleSubmitContent = async (content) => {
        if (!content.content_assignment_id) {
            toast.error('Unable to submit content - missing assignment ID');
            return;
        }

        try {
            console.log(`🔄 SUBMITTING: ${content.title} (ID: ${content.content_assignment_id})`);
            const response = await programAssignmentService.submitContent(content.content_assignment_id);
            console.log(`✅ Backend response:`, response);

            if (response.is_late) {
                toast.warning(`Content submitted (Late): ${content.title}`);
            } else {
                toast.success(`Content submitted: ${content.title}`);
            }

            // Give backend a moment to commit
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch fresh learning contents
            console.log(`🔄 Fetching fresh data from API...`);
            const allContents = await programAssignmentService.getMyLearningContents();
            console.log(`📦 Raw API response:`, allContents);

            const programContents = allContents.filter(c => {
                const matches = c.program_assignment_id === parseInt(id);
                return matches;
            });

            console.log(`✅ Filtered contents (${programContents.length} items):`);
            programContents.forEach(c => {
                console.log(`   - ${c.title}: ${c.completion_status}`);
            });

            // Force React to see this as a new array
            const newContents = [...programContents];

            console.log(`📊 Setting state with new array...`);
            setAssignedContents(newContents);

            // Calculate submitted count
            const submitted = newContents.filter(c =>
                c.completion_status === 'SUBMITTED' ||
                c.completion_status === 'LATE_SUBMITTED' ||
                c.completion_status === 'REVIEWED'
            ).length;

            console.log(`🎯 Updated progress: ${submitted} / ${newContents.length}`);
        } catch (error) {
            console.error('❌ Submit error:', error);
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                config: error.config
            });

            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.message ||
                error.message ||
                'Failed to submit content';
            toast.error(errorMessage);
        }
    };

    const handleCompleteAssignment = () => {
        setShowCompleteModal(true);
    };

    const closeCompleteModal = () => {
        setShowCompleteModal(false);
        setLearnerNotes('');
        setProofOfWork(null);
    };

    const handleProofFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (selectedFile.size > maxSize) {
                toast.error('File size must be less than 50MB');
                return;
            }
            setProofOfWork(selectedFile);
        }
    };

    const handleFinalSubmit = async () => {
        if (!learnerNotes.trim() && !proofOfWork) {
            toast.error('Please add notes or upload proof of work');
            return;
        }

        try {
            setSubmitting(true);
            console.log(`🎯 Completing assignment ${id}...`);

            // Upload proof of work if provided
            if (proofOfWork) {
                console.log('📤 Uploading proof of work...');
                await programAssignmentService.uploadMyAttachment(
                    parseInt(id),
                    proofOfWork,
                    'Proof of Work'
                );
            }

            // Update assignment with notes and mark as complete
            const updateData = {
                completion_status: 'COMPLETED'
            };

            if (learnerNotes.trim()) {
                updateData.learner_notes = learnerNotes;
            }

            await programAssignmentService.updateMyAssignment(parseInt(id), updateData);

            toast.success('Assignment completed successfully!');
            closeCompleteModal();

            setTimeout(() => {
                navigate('/learner/dashboard');
            }, 1500);
        } catch (error) {
            console.error('Failed to complete assignment:', error);
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.message ||
                'Failed to complete assignment';
            toast.error(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    // ============ HELPER FUNCTIONS ============
    const getStatusBadge = (status) => {
        const statusColors = {
            'NOT_STARTED': 'gray',
            'IN_PROGRESS': 'blue',
            'SUBMITTED': 'green',
            'LATE_SUBMITTED': 'orange',
            'REVIEWED': 'purple',
            'RESUBMISSION_REQUIRED': 'red'
        };
        const color = statusColors[status] || 'gray';
        return (
            <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: `var(--${color}-100, #e5e7eb)`,
                color: `var(--${color}-700, #374151)`
            }}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    const getFileUrl = (fileUrl) => {
        if (!fileUrl) return '';
        if (fileUrl.startsWith('http')) return fileUrl;
        if (fileUrl.startsWith('s3://')) {
            const key = fileUrl.replace('s3://', '').split('/').slice(1).join('/');
            return `/s3/${key}`;
        }
        if (fileUrl.startsWith('/')) return fileUrl;
        return `/${fileUrl}`;
    };

    const renderContentViewer = () => {
        if (!selectedContent) return null;

        const fileUrl = getFileUrl(selectedContent.file_url);
        const contentType = selectedContent.content_type?.toLowerCase() || '';

        if (contentType === 'image') {
            return (
                <div className="content-viewer-image">
                    <img src={fileUrl} alt={selectedContent.title} onError={(e) => e.target.src = ''} />
                </div>
            );
        } else if (contentType === 'video') {
            return (
                <div className="content-viewer-video">
                    <video width="100%" height="auto" controls>
                        <source src={fileUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        } else if (contentType === 'pdf') {
            return (
                <div className="content-viewer-pdf">
                    <iframe src={fileUrl} width="100%" height="500px" title={selectedContent.title} />
                </div>
            );
        } else if (contentType === 'document') {
            return (
                <div className="content-viewer-document">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                        Download Document: {selectedContent.title}
                    </a>
                </div>
            );
        }

        return <p>Content type not supported for preview</p>;
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (selectedFile.size > maxSize) {
                toast.error('File size must be less than 50MB');
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleSubmit = async () => {
        if (!learnerNotes.trim() && !file) {
            toast.error('Please add notes or upload a file');
            return;
        }

        try {
            setUploading(true);
            console.log('📤 Submitting assignment submission...');
            // TODO: Implement submission logic here
            toast.success('Assignment submitted successfully');
            closeSubmit();
        } catch (error) {
            console.error('Failed to submit:', error);
            toast.error('Failed to submit assignment');
        } finally {
            setUploading(false);
        }
    };

    const calculateDaysLeft = (dueDate) => {
        if (!dueDate) return null;
        const due = new Date(dueDate);
        const now = new Date();
        const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        return daysLeft > 0 ? daysLeft : 0;
    };

    // ============ RENDER ============
    if (loading) {
        return (
            <div className="page-container">
                <Navbar />
                <div className="page-content">
                    <div className="loading">Loading assignment...</div>
                </div>
                <Footer />
            </div>
        );
    }

    if (!assignedContents || assignedContents.length === 0) {
        return (
            <div className="page-container">
                <Navbar />
                <div className="page-content">
                    <div className="error-state">
                        <h2>No Contents Found</h2>
                        <p>This program assignment has no contents assigned yet.</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    // Count submitted items
    const submittedCount = assignedContents.filter(c =>
        c.completion_status === 'SUBMITTED' ||
        c.completion_status === 'LATE_SUBMITTED' ||
        c.completion_status === 'REVIEWED'
    ).length;

    return (
        <div className="page-container">
            <Navbar />
            <div className="assignment-details">
                <div className="assignment-header">
                    <h1>{assignment?.program_title || 'Program Assignment'}</h1>
                    <div className="progress-summary">
                        <p>Progress: <strong>{submittedCount} of {assignedContents.length}</strong> submitted</p>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(submittedCount / assignedContents.length) * 100}%` }} />
                        </div>
                    </div>
                </div>

                <div className="contents-grid">
                    {assignedContents.map((content) => (
                        <div key={content.id} className="content-card">
                            <div className="content-header">
                                <h3>{content.title}</h3>
                                <div className="status-badge">
                                    {getStatusBadge(content.completion_status)}
                                </div>
                            </div>

                            <p className="content-type">{content.content_type || 'Unknown'}</p>

                            {content.description && (
                                <p className="content-description">{content.description}</p>
                            )}

                            <div className="content-actions">
                                {content.completion_status === 'NOT_STARTED' && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleStartContent(content)}
                                    >
                                        Start
                                    </button>
                                )}

                                {(content.completion_status === 'IN_PROGRESS' ||
                                    content.completion_status === 'RESUBMISSION_REQUIRED') && (
                                        <button
                                            className="btn btn-success"
                                            onClick={() => handleSubmitContent(content)}
                                        >
                                            Done
                                        </button>
                                    )}

                                {(content.completion_status === 'SUBMITTED' ||
                                    content.completion_status === 'LATE_SUBMITTED' ||
                                    content.completion_status === 'REVIEWED') && (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleViewContent(content)}
                                        >
                                            View
                                        </button>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Final Submit Button */}
                {submittedCount === assignedContents.length && assignedContents.length > 0 && (
                    <div className="final-submit-section">
                        <h2>🎉 All Tasks Completed!</h2>
                        <p>You have successfully submitted all tasks. Click below to complete the assignment.</p>
                        <button
                            className="btn btn-complete"
                            onClick={handleCompleteAssignment}
                        >
                            Complete Assignment
                        </button>
                    </div>
                )}
            </div>


            {/* Content Modal */}
            {showContentModal && selectedContent && (
                <div className="modal-overlay" onClick={closeContentModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedContent.title}</h2>
                            <button className="close-btn" onClick={closeContentModal}>×</button>
                        </div>
                        <div className="modal-body">
                            {renderContentViewer()}
                        </div>
                    </div>
                </div>
            )}

            {/* Complete Assignment Modal */}
            {showCompleteModal && (
                <div className="modal-overlay" onClick={closeCompleteModal}>
                    <div className="modal-content complete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🎉 Complete Assignment</h2>
                            <button className="close-btn" onClick={closeCompleteModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-description">
                                Submit your final notes and upload proof of your completed work.
                            </p>

                            <div className="form-group">
                                <label htmlFor="learner-notes">Learner Notes *</label>
                                <textarea
                                    id="learner-notes"
                                    className="form-control"
                                    rows="4"
                                    placeholder="Add your notes about the assignment..."
                                    value={learnerNotes}
                                    onChange={(e) => setLearnerNotes(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="proof-of-work">Proof of Work (Optional)</label>
                                <input
                                    type="file"
                                    id="proof-of-work"
                                    className="form-control"
                                    onChange={handleProofFileChange}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                                />
                                {proofOfWork && (
                                    <p className="file-selected">
                                        Selected: {proofOfWork.name} ({(proofOfWork.size / 1024 / 1024).toFixed(2)} MB)
                                    </p>
                                )}
                                <p className="form-hint">Max file size: 50MB</p>
                            </div>

                            <div className="modal-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={closeCompleteModal}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-complete"
                                    onClick={handleFinalSubmit}
                                    disabled={submitting || (!learnerNotes.trim() && !proofOfWork)}
                                >
                                    {submitting ? 'Submitting...' : 'Submit & Complete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default LearnerProgramAssignmentDetails;
