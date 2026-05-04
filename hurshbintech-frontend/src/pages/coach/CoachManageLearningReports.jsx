import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import coachService from '../../api/services/coachService';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
import CreateProgressReportModal from '../head/CreateProgressReportModal';
import '../../styles/ManageUsersLayout.css';
import '../../styles/head/reportCard.css';
import '../../styles/Table.css';

const CoachManageLearningReports = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [learners, setLearners] = useState([]);
    const [progressReportsMap, setProgressReportsMap] = useState({}); // learner_id → [reports]
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateReportModal, setShowCreateReportModal] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewingId, setPreviewingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [sendingFinalReportId, setSendingFinalReportId] = useState(null);

    useEffect(() => {
        fetchAllLearners();
        fetchProgressReports();
    }, []);

    const fetchAllLearners = async () => {
        try {
            setLoading(true);
            const raw = await coachService.getAvailableLearners();
            // Normalize to a consistent shape
            const normalized = (raw || []).map(l => ({
                learner_id: l.id,
                learner_name: l.name,
                total_sessions: l.total_sessions ?? null,
                last_session_date: l.last_session_date ?? null,
                programs_covered: l.programs_covered ?? [],
            }));
            setLearners(normalized);
        } catch (error) {
            console.error('Error fetching learners:', error);
            toast.error('Failed to load learners');
        } finally {
            setLoading(false);
        }
    };

    const fetchProgressReports = async () => {
        try {
            const all = await learnerProgressReportService.getAll();
            const map = {};
            all.forEach(r => {
                const key = r.learner_id ?? `standalone_${r.id}`;
                if (!map[key]) map[key] = [];
                map[key].push(r);
            });
            setProgressReportsMap(map);
        } catch (err) {
            console.error('Error fetching progress reports:', err);
        }
    };

    const handleLearnerClick = (learnerId) => {
        navigate(`/coach/learner-reports/${learnerId}`);
    };

    const handleDownloadProgressReport = async (report) => {
        try {
            setDownloadingId(report.id);
            await generateLearnerProgressReportPDF(report, { signatureImage: '/sign/sign.jpeg' });
        } catch (e) {
            toast.error('Failed to download report');
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePreviewProgressReport = async (report) => {
        try {
            setPreviewingId(report.id);
            await generateLearnerProgressReportPDF(report, { signatureImage: '/sign/sign.jpeg', previewOnly: true });
        } catch (e) {
            toast.error('Failed to preview report');
        } finally {
            setPreviewingId(null);
        }
    };

    const handleSendFinalReport = async (report) => {
        try {
            setSendingFinalReportId(report.id);
            const senderName = user?.name || '';
            await learnerProgressReportService.sendFinalReportEmail(report.id, senderName);
            toast.success('Final report email sent successfully!');
        } catch (e) {
            const detail = e.response?.data?.detail;
            toast.error(detail || 'Failed to send final report email');
        } finally {
            setSendingFinalReportId(null);
        }
    };

    const handleDeleteProgressReport = async (report) => {
        try {
            setDeletingId(report.id);
            await learnerProgressReportService.delete(report.id);
            toast.success('Report deleted successfully');
            setDeleteConfirmId(null);
            fetchProgressReports();
        } catch (e) {
            toast.error('Failed to delete report');
        } finally {
            setDeletingId(null);
        }
    };

    // Build map of learner reports - BACKEND ALREADY FILTERS BY CURRENT COACH
    // No need to filter again, all returned reports are from current coach
    const reportsCreatedByCurrentCoach = {};
    Object.keys(progressReportsMap).forEach(key => {
        reportsCreatedByCurrentCoach[String(key)] = progressReportsMap[key];
    });

    // Build list of all learner IDs from reports (all already created by current coach via backend)
    const learnersWithMyReports = new Set();
    const learnerNameFromReports = {}; // Map of key → learner name from report
    const standaloneReports = []; // Reports for unregistered learners (no learner_id)

    Object.keys(reportsCreatedByCurrentCoach).forEach(key => {
        const reports = reportsCreatedByCurrentCoach[key] || [];
        if (reports.length === 0) return;

        if (key.startsWith('standalone_')) {
            // Unregistered learner — no user account, learner_id is null
            standaloneReports.push(...reports);
        } else {
            const learnerId = parseInt(key);
            if (!isNaN(learnerId)) {
                learnersWithMyReports.add(learnerId);
                if (reports[0]?.name) {
                    learnerNameFromReports[String(learnerId)] = reports[0].name;
                }
            }
        }
    });

    // Group standalone reports by name so each unique name shows as one row
    const standaloneByName = {};
    standaloneReports.forEach(r => {
        const nameKey = (r.name || 'Unknown').toLowerCase();
        if (!standaloneByName[nameKey]) standaloneByName[nameKey] = { name: r.name || 'Unknown', reports: [] };
        standaloneByName[nameKey].reports.push(r);
    });

    // Registered learners rows
    const registeredRows = Array.from(learnersWithMyReports).map(learnerId => {
        const learnerData = learners.find(l => l.learner_id === learnerId);
        if (learnerData) return learnerData;
        const nameFromReport = learnerNameFromReports[String(learnerId)];
        return {
            learner_id: learnerId,
            learner_name: nameFromReport || `Learner #${learnerId}`,
            total_sessions: null,
            last_session_date: null,
            programs_covered: [],
            _reports: reportsCreatedByCurrentCoach[String(learnerId)] || [],
        };
    });

    // Unregistered learners rows (use name as unique key)
    const standaloneRows = Object.values(standaloneByName).map(({ name, reports }) => ({
        learner_id: null,
        learner_name: name,
        total_sessions: null,
        last_session_date: null,
        programs_covered: [],
        _reports: reports,
        _standaloneKey: name,
    }));

    const filteredLearners = [...registeredRows, ...standaloneRows].filter(learner => {
        const q = searchTerm.toLowerCase();
        return (learner.learner_name?.toLowerCase() || '').includes(q);
    });

    return (
        <>
            <div className="page-container">
                <div className="page-main">
                    <div className="page-content">
                        {/* Header */}
                        <div className="page-header">
                            <button
                                onClick={() => navigate('/coach/dashboard')}
                                className="back-button"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M15 19l-7-7 7-7"></path>
                                </svg>
                                Back to Dashboard
                            </button>
                            <div>
                                <h1 className="page-title">Manage Learning Reports</h1>
                                <p className="page-description">
                                    View learner session reports and generate progress reports
                                </p>
                            </div>
                        </div>

                        {/* Search Bar + Create Report Button */}
                        <div className="search-section" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="🔍 Search by learner name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                                style={{ flex: 1 }}
                            />
                            <button
                                onClick={() => setShowCreateReportModal(true)}
                                style={{
                                    background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    padding: '0.6rem 1.25rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 6px rgba(124,28,28,0.3)',
                                }}
                            >
                                + Create Report
                            </button>
                        </div>

                        {/* Loading State */}
                        {loading && (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p className="loading-text">Loading learners...</p>
                            </div>
                        )}

                        {/* Table */}
                        {!loading && (
                            <div className="table-primary-container">
                                {filteredLearners.length === 0 ? (
                                    <div className="table-primary-empty" style={{ padding: '3rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                                        <p style={{ color: '#6b7280' }}>
                                            {searchTerm
                                                ? 'No learners found matching your search'
                                                : 'No reports created yet. Use "+ Create Report" to generate one.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="table-primary-wrapper">
                                        <table className="table-primary">
                                            <thead className="table-primary-header">
                                                <tr>
                                                    <th className="table-primary-th">Sr. No.</th>
                                                    <th className="table-primary-th">Learner Name</th>
                                                    <th className="table-primary-th">Comprehensive Skill Development Report</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-primary-body">
                                                {filteredLearners.map((learner, idx) => {
                                                    const progReports = learner._reports || (reportsCreatedByCurrentCoach[String(learner.learner_id)] || []);
                                                    return (
                                                        <tr key={learner.learner_id ?? learner._standaloneKey ?? idx} className="table-primary-row">
                                                            <td className="table-primary-td">{idx + 1}</td>
                                                            <td className="table-primary-td">
                                                                <div className="table-primary-cell-name-text">{learner.learner_name}</div>
                                                            </td>
                                                            {/*Comprehensive Skill Development Report — always has reports since row is only shown when ≥1 exist */}
                                                            <td className="table-primary-td">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {progReports.map(r => (
                                                                        <div key={r.id}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                                                                <button
                                                                                    onClick={() => handlePreviewProgressReport(r)}
                                                                                    disabled={previewingId === r.id}
                                                                                    style={previewBtnStyle}
                                                                                >
                                                                                    {previewingId === r.id ? '…' : '👁 Preview'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDownloadProgressReport(r)}
                                                                                    disabled={downloadingId === r.id}
                                                                                    style={dlBtnStyle}
                                                                                >
                                                                                    {downloadingId === r.id ? '…' : '⬇ PDF'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setDeleteConfirmId(r.id)}
                                                                                    disabled={deletingId === r.id}
                                                                                    style={deleteBtnStyle}
                                                                                >
                                                                                    {deletingId === r.id ? '…' : '🗑 Delete'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleSendFinalReport(r)}
                                                                                    disabled={sendingFinalReportId === r.id}
                                                                                    style={{
                                                                                        ...sendBtnStyle,
                                                                                        opacity: sendingFinalReportId === r.id ? 0.7 : 1,
                                                                                        cursor: sendingFinalReportId === r.id ? 'not-allowed' : 'pointer',
                                                                                    }}
                                                                                    title="Send Final Report to learner's email"
                                                                                >
                                                                                    {sendingFinalReportId === r.id ? '⏳ Sending…' : '📧 Send'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {!loading && filteredLearners.length > 0 && (
                            <div className="page-summary" style={{ padding: '0.75rem 0', fontSize: '0.85rem', color: '#6b7280' }}>
                                Showing {filteredLearners.length} of {learners.length} learner{learners.length !== 1 ? 's' : ''}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Progress Report Modal */}
            {showCreateReportModal && (
                <CreateProgressReportModal
                    onClose={() => setShowCreateReportModal(false)}
                    onCreated={() => fetchProgressReports()}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                        maxWidth: '500px',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ color: '#7c1c1c', marginBottom: '1rem' }}>Delete Report?</h3>
                        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                            Are you sure you want to delete this report? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{
                                    background: '#e5e7eb',
                                    color: '#374151',
                                    border: 'none',
                                    borderRadius: '0.35rem',
                                    padding: '0.6rem 1.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const reports = Object.values(progressReportsMap).flat();
                                    const report = reports.find(r => r.id === deleteConfirmId);
                                    if (report) handleDeleteProgressReport(report);
                                }}
                                disabled={deletingId === deleteConfirmId}
                                style={{
                                    background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.35rem',
                                    padding: '0.6rem 1.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: deletingId === deleteConfirmId ? 'not-allowed' : 'pointer',
                                    opacity: deletingId === deleteConfirmId ? 0.7 : 1
                                }}
                            >
                                {deletingId === deleteConfirmId ? 'Deleting...' : 'Delete Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const dlBtnStyle = {
    background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
    color: 'white',
    border: 'none',
    borderRadius: '0.35rem',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const previewBtnStyle = {
    background: 'linear-gradient(135deg, #b87d0a, #db9d32)',
    color: 'white',
    border: 'none',
    borderRadius: '0.35rem',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const createBtnStyle = {
    background: 'white',
    color: '#7c1c1c',
    border: '1px solid #7c1c1c',
    borderRadius: '0.35rem',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const deleteBtnStyle = {
    background: 'linear-gradient(135deg, #dc2626, #991b1b)',
    color: 'white',
    border: 'none',
    borderRadius: '0.35rem',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const sendBtnStyle = {
    background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
    color: 'white',
    border: 'none',
    borderRadius: '0.35rem',
    padding: '0.25rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

export default CoachManageLearningReports;
