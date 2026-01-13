import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import { downloadProgressReportPDF } from '../../utils/pdfGenerator';


const ReportChartModal = ({ statistics, learnerName, learnerId, onClose }) => {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (learnerId) {
      fetchChartData();
    }
  }, [learnerId]);

  const fetchChartData = async () => {
    try {
      setLoading(true);
      const data = await sessionReportService.getByLearnerGrouped(learnerId);

      // Process data for the bar chart
      const processedData = [];

      data.forEach(group => {
        group.reports.forEach(report => {
          // Convert prompt meter to numeric value
          let promptValue = report.prompt_meter === 'I' ? 0 : parseInt(report.prompt_meter);

          // Convert reinforcement meter to numeric value
          let reinforcementValue = report.reinforcement_meter === 'Full' ? 100 : parseInt(report.reinforcement_meter);

          // Format session start time
          const sessionTime = report.session_started_at
            ? new Date(report.session_started_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })
            : new Date(report.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            });

          processedData.push({
            sessionTime: sessionTime,
            fullSessionTime: report.session_started_at || report.created_at,
            prompt: promptValue,
            reinforcement: reinforcementValue,
            goals: report.session_goals && report.session_goals.length > 0
              ? report.session_goals.join(', ')
              : report.program_name,
            programName: report.program_name
          });
        });
      });

      // Sort by session time (newest first)
      processedData.sort((a, b) => new Date(b.fullSessionTime) - new Date(a.fullSessionTime));

      setChartData(processedData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border-2 border-gray-300 rounded-lg p-3 shadow-lg">
          <p className="font-bold text-sm mb-2">{data.sessionTime}</p>
          <p className="text-xs text-gray-700 mb-2"><strong>Goals:</strong> {data.goals}</p>
          <p className="text-xs text-blue-600"><strong>Prompt:</strong> {data.prompt}</p>
          <p className="text-xs text-green-600"><strong>Reinforcement:</strong> {data.reinforcement}</p>
        </div>
      );
    }
    return null;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      // Fetch grouped reports for PDF
      const groupedReports = await sessionReportService.getByLearnerGrouped(learnerId);

      downloadProgressReportPDF({
        learnerName: learnerName,
        programName: null, // All programs
        statistics: statistics,
        groupedReports: groupedReports,
      });
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '1536px' }}>
        {/* Header */}
        <div className="modal-header modal-header-purple">
          <div>
            <h2 className="modal-title">📊 Session Report Charts</h2>
            <p className="modal-subtitle">{learnerName}</p>
          </div>
          <button
            onClick={onClose}
            className="modal-close-button"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Summary Cards */}
          <div className="chart-summary-grid">
            <div className="chart-summary-card chart-summary-blue">
              <div className="chart-summary-value">{statistics.total_reports}</div>
              <div className="chart-summary-label">Total Reports</div>
            </div>
            <div className="chart-summary-card chart-summary-green">
              <div className="chart-summary-value">
                {Object.keys(statistics.prompt_distribution).length}
              </div>
              <div className="chart-summary-label">Prompt Levels</div>
            </div>
            <div className="chart-summary-card chart-summary-purple">
              <div className="chart-summary-value">
                {Object.keys(statistics.program_breakdown).length}
              </div>
              <div className="chart-summary-label">Programs Covered</div>
            </div>
          </div>

          {/* Main Bar Chart */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
                📊 Session Progress - Prompt vs Reinforcement Meters
              </h3>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="goals"
                    angle={-45}
                    textAnchor="end"
                    height={150}
                    interval={0}
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Goals / Programs', position: 'insideBottom', offset: -80 }}
                  />
                  <YAxis
                    label={{ value: 'Meter Value', angle: -90, position: 'insideLeft' }}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="rect"
                  />
                  <Bar
                    dataKey="prompt"
                    fill="#3b82f6"
                    name="Prompt Meter"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="reinforcement"
                    fill="#10b981"
                    name="Reinforcement Meter"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center text-sm text-gray-600">
                <p>Each bar pair represents a session. Hover over bars to see detailed information.</p>
                <p className="mt-1">Sessions are ordered by time (most recent first).</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              onClick={handleDownloadPDF}
              className="btn-success"
            >
              📥 Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="btn-primary"
            >
              🖨️ Print Report
            </button>
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportChartModal;
