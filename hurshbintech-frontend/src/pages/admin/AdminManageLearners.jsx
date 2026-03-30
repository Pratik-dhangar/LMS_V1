// AdminManageLearners.jsx - Admin view: list learners with Learning Progress access

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Users, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import adminService from '../../api/services/adminService';
import sessionService from '../../api/services/sessionService';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Table.css';
import '../../styles/ManageUsersLayout.css';
import '../../styles/components/common/Modal.css';

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
    const [reportCreatorFilter, setReportCreatorFilter] = useState('head'); // 'head', 'coach'
    const [selectedCoach, setSelectedCoach] = useState(null); // Filter by specific coach
    const [showRecordingModal, setShowRecordingModal] = useState(false);
    const [recordingRows, setRecordingRows] = useState([]);
    const [recordingModalLearnerName, setRecordingModalLearnerName] = useState('');
    const [loadingRecordings, setLoadingRecordings] = useState(false);
    const [openingRecordingSessionId, setOpeningRecordingSessionId] = useState(null);
    const [downloadingRecordingSessionId, setDownloadingRecordingSessionId] = useState(null);

    useEffect(() => {
        fetchLearners();
        fetchProgressReports();
    }, []);

    // Reset coach selection when switching to head filter
    useEffect(() => {
        if (reportCreatorFilter === 'head') {
            setSelectedCoach(null);
        }
    }, [reportCreatorFilter]);

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
                const key = r.learner_id ?? `standalone_${r.id}`;
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
            await generateLearnerProgressReportPDF(report, { previewOnly: true, signatureImage: '/sign/sign.jpeg' });
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

    const openLearnerRecordingModal = async (learner) => {
        try {
            setRecordingModalLearnerName(learner.name || 'Learner');
            setShowRecordingModal(true);
            setLoadingRecordings(true);
            const data = await adminService.getLearnerSessionRecordings(learner.user_id);
            const toSortValue = (row) => {
                const dateValue = row?.latest_event_at
                    ? Date.parse(row.latest_event_at)
                    : row?.created_at
                        ? Date.parse(row.created_at)
                        : row?.scheduled_date
                            ? Date.parse(row.scheduled_date)
                            : NaN;
                if (!Number.isNaN(dateValue)) return dateValue;
                return Number(row?.session_db_id || 0);
            };
            const sortedRows = [...(data?.sessions || [])].sort(
                (a, b) => toSortValue(b) - toSortValue(a)
            );
            setRecordingRows(sortedRows);
        } catch (err) {
            console.error('Error fetching learner recordings:', err);
            toast.error('Failed to load session recordings');
            setRecordingRows([]);
        } finally {
            setLoadingRecordings(false);
        }
    };

    const handleWatchRecording = async (sessionDbId) => {
        try {
            setOpeningRecordingSessionId(sessionDbId);
            const data = await sessionService.getRecordingUrl(sessionDbId);
            const playbackUrl = data?.playback_url;
            if (!playbackUrl) {
                toast.error('Recording URL not available yet');
                return;
            }
            window.open(playbackUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
            const detail = err?.response?.data?.detail;
            toast.error(detail || 'Unable to open recording');
        } finally {
            setOpeningRecordingSessionId(null);
        }
    };

    const getRecordingDownloadFilename = (row, playbackUrl) => {
        const extensionMatch = playbackUrl?.match(/\.(webm|mp4|mkv|mov)(?:\?|$)/i);
        const extension = extensionMatch?.[1] || 'webm';
        const sessionRef = row?.session_id || row?.session_db_id || 'session';
        return `${sessionRef}_recording.${extension}`;
    };

    const triggerDownloadAnchor = (url, fileName) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleDownloadRecording = async (row) => {
        const sessionDbId = row?.session_db_id;
        if (!sessionDbId) {
            toast.error('Session ID missing for download');
            return;
        }

        try {
            setDownloadingRecordingSessionId(sessionDbId);
            const data = await sessionService.getRecordingUrl(sessionDbId);
            const playbackUrl = data?.playback_url;

            if (!playbackUrl) {
                toast.error('Recording URL not available yet');
                return;
            }

            const fileName = getRecordingDownloadFilename(row, playbackUrl);

            try {
                const response = await fetch(playbackUrl);
                if (!response.ok) {
                    throw new Error(`Download failed with status ${response.status}`);
                }

                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                triggerDownloadAnchor(blobUrl, fileName);
                window.URL.revokeObjectURL(blobUrl);
                toast.success('Recording download started');
            } catch (blobError) {
                console.warn('Blob download failed, falling back to direct URL:', blobError);
                triggerDownloadAnchor(playbackUrl, fileName);
                toast.info('Opened recording URL for download');
            }
        } catch (err) {
            const detail = err?.response?.data?.detail;
            toast.error(detail || 'Unable to download recording');
        } finally {
            setDownloadingRecordingSessionId(null);
        }
    };

    const filterReportsByCreator = (reports) => {
        let filtered = reports;

        // Filter by head/coach type
        if (reportCreatorFilter === 'head') {
            filtered = filtered.filter(r => r.report_created_by?.toLowerCase().includes('(head)'));
        } else if (reportCreatorFilter === 'coach') {
            filtered = filtered.filter(r => r.report_created_by?.toLowerCase().includes('(coach)'));
        }

        // Filter by specific coach if selected
        if (selectedCoach && reportCreatorFilter === 'coach') {
            filtered = filtered.filter(r => {
                const createdBy = (r.report_created_by || '').toLowerCase();
                return createdBy.includes(selectedCoach.toLowerCase());
            });
        }

        return filtered;
    };

    // Extract unique coach names from reports
    const getUniqueCoaches = () => {
        const coaches = new Set();
        Object.values(progressReportsMap).forEach(reports => {
            reports.forEach(r => {
                if (r.report_created_by?.toLowerCase().includes('(coach)')) {
                    // Extract coach name by removing the "(coach)" suffix
                    const coachName = r.report_created_by.replace(/\s*\(coach\)\s*$/i, '').trim();
                    if (coachName) coaches.add(coachName);
                }
            });
        });
        return Array.from(coaches).sort();
    };

    // Collect standalone (unregistered learner) coach reports grouped by name
    const standaloneCoachRows = (() => {
        const byName = {};
        Object.keys(progressReportsMap).forEach(key => {
            if (!key.startsWith('standalone_')) return;
            const reports = progressReportsMap[key] || [];
            const coachReports = reports.filter(r => r.report_created_by?.toLowerCase().includes('(coach)'));
            coachReports.forEach(r => {
                const nameKey = (r.name || 'Unknown').toLowerCase();
                if (!byName[nameKey]) byName[nameKey] = { name: r.name || 'Unknown', reports: [] };
                byName[nameKey].reports.push(r);
            });
        });
        return Object.values(byName);
    })();

    const showSessionRecordingsColumn = reportCreatorFilter !== 'coach';

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

                    {/* Report Creator Filter */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#374151' }}>Filter Reports:</span>

                        {/* Head/Coach Selector */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['head', 'coach'].map(filter => (
                                <button
                                    key={filter}
                                    onClick={() => setReportCreatorFilter(filter)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.375rem',
                                        border: 'none',
                                        fontSize: '0.875rem',
                                        fontWeight: filter === reportCreatorFilter ? 600 : 400,
                                        background: filter === reportCreatorFilter
                                            ? 'linear-gradient(135deg, #7c1c1c, #a83232)'
                                            : '#e5e7eb',
                                        color: filter === reportCreatorFilter ? 'white' : '#374151',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {`${filter.charAt(0).toUpperCase() + filter.slice(1)} Reports`}
                                </button>
                            ))}
                        </div>

                        {/* Coach Selector - shown only when Coach filter is selected */}
                        {reportCreatorFilter === 'coach' && getUniqueCoaches().length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>By Coach:</span>
                                <select
                                    value={selectedCoach || ''}
                                    onChange={(e) => setSelectedCoach(e.target.value || null)}
                                    style={{
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '0.375rem',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.875rem',
                                        backgroundColor: 'white',
                                        color: '#374151',
                                        cursor: 'pointer',
                                        fontWeight: 500,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <option value="">All Coaches</option>
                                    {getUniqueCoaches().map(coach => (
                                        <option key={coach} value={coach}>
                                            {coach}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
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
                                                <th className="table-primary-th">Start Date</th>
                                                <th className="table-primary-th">Skill Development Graph </th>
                                                <th className="table-primary-th">The Comprehensive Skill Development Evaluation Report</th>
                                                {showSessionRecordingsColumn && (
                                                    <th className="table-primary-th">Session Recordings</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="table-primary-body">
                                            {/* Unregistered learner rows — visible only in Coach filter */}
                                            {reportCreatorFilter === 'coach' && standaloneCoachRows.map((row, index) => (
                                                <tr key={`standalone_${row.name}`} className="table-primary-row">
                                                    <td className="table-primary-td">{index + 1}</td>
                                                    <td className="table-primary-td">
                                                        <div className="table-primary-cell-name-text">{row.name}</div>
                                                        <div className="table-primary-cell-subtitle" style={{ color: '#f59e0b', fontSize: '0.75rem' }}>Not registered</div>
                                                    </td>
                                                    <td className="table-primary-td" style={{ color: '#9ca3af' }}>—</td>
                                                    <td className="table-primary-td" style={{ color: '#9ca3af' }}>—</td>
                                                    <td className="table-primary-td table-primary-td-center">
                                                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Not registered</span>
                                                    </td>
                                                    <td className="table-primary-td">
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                            {row.reports.map(r => (
                                                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                                                    {showSessionRecordingsColumn && (
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Not registered</span>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {filteredLearners.map((learner, index) => (
                                                <tr key={learner.id} className="table-primary-row">
                                                    <td className="table-primary-td">{(reportCreatorFilter === 'coach' ? standaloneCoachRows.length : 0) + index + 1}</td>
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
                                                    {/* Skill Development Graph  */}
                                                    <td className="table-primary-td table-primary-td-center">
                                                        <button
                                                            onClick={() => handleViewProgress(learner)}
                                                            className="app-modal-btn app-modal-btn--primary"
                                                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
                                                        >
                                                            📈 View Reports
                                                        </button>
                                                    </td>
                                                    {/*THE COMPREHENSIVE SKILL DEVELOPMENT EVALUATION REPORT */}
                                                    <td className="table-primary-td">
                                                        {(() => {
                                                            const progReports = progressReportsMap[learner.user_id] || [];
                                                            const filteredProgReports = filterReportsByCreator(progReports);
                                                            if (filteredProgReports.length === 0) {
                                                                return <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>— No reports</span>;
                                                            }
                                                            return (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                    {filteredProgReports.map(r => (
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
                                                    {showSessionRecordingsColumn && (
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <button
                                                                onClick={() => openLearnerRecordingModal(learner)}
                                                                className="app-modal-btn app-modal-btn--primary"
                                                                style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
                                                            >
                                                                🎥 View Sessions
                                                            </button>
                                                        </td>
                                                    )}
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

            {showRecordingModal && (
                <div
                    className="app-modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowRecordingModal(false);
                        }
                    }}
                >
                    <div className="app-modal-container app-modal-container--lg" onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header app-modal-header--primary">
                            <div className="app-modal-header-content">
                                <h3 className="app-modal-title">Session Recordings</h3>
                                <p className="app-modal-subtitle">{recordingModalLearnerName}</p>
                            </div>
                            <button className="app-modal-close" onClick={() => setShowRecordingModal(false)} aria-label="Close session recordings modal">×</button>
                        </div>

                        <div className="app-modal-content">
                            {loadingRecordings ? (
                                <div className="app-modal-loading">
                                    <Loader2 className="loading-spinner" /> Loading session recordings...
                                </div>
                            ) : recordingRows.length === 0 ? (
                                <div className="app-modal-table-empty">No sessions found for this learner.</div>
                            ) : (
                                <div className="app-modal-table-container">
                                    <table className="app-modal-table">
                                        <thead className="app-modal-table-header">
                                            <tr>
                                                <th>Session</th>
                                                <th>Date</th>
                                                <th>Status</th>
                                                <th>Recording</th>
                                            </tr>
                                        </thead>
                                        <tbody className="app-modal-table-body">
                                            {recordingRows.map((row, idx) => (
                                                <tr key={`${row.session_db_id}_${idx}`} className="recording-table-row">
                                                    <td>{row.session_id || row.session_db_id}</td>
                                                    <td>
                                                        {row.latest_event_at
                                                            ? new Date(row.latest_event_at).toLocaleString()
                                                            : row.scheduled_date
                                                                ? new Date(row.scheduled_date).toLocaleString()
                                                                : 'N/A'}
                                                    </td>
                                                    <td>
                                                        <span className={`recording-status-chip recording-status-${(row.recording_status || 'pending').toLowerCase()}`}>
                                                            {row.recording_status || 'pending'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {row.recording_status === 'completed' && row.has_recording ? (
                                                            <div className="recording-action-group">
                                                                <button
                                                                    onClick={() => handleWatchRecording(row.session_db_id)}
                                                                    disabled={openingRecordingSessionId === row.session_db_id || downloadingRecordingSessionId === row.session_db_id}
                                                                    className="recording-watch-btn"
                                                                >
                                                                    {openingRecordingSessionId === row.session_db_id ? 'Opening...' : 'Watch'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDownloadRecording(row)}
                                                                    disabled={downloadingRecordingSessionId === row.session_db_id || openingRecordingSessionId === row.session_db_id}
                                                                    className="recording-download-btn"
                                                                >
                                                                    {downloadingRecordingSessionId === row.session_db_id ? 'Downloading...' : 'Download'}
                                                                </button>
                                                            </div>
                                                        ) : row.recording_status === 'failed' ? (
                                                            <span className="recording-meta recording-meta-failed">Failed</span>
                                                        ) : row.recording_status === 'processing' || row.recording_status === 'recording' ? (
                                                            <span className="recording-meta recording-meta-processing">Processing...</span>
                                                        ) : (
                                                            <span className="recording-meta recording-meta-empty">N/A</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
