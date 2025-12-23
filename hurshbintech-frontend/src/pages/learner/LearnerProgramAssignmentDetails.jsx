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
    const [selectedContent, setSelectedContent] = useState(null);
    const [learnerNotes, setLearnerNotes] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchAssignment();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchAssignment = async () => {
        try {
            setLoading(true);
            console.log(`\n📖 FETCHING ASSIGNMENT ${id} DETAILS`);

            const data = await programAssignmentService.getMyAssignmentById(id);
            console.log(`✅ Got assignment details:`, data);
            setAssignment(data);
            setLearnerNotes(data.learner_notes || '');

            // Fetch all assigned learning contents
            console.log(`🔄 Fetching all assigned learning contents...`);
            const allContents = await programAssignmentService.getMyLearningContents();
            console.log(`✅ API returned ${allContents ? allContents.length : 0} contents`);
            console.log(`📚 Content details:`, allContents);

            if (allContents && allContents.length > 0) {
                allContents.forEach((c, idx) => {
                    console.log(`  [${idx + 1}] ${c.title} - Type: ${c.content_type}, From Program: ${c.from_program}`);
                });
            }

            setAssignedContents(allContents);
            console.log(`✅ Set state with ${(allContents || []).length} contents\n`);
        } catch (e) {
            console.error('❌ Failed to load assignment:', e);
            console.error('Stack:', e.stack);
            toast.error('Failed to load assignment details');
        } finally {
            setLoading(false);
        }
    };

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

    const getFileUrl = (fileUrl) => {
        if (!fileUrl) return '';
        // If it's already a full URL (S3 or production), return as is
        if (fileUrl.startsWith('http')) return fileUrl;
        // If it's an S3 key (s3://bucket/path), convert to public URL
        if (fileUrl.startsWith('s3://')) {
            // In production, this would be handled by the Nginx proxy
            // Format: /s3/uploads/learning-content/filename
            const key = fileUrl.replace('s3://', '').split('/').slice(1).join('/');
            return `/s3/${key}`;
        }
        // Local files - prepend API base URL if needed
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
                    <video controls controlsList="nodownload" style={{ width: '100%', height: 'auto', maxHeight: '60vh', outline: 'none', backgroundColor: '#000' }}>
                        <source src={fileUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        } else if (contentType === 'audio') {
            return (
                <div className="content-viewer-audio">
                    <audio controls style={{ width: '100%' }}>
                        <source src={fileUrl} type="audio/mpeg" />
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            );
        } else if (contentType === 'pdf' || contentType === 'document') {
            return (
                <div className="content-viewer-pdf">
                    <iframe src={fileUrl} style={{ width: '100%', height: '60vh', border: 'none' }} title={selectedContent.title} />
                </div>
            );
        } else {
            return (
                <div className="content-viewer-unsupported">
                    <p>This content type cannot be viewed inline.</p>
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">Download File</a>
                </div>
            );
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi', 'video/mov', 'application/pdf'];
        if (!allowed.includes(f.type)) return toast.error('Only images, videos and PDFs allowed');
        const maxSize = f.type.startsWith('video/') ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
        if (f.size > maxSize) return toast.error(`File exceeds ${maxSize / (1024 * 1024)}MB`);
        setFile(f);
    };

    const handleSubmit = async () => {
        if (!assignment) return;
        try {
            setUploading(true);

            // Update notes if changed
            if (learnerNotes !== (assignment.learner_notes || '')) {
                await programAssignmentService.updateMyAssignment(assignment.id, { learner_notes: learnerNotes });
            }

            // Upload file if present
            if (file) {
                await programAssignmentService.uploadMyAttachment(assignment.id, file);
                toast.success('File uploaded');
            }

            toast.success('Submission saved');
            await fetchAssignment();
            closeSubmit();
        } catch (e) {
            console.error('Submit failed', e);
            console.error('Error response:', e.response?.data || e.message);
            toast.error(e.response?.data?.detail || 'Failed to submit');
        } finally {
            setUploading(false);
        }
    };

    const calculateDaysLeft = () => {
        if (!assignment || !assignment.end_date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(assignment.end_date);
        endDate.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        return daysLeft;
    };

    if (loading) return (
        <div className="page-container">
            <div className="loading-container">Loading...</div>
        </div>
    );

    if (!assignment) return (
        <div className="page-container">
            <Navbar />
            <main className="page-main"><div className="page-content">Assignment not found</div></main>
            <Footer />
        </div>
    );

    return (
        <div className="page-container">
            <Navbar />

            <main className="page-main">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', paddingRight: '1rem' }}>
                    <button onClick={() => navigate(-1)} className="back-button">Back ⬅</button>
                </div>

                <div className="detail-card">
                    <h1 className="detail-title">{assignment.program.goal}</h1>

                    <div className="detail-grid">
                        <div>
                            <strong>Start Date:</strong>
                            <div>{assignment.start_date ? new Date(assignment.start_date).toLocaleDateString() : 'TBD'}</div>
                        </div>
                        <div>
                            <strong>End Date:</strong>
                            <div>{assignment.end_date ? new Date(assignment.end_date).toLocaleDateString() : 'TBD'}</div>
                        </div>
                        <div>
                            <strong>Duration:</strong>
                            <div>{assignment.duration_days} days</div>
                        </div>
                        <div>
                            <strong>Days Left:</strong>
                            <div>
                                {(() => {
                                    const daysLeft = calculateDaysLeft();
                                    if (daysLeft === null) return 'N/A';
                                    if (daysLeft < 0) return <span style={{ color: '#dc3545' }}>Overdue</span>;
                                    if (daysLeft === 0) return <span style={{ color: '#ff6b6b' }}>Today</span>;
                                    return <span style={{ color: daysLeft <= 2 ? '#ffc107' : '#28a745' }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>;
                                })()}
                            </div>
                        </div>
                    </div>

                    {assignment.is_late_submission && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '4px',
                            color: '#856404'
                        }}>
                            ⚠️ <strong>Late Submission</strong> - This assignment was submitted after the deadline
                        </div>
                    )}

                    {assignment.is_overdue && !assignment.completed_at && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#f8d7da',
                            border: '1px solid #f5c6cb',
                            borderRadius: '4px',
                            color: '#721c24'
                        }}>
                            🔴 <strong>Overdue</strong> - The deadline for this assignment has passed
                        </div>
                    )}

                    {assignedContents && assignedContents.length > 0 && (
                        <div className="contents-section">
                            <h4 className="subsection-title">Learning Content ({assignedContents.length})</h4>
                            <ul className="content-list">
                                {assignedContents.map(c => (
                                    <li key={`content-${c.id}`} className="content-list-item">
                                        <span className="content-title">{c.title}</span>
                                        <button
                                            className="view-btn"
                                            onClick={() => handleViewContent(c)}
                                        >
                                            👁️ View
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {(!assignedContents || assignedContents.length === 0) && assignment && (
                        <div className="contents-section">
                            <h4 className="subsection-title">Learning Content (0)</h4>
                            <p style={{ color: '#666' }}>No content assigned for this program</p>
                        </div>
                    )}

                    <div style={{ marginTop: '1rem' }}>
                        <button className="btn-primary btn-full" onClick={openSubmit}>Submit Work</button>
                    </div>
                </div>
            </main>

            <Footer />

            {showSubmitModal && (
                <div className="modal-overlay">
                    <div className="modal-content modal-sm">
                        <h3 className="modal-title">Submit Work</h3>

                        {assignment.is_overdue && (
                            <div style={{
                                padding: '0.75rem',
                                backgroundColor: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '4px',
                                color: '#856404',
                                marginBottom: '1rem'
                            }}>
                                ⚠️ <strong>Late Submission</strong> - This submission will be marked as late since it's past the deadline ({new Date(assignment.end_date).toLocaleDateString()})
                            </div>
                        )}

                        <div className="form-group">
                            <label>Program</label>
                            <input type="text" value={assignment.program.goal} disabled className="form-input" />
                        </div>

                        <div className="form-group">
                            <label>Start Date</label>
                            <input type="text" value={assignment.start_date ? new Date(assignment.start_date).toLocaleDateString() : ''} disabled className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>End Date</label>
                            <input type="text" value={assignment.end_date ? new Date(assignment.end_date).toLocaleDateString() : ''} disabled className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>Duration</label>
                            <input type="text" value={`${assignment.duration_days} days`} disabled className="form-input" />
                        </div>

                        <div className="form-group">
                            <label>My Notes</label>
                            <textarea rows={4} className="form-textarea" value={learnerNotes} onChange={(e) => setLearnerNotes(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label>Attachment (img, video, pdf)</label>
                            <input type="file" accept="image/*,video/*,.pdf" onChange={handleFileChange} />
                            <div className="upload-hint">Images, Videos, PDFs (Max: 500MB for videos, 50MB for others)</div>
                        </div>

                        <div className="modal-actions">
                            <button onClick={closeSubmit} className="btn-secondary">Cancel</button>
                            <button onClick={handleSubmit} disabled={uploading} className="btn-primary">{uploading ? 'Submitting...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showContentModal && selectedContent && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <h3 className="modal-title">{selectedContent.title}</h3>
                            <div className="modal-header-actions">
                                <a
                                    href={getFileUrl(selectedContent.file_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="open-new-tab-btn"
                                    title="Open in new tab"
                                >
                                    🔗 Open in New Tab
                                </a>
                                <button onClick={closeContentModal} className="modal-close-btn">✕</button>
                            </div>
                        </div>
                        <div className="content-viewer-container">
                            {renderContentViewer()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LearnerProgramAssignmentDetails;
