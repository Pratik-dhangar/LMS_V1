import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
import CreateProgressReportModal from './CreateProgressReportModal';
import '../../styles/ManageUsersLayout.css';
import '../../styles/head/reportCard.css';
import '../../styles/Table.css';

const ReportCard = () => {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [progressReportsMap, setProgressReportsMap] = useState({}); // learner_id → [reports]
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [sendingGoalsReportId, setSendingGoalsReportId] = useState(null);
  const [sendingFinalReportId, setSendingFinalReportId] = useState(null);

  useEffect(() => {
    fetchAllLearners();
    fetchProgressReports();
  }, []);

  const fetchAllLearners = async () => {
    try {
      setLoading(true);
      const uniqueLearners = await sessionReportService.getUniqueLearners();
      const transformedLearners = uniqueLearners.map(learner => ({
        learner_id: learner.learner_id,
        learner_name: learner.learner_name,
        iip_id: null,
        total_sessions: learner.total_sessions || 0,
        total_reports: learner.total_reports || 0,
        last_session_date: learner.last_session_date || null,
        programs_covered: learner.programs_covered || []
      }));
      setLearners(transformedLearners);
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
    navigate(`/head/learner-reports/${learnerId}`);
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

  const handleDeleteProgressReport = async (report) => {
    try {
      setDeletingId(report.id);
      await learnerProgressReportService.delete(report.id);
      toast.success('Report deleted successfully');
      setShowDeleteConfirm(null);
      fetchProgressReports();
    } catch (e) {
      toast.error('Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendGoalsReport = async (learner) => {
    try {
      setSendingGoalsReportId(learner.learner_id);
      await sessionReportService.sendGoalsReport(learner.learner_id);
      toast.success(`Goals report sent to ${learner.learner_name}'s registered email!`);
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(detail || 'Failed to send goals report email');
    } finally {
      setSendingGoalsReportId(null);
    }
  };

  const handleSendFinalReport = async (report) => {
    try {
      setSendingFinalReportId(report.id);
      await learnerProgressReportService.sendFinalReportEmail(report.id);
      toast.success('Final report email sent successfully!');
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(detail || 'Failed to send final report email');
    } finally {
      setSendingFinalReportId(null);
    }
  };

  const filteredLearners = learners.filter(learner => {
    const q = searchTerm.toLowerCase();
    return (
      (learner.learner_name?.toLowerCase() || '').includes(q) ||
      (learner.iip_id?.toLowerCase() || '').includes(q)
    );
  });

  return (
    <>
      <div className="page-container">
        <div className="page-main">
          <div className="page-content">
            {/* Header */}
            <div className="page-header">
              <button
                onClick={() => navigate("/head/dashboard")}
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
                <h1 className="page-title">Manage Learning Progress</h1>
                <p className="page-description">
                  View learner session reports and progress
                </p>
              </div>
            </div>

            {/* Search Bar + Comprehensive Report Button */}
            <div className="search-section" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="🔍 Search by learner name or ILP ID..."
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
                + Comprehensive Report
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
                      {searchTerm ? 'No learners found matching your search' : 'Report not Generated Yet'}
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
                          <th className="table-primary-th">Skill Development Graph </th>
                          <th className="table-primary-th">Comprehensive Skill Development Report</th>
                        </tr>
                      </thead>
                      <tbody className="table-primary-body">
                        {filteredLearners.map((learner, idx) => {
                          const progReports = (progressReportsMap[learner.learner_id] || [])
                            .filter(r => r.report_created_by?.toLowerCase().includes('(head)'));
                          return (
                            <tr key={learner.learner_id} className="table-primary-row">
                              <td className="table-primary-td">{idx + 1}</td>
                              <td className="table-primary-td">
                                <div className="table-primary-cell-name-text">{learner.learner_name}</div>
                                {learner.iip_id && <div className="table-primary-cell-subtitle">ILP: {learner.iip_id}</div>}
                              </td>
                              <td className="table-primary-td" style={{ textAlign: 'center' }}>
                                <span style={{ fontWeight: 700, color: '#7c1c1c', fontSize: '1.1rem' }}>{learner.total_sessions}</span>
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
                              {/* Skill Development Graph  */}
                              <td className="table-primary-td table-primary-td-center">
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => handleLearnerClick(learner.learner_id)}
                                    className="app-modal-btn app-modal-btn--primary"
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', whiteSpace: 'nowrap' }}
                                  >
                                    📈 View Reports
                                  </button>
                                  <button
                                    onClick={() => handleSendGoalsReport(learner)}
                                    disabled={sendingGoalsReportId === learner.learner_id}
                                    style={{
                                      background: sendingGoalsReportId === learner.learner_id
                                        ? '#9ca3af'
                                        : '#7a2c2c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.4rem',
                                      fontSize: '0.8rem',
                                      padding: '0.4rem 0.85rem',
                                      fontWeight: 600,
                                      cursor: sendingGoalsReportId === learner.learner_id ? 'not-allowed' : 'pointer',
                                      whiteSpace: 'nowrap',
                                      opacity: sendingGoalsReportId === learner.learner_id ? 0.7 : 1,
                                    }}
                                    title="Send Skill Development Graph  to learner's email"
                                  >
                                    {sendingGoalsReportId === learner.learner_id ? '⏳ Sending…' : '📧 Send'}
                                  </button>
                                </div>
                              </td>
                              {/*Comprehensive Skill Development Report */}
                              <td className="table-primary-td">
                                {progReports.length === 0 ? (
                                  <button
                                    onClick={() => setShowCreateReportModal(true)}
                                    style={createBtnStyle}
                                  >
                                    + Create
                                  </button>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {progReports.map(r => (
                                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                                        <button
                                          onClick={() => setShowDeleteConfirm(r.id)}
                                          disabled={deletingId === r.id}
                                          style={deleteBtnStyle}
                                          title="Delete this report"
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
                                        {showDeleteConfirm === r.id && (
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
                                                  onClick={() => setShowDeleteConfirm(null)}
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
                                                  onClick={() => handleDeleteProgressReport(r)}
                                                  disabled={deletingId === r.id}
                                                  style={{
                                                    background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '0.35rem',
                                                    padding: '0.6rem 1.5rem',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    cursor: deletingId === r.id ? 'not-allowed' : 'pointer',
                                                    opacity: deletingId === r.id ? 0.7 : 1
                                                  }}
                                                >
                                                  {deletingId === r.id ? 'Deleting...' : 'Delete Report'}
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
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

const deleteBtnStyle = {
  background: 'linear-gradient(135deg, #b91c1c, #dc2626)',
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

export default ReportCard;
