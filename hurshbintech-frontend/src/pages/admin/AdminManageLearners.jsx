// AdminManageLearners.jsx - Admin view: list learners with Learning Progress access

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Users, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import adminService from '../../api/services/adminService';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Table.css';
import '../../styles/ManageUsersLayout.css';

const AdminManageLearners = () => {
    const navigate = useNavigate();
    const [learners, setLearners] = useState([]);
    const [filteredLearners, setFilteredLearners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    const [error, setError] = useState('');
    const [visiblePasscodes, setVisiblePasscodes] = useState({});
    const [revealedPasscodes, setRevealedPasscodes] = useState({});
    const [progressReportsMap, setProgressReportsMap] = useState({});
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewingId, setPreviewingId] = useState(null);

    useEffect(() => {
        fetchLearners();
        fetchProgressReports();
    }, []);

    const fetchLearners = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await adminService.getAllLearners();
            setLearners(data);
            setFilteredLearners(data);
        } catch (err) {
            console.error('Error fetching learners:', err);
            setError('Failed to load learners. Please try again.');
            toast.error('Failed to load learners', { position: 'top-center', autoClose: 3000 });
        } finally {
            setLoading(false);
        }
    };

    const fetchProgressReports = async () => {
        try {
            const all = await learnerProgressReportService.getAll();
            const map = {};
            all.forEach(r => {
                const key = r.learner_id;
                if (key == null) return;
                if (!map[key]) map[key] = [];
                map[key].push(r);
            });
            setProgressReportsMap(map);
        } catch (err) {
            console.error('Error fetching progress reports:', err);
        }
    };

    const togglePasscodeVisibility = async (learnerId, userId) => {
        if (visiblePasscodes[learnerId]) {
            setVisiblePasscodes(prev => ({ ...prev, [learnerId]: false }));
            return;
        }
        if (!revealedPasscodes[learnerId]) {
            try {
                const response = await adminService.revealPasscode(userId);
                setRevealedPasscodes(prev => ({ ...prev, [learnerId]: response.passcode }));
                setVisiblePasscodes(prev => ({ ...prev, [learnerId]: true }));
            } catch (err) {
                console.error('Error revealing passcode:', err);
                toast.error('Failed to reveal passcode', { position: 'top-center', autoClose: 3000 });
            }
        } else {
            setVisiblePasscodes(prev => ({ ...prev, [learnerId]: true }));
        }
    };

    const handleViewProgress = (learner) => {
        navigate(`/admin/learner-programs/${learner.user_id}`, {
            state: { learnerName: learner.name }
        });
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

    const handleSearch = (query) => {
        setActiveSearchQuery(query);
        if (query.trim() === '') {
            setFilteredLearners(learners);
        } else {
            const lowerQuery = query.toLowerCase();
            const filtered = learners.filter(learner =>
                learner.name?.toLowerCase().includes(lowerQuery) ||
                learner.passcode?.toLowerCase().includes(lowerQuery)
            );
            setFilteredLearners(filtered);
        }
    };

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="back-button"
                        >
                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Dashboard
                        </button>
                        <div>
                            <h1 className="page-title">Manage Learners</h1>
                            <p className="page-description">View learners and their learning progress</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="search-section">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search by name, passcode..."
                        />
                    </div>

                    {activeSearchQuery && (
                        <div className="search-results-info">
                            <p className="search-results-text">
                                Found {filteredLearners.length} result{filteredLearners.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="icon-md error-icon" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading learners...</p>
                        </div>
                    ) : (
                        <div className="table-primary-container">
                            {filteredLearners.length === 0 ? (
                                <div className="table-primary-empty">
                                    <Users className="table-primary-empty-icon" />
                                    <p className="table-primary-empty-title">
                                        {activeSearchQuery ? 'No learners found' : 'No learners registered yet'}
                                    </p>
                                    <p className="table-primary-empty-description">
                                        {activeSearchQuery
                                            ? 'Try adjusting your search criteria'
                                            : 'No learners have been registered yet'}
                                    </p>
                                </div>
                            ) : (
                                <div className="table-primary-wrapper">
                                    <table className="table-primary">
                                        <thead className="table-primary-header">
                                            <tr>
                                                <th className="table-primary-th">Sr. No.</th>
                                                <th className="table-primary-th">Name</th>
                                                <th className="table-primary-th">Passcode</th>
                                                <th className="table-primary-th">Date of Assessment</th>
                                                <th className="table-primary-th">All Program Goals Report</th>
                                                <th className="table-primary-th">Final Generated Reports</th>
                                            </tr>
                                        </thead>
                                        <tbody className="table-primary-body">
                                            {filteredLearners.map((learner, index) => (
                                                <tr key={learner.id} className="table-primary-row">
                                                    <td className="table-primary-td">{index + 1}</td>
                                                    <td className="table-primary-td">
                                                        <div className="table-primary-cell-name-text">{learner.name}</div>
                                                        <div className="table-primary-cell-subtitle">{learner.role}</div>
                                                    </td>
                                                    <td className="table-primary-td">
                                                        <div className="manage-users-passcode-display">
                                                            <span className="table-primary-badge">
                                                                {visiblePasscodes[learner.id]
                                                                    ? revealedPasscodes[learner.id]
                                                                    : '••••••'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => togglePasscodeVisibility(learner.id, learner.user_id)}
                                                                className="manage-users-passcode-toggle-btn"
                                                                aria-label={visiblePasscodes[learner.id] ? 'Hide passcode' : 'Show passcode'}
                                                            >
                                                                {visiblePasscodes[learner.id]
                                                                    ? <EyeOff className="table-primary-icon-sm" />
                                                                    : <Eye className="table-primary-icon-sm" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="table-primary-td">
                                                        {learner.date_of_assessment
                                                            ? new Date(learner.date_of_assessment).toLocaleDateString()
                                                            : 'N/A'}
                                                    </td>
                                                    {/* All Program Goals Report */}
                                                    <td className="table-primary-td table-primary-td-center">
                                                        <button
                                                            onClick={() => handleViewProgress(learner)}
                                                            className="app-modal-btn app-modal-btn--primary"
                                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
                                                        >
                                                            📈 View Reports
                                                        </button>
                                                    </td>
                                                    {/* Final Generated Reports */}
                                                    <td className="table-primary-td">
                                                        {(() => {
                                                            const progReports = progressReportsMap[learner.user_id] || [];
                                                            if (progReports.length === 0) {
                                                                return <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>— No reports</span>;
                                                            }
                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {progReports.map(r => (
                                                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                            {/* <span style={{ fontSize: '0.78rem', color: '#555', whiteSpace: 'nowrap' }}>
                                                                                {new Date(r.date_of_report).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                            </span> */}
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
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {!loading && filteredLearners.length > 0 && (
                        <div className="page-summary">
                            Showing {filteredLearners.length} of {learners.length} learner{learners.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </main>
        </div>
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

export default AdminManageLearners;
