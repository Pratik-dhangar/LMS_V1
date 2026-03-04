import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import coachService from '../../api/services/coachService';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
import CreateProgressReportModal from '../head/CreateProgressReportModal';
import '../../styles/ManageUsersLayout.css';
import '../../styles/head/reportCard.css';
import '../../styles/Table.css';

const CoachManageLearningReports = () => {
    const navigate = useNavigate();
    const [learners, setLearners] = useState([]);
    const [progressReportsMap, setProgressReportsMap] = useState({}); // learner_id → [reports]
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateReportModal, setShowCreateReportModal] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewingId, setPreviewingId] = useState(null);

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
            await generateLearnerProgressReportPDF(report);
        } catch (e) {
            toast.error('Failed to download report');
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePreviewProgressReport = async (report) => {
        try {
            setPreviewingId(report.id);
            await generateLearnerProgressReportPDF(report, { previewOnly: true });
        } catch (e) {
            toast.error('Failed to preview report');
        } finally {
            setPreviewingId(null);
        }
    };

    const filteredLearners = learners.filter(learner => {
        const q = searchTerm.toLowerCase();
        const nameMatch = (learner.learner_name?.toLowerCase() || '').includes(q);
        // Only show learners who have at least one coach-created progress report
        const coachReports = (progressReportsMap[learner.learner_id] || [])
            .filter(r => r.report_created_by?.toLowerCase().includes('(coach)'));
        return nameMatch && coachReports.length > 0;
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
                                                    <th className="table-primary-th">Sessions</th>
                                                    <th className="table-primary-th">Last Session</th>
                                                    <th className="table-primary-th">Goals</th>
                                                    <th className="table-primary-th">All Program Goals Report</th>
                                                    <th className="table-primary-th">Final Generated Reports</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-primary-body">
                                                {filteredLearners.map((learner, idx) => {
                                                    const progReports = (progressReportsMap[learner.learner_id] || [])
                                                        .filter(r => r.report_created_by?.toLowerCase().includes('(coach)'));
                                                    return (
                                                        <tr key={learner.learner_id} className="table-primary-row">
                                                            <td className="table-primary-td">{idx + 1}</td>
                                                            <td className="table-primary-td">
                                                                <div className="table-primary-cell-name-text">{learner.learner_name}</div>
                                                            </td>
                                                            <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                                                {learner.total_sessions != null
                                                                    ? <span style={{ fontWeight: 700, color: '#7c1c1c', fontSize: '1.1rem' }}>{learner.total_sessions}</span>
                                                                    : '—'}
                                                            </td>
                                                            <td className="table-primary-td">
                                                                {learner.last_session_date
                                                                    ? new Date(learner.last_session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                    : '—'}
                                                            </td>
                                                            <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                                                {learner.programs_covered?.length > 0
                                                                    ? <span className="table-primary-badge">{learner.programs_covered.length}</span>
                                                                    : '—'}
                                                            </td>
                                                            {/* All Program Goals Report */}
                                                            <td className="table-primary-td table-primary-td-center">
                                                                <button
                                                                    onClick={() => handleLearnerClick(learner.learner_id)}
                                                                    className="app-modal-btn app-modal-btn--primary"
                                                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
                                                                >
                                                                    📈 View Reports
                                                                </button>
                                                            </td>
                                                            {/* Final Generated Reports — always has reports since row is only shown when ≥1 exist */}
                                                            <td className="table-primary-td">
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {progReports.map(r => (
                                                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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

export default CoachManageLearningReports;
