import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import ReportChartModal from './ReportChartModal';
import ProgramReportModal from './ProgramReportModal';

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
    <div className="container mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              📈 Learner Reports
            </h1>
            {learnerInfo && (
              <div className="mt-2">
                <p className="text-lg font-semibold text-gray-700">{learnerInfo.learner_name}</p>
                {learnerInfo.iip_id && (
                  <p className="text-sm text-gray-600">IIP ID: {learnerInfo.iip_id}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleShowChart}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-semibold flex items-center gap-2"
            >
              📊 View Charts
            </button>
            <button
              onClick={() => navigate('/head/reports')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Statistics Summary */}
        {statistics && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3">Overall Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.total_reports}</div>
                <div className="text-xs text-gray-600">Total Reports</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Object.keys(statistics.program_breakdown).length}
                </div>
                <div className="text-xs text-gray-600">Programs</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center sm:col-span-1 col-span-2">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.keys(statistics.prompt_distribution).length}
                </div>
                <div className="text-xs text-gray-600">Prompt Levels Used</div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-600 mt-4">Loading reports...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && groupedReports.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">No reports found for this learner</p>
          </div>
        )}

        {/* Grouped Reports */}
        {!loading && groupedReports.length > 0 && (
          <div className="space-y-4">
            {groupedReports.map((group) => (
              <div
                key={group.program_name}
                className="border-2 border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Program Header */}
                <div
                  onClick={() => toggleProgram(group.program_name)}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4 cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{group.program_name}</h3>
                      <p className="text-sm text-blue-100">
                        {group.total_records} report{group.total_records !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleShowProgramReport(group.program_name, e)}
                        disabled={loadingProgramStats}
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded text-sm font-semibold flex items-center gap-1 transition-all"
                      >
                        📊 Report
                      </button>
                      <div className="text-2xl">
                        {expandedPrograms[group.program_name] ? '▼' : '▶'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reports List */}
                {expandedPrograms[group.program_name] && (
                  <div className="p-4 bg-gray-50">
                    <div className="space-y-3">
                      {group.reports.map((report, index) => (
                        <div
                          key={report.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-xs text-gray-500">
                              Report #{group.reports.length - index}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(report.created_at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Prompt Meter</div>
                              <div className={`text-2xl font-bold ${getMeterColor(report.prompt_meter, 'prompt')}`}>
                                {report.prompt_meter}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Reinforcement Meter</div>
                              <div className={`text-2xl font-bold ${getMeterColor(report.reinforcement_meter, 'reinforcement')}`}>
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
