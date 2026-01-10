import React, { useEffect, useState } from 'react';
import Emoji from '../../components/common/Emoji';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import ReportChartModal from './ReportChartModal';
import ProgramReportModal from './ProgramReportModal';
import { downloadProgressReportPDF } from '../../utils/pdfGenerator';
import '../../styles/Pages.css';
import '../../styles/ManageUsersLayout.css';

const LearnerReports = () => {
  const { learnerId } = useParams();
  const navigate = useNavigate();
  const [groupedReports, setGroupedReports] = useState([]);
  const [learnerInfo, setLearnerInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChartModal, setShowChartModal] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [showProgramReport, setShowProgramReport] = useState(false);
  const [programStatistics, setProgramStatistics] = useState(null);
  const [loadingProgramStats, setLoadingProgramStats] = useState(false);

  useEffect(() => {
    fetchLearnerReports();
    fetchStatistics();
  }, [learnerId]);

  const fetchLearnerReports = async () => {
    try {
      setLoading(true);
      const data = await sessionReportService.getByLearnerGrouped(parseInt(learnerId));
      setGroupedReports(data);

      // Get learner info from first report if available
      if (data.length > 0 && data[0].reports.length > 0) {
        const firstReport = data[0].reports[0];
        // Fetch learner details from summary
        const summary = await sessionReportService.getLearnersSummary();
        const learner = summary.find(l => l.learner_id === parseInt(learnerId));
        setLearnerInfo(learner);
      }
    } catch (error) {
      console.error('Error fetching learner reports:', error);
      toast.error('Failed to load learner reports');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const stats = await sessionReportService.getStatistics(parseInt(learnerId));
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const toggleProgram = (programName) => {
    setExpandedPrograms(prev => ({
      ...prev,
      [programName]: !prev[programName]
    }));
  };

  const handleShowChart = () => {
    setShowChartModal(true);
  };

  const handleShowProgramReport = async (programName, e) => {
    e.stopPropagation();
    try {
      setLoadingProgramStats(true);
      const stats = await sessionReportService.getProgramStatistics(parseInt(learnerId), programName);
      setProgramStatistics(stats);
      setShowProgramReport(true);
    } catch (error) {
      console.error('Error fetching program statistics:', error);
      toast.error('Failed to load program statistics');
    } finally {
      setLoadingProgramStats(false);
    }
  };

  const handleDownloadAllProgramsPDF = () => {
    try {
      downloadProgressReportPDF({
        learnerName: learnerInfo?.learner_name || 'Learner',
        programName: null, // null means all programs
        statistics: statistics,
        groupedReports: groupedReports,
      });
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const getMeterColor = (value, type) => {
    if (type === 'prompt') {
      const numValue = value === 'I' ? 0 : parseInt(value);
      if (numValue >= 70) return 'text-red-600';
      if (numValue >= 40) return 'text-orange-600';
      return 'text-green-600';
    } else {
      const numValue = value === 'Full' ? 100 : parseInt(value);
      if (numValue >= 80) return 'text-green-600';
      if (numValue >= 50) return 'text-orange-600';
      return 'text-red-600';
    }
  };

  return (
    <div className="page-content">
      <div className="report-detail-container">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title"><Emoji emoji="📈" size="xl" /> Learner Reports</h1>
            {learnerInfo && (
              <div className="report-learner-info">
                <p className="report-learner-name">{learnerInfo.learner_name}</p>
                {learnerInfo.iip_id && (
                  <p className="report-learner-iip">IIP ID: {learnerInfo.iip_id}</p>
                )}
              </div>
            )}
          </div>
          <div className="button-group">
            <button
              onClick={handleDownloadAllProgramsPDF}
              className="btn-success"
              disabled={loading || groupedReports.length === 0}
              title={groupedReports.length === 0 ? 'No reports available to download' : 'Download all reports as PDF'}
            >
              📥 Download PDF Report
            </button>
            <button
              onClick={handleShowChart}
              className="btn-chart"
              disabled={loading || !statistics}
            >
              📊 View Charts
            </button>
            <button
              onClick={() => navigate('/head/reports')}
              className="btn-secondary"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Statistics Summary */}
        {statistics && (
          <div className="statistics-summary">
            <h3 className="statistics-title">Overall Statistics</h3>
            <div className="statistics-grid">
              <div className="stat-card stat-card-blue">
                <div className="stat-value">{statistics.total_reports}</div>
                <div className="stat-label">Total Reports</div>
              </div>
              <div className="stat-card stat-card-green">
                <div className="stat-value">
                  {Object.keys(statistics.program_breakdown).length}
                </div>
                <div className="stat-label">Programs</div>
              </div>
              <div className="stat-card stat-card-purple">
                <div className="stat-value">
                  {Object.keys(statistics.prompt_distribution).length}
                </div>
                <div className="stat-label">Prompt Levels Used</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading reports...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && groupedReports.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-description">No reports found for this learner</p>
          </div>
        )}

        {/* Grouped Reports */}
        {!loading && groupedReports.length > 0 && (
          <div className="grouped-reports">
            {groupedReports.map((group) => (
              <div
                key={group.program_name}
                className="program-group"
              >
                {/* Program Header */}
                <div
                  onClick={() => toggleProgram(group.program_name)}
                  className="program-group-header"
                >
                  <div className="program-group-info">
                    <h3 className="program-group-title">{group.program_name}</h3>
                    <p className="program-group-count">
                      {group.total_records} report{group.total_records !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="program-group-actions">
                    <button
                      onClick={(e) => handleShowProgramReport(group.program_name, e)}
                      disabled={loadingProgramStats}
                      className="btn-program-report"
                    >
                      📊 Report
                    </button>
                    <div className="program-group-toggle">
                      {expandedPrograms[group.program_name] ? '▼' : '▶'}
                    </div>
                  </div>
                </div>

                {/* Reports List */}
                {expandedPrograms[group.program_name] && (
                  <div className="program-reports-list">
                    <div className="reports-list-items">
                      {group.reports.map((report, index) => (
                        <div
                          key={report.id}
                          className="report-item"
                        >
                          <div className="report-item-header">
                            <div className="report-item-number">
                              Report #{group.reports.length - index}
                            </div>
                            <div className="report-item-date">
                              {new Date(report.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className="report-meters">
                            <div>
                              <div className="report-meter-label">Prompt Meter</div>
                              <div className={`report-meter-value ${getMeterColor(report.prompt_meter, 'prompt')}`}>
                                {report.prompt_meter}
                              </div>
                            </div>
                            <div>
                              <div className="report-meter-label">Reinforcement Meter</div>
                              <div className={`report-meter-value ${getMeterColor(report.reinforcement_meter, 'reinforcement')}`}>
                                {report.reinforcement_meter}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart Modal */}
      {showChartModal && statistics && (
        <ReportChartModal
          statistics={statistics}
          learnerName={learnerInfo?.learner_name || 'Learner'}
          learnerId={parseInt(learnerId)}
          onClose={() => setShowChartModal(false)}
        />
      )}

      {/* Program Report Modal */}
      {showProgramReport && programStatistics && (
        <ProgramReportModal
          statistics={programStatistics}
          learnerName={learnerInfo?.learner_name || 'Learner'}
          onClose={() => setShowProgramReport(false)}
        />
      )}
    </div>
  );
};

export default LearnerReports;
