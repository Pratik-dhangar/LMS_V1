import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import sessionReportService from "../../api/services/sessionReportService";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { downloadProgressReportPDF } from "../../utils/pdfGenerator";

import "../../styles/ManageUsersLayout.css";
import "../../styles/head/reportCard.css";

const LearnerProgramsView = () => {
  const { learnerId } = useParams();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [learnerName, setLearnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statistics, setStatistics] = useState(null);
  const [groupedReports, setGroupedReports] = useState([]);

  useEffect(() => {
    fetchLearnerPrograms();
    fetchStatistics();
  }, [learnerId]);

  const fetchStatistics = async () => {
    try {
      const stats = await sessionReportService.getStatistics(
        parseInt(learnerId)
      );
      setStatistics(stats);
      const reports = await sessionReportService.getByLearnerGrouped(
        parseInt(learnerId)
      );
      setGroupedReports(reports);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      // Don't block page load if statistics fail
      setStatistics(null);
      setGroupedReports([]);
    }
  };

  const fetchLearnerPrograms = async () => {
    try {
      setLoading(true);

      // Fetch programs for this learner
      const programsData = await sessionReportService.getLearnerPrograms(
        parseInt(learnerId)
      );
      setPrograms(programsData);

      // Fetch learner info
      const learners = await sessionReportService.getUniqueLearners();
      const learner = learners.find(
        (l) => l.learner_id === parseInt(learnerId)
      );
      if (learner) {
        setLearnerName(learner.learner_name);
      }
    } catch (error) {
      console.error("Error fetching learner programs:", error);
      toast.error("Failed to load programs");
    } finally {
      setLoading(false);
    }
  };

  const handleProgramClick = (programName) => {
    navigate(
      `/head/learner/${learnerId}/program/${encodeURIComponent(programName)}`
    );
  };

  const handleDownloadAllProgramsPDF = async () => {
    try {
      if (!programs || programs.length === 0) {
        toast.error("No programs available to generate report.");
        return;
      }

      toast.info("Generating PDF report...");

      // Use the new backend API to get comprehensive PDF data
      const pdfData = await sessionReportService.getPdfData(
        parseInt(learnerId)
      );

      if (!pdfData || !pdfData.programs || pdfData.programs.length === 0) {
        toast.error("No data available for PDF generation.");
        return;
      }

      downloadProgressReportPDF({
        learnerName: pdfData.learner_name || learnerName || "Learner",
        programName: null,
        programs: pdfData.programs,
      });

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage =
        error.response?.data?.detail || error.message || "Unknown error";
      toast.error(`Failed to generate PDF: ${errorMessage}`);
    }
  };

  const filteredPrograms = programs.filter((program) =>
    program.program_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/reports")}
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
              Back to Session Reports
            </button>
            <div>
              <h1 className="page-title">Programs & Goals </h1>
              <p className="page-description">
                learner Kumar's Learning Programs
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-section">
            <input
              type="text"
              placeholder="🔍 Search programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button
              onClick={handleDownloadAllProgramsPDF}
              className="app-modal-btn app-modal-btn--success"
              disabled={loading || programs.length === 0}
              title={
                programs.length === 0
                  ? "No programs available to download"
                  : "Download all programs report as PDF"
              }
            >
              📥 Download PDF Report
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading programs...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredPrograms.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p className="empty-state-description">
                {searchTerm
                  ? "No programs found matching your search"
                  : "No programs found for this learner"}
              </p>
            </div>
          )}

          {/* Programs Grid */}
          {!loading && filteredPrograms.length > 0 && (
            <div className="report-cards-grid">
              {filteredPrograms.map((program, index) => (
                <div
                  key={index}
                  onClick={() => handleProgramClick(program.program_name)}
                  className="report-card report-card-active"
                >
                  {/* Program Header */}
                  <div className="report-card-header">
                    <div className="report-card-avatar report-card-avatar-active">
                      📚
                    </div>
                    <div className="report-card-info">
                      <h3 className="report-card-name">
                        {program.program_name}
                      </h3>
                      {program.program_id && (
                        <p className="report-card-iip">
                          ID: {program.program_id}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="report-stats">
                    <div className="report-stat-box">
                      {/* CHANGED: learner -> program */}
                      <div className="report-stat-value">
                        {program.total_sessions || 0}
                      </div>
                      <div className="report-stat-label">Sessions</div>
                    </div>
                    {/* <div className="report-stat-box">
                     
                      <div className="report-stat-value report-stat-reports">
                        {program.total_reports || 0}
                      </div>
                      <div className="report-stat-label">Reports</div>
                    </div> */}
                  </div>

                  {/* Last Session */}
                  {program.last_session_date && (
                    <div className="report-card-meta">
                      <span className="report-meta-label">Last Session:</span>{" "}
                      {new Date(program.last_session_date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </div>
                  )}

                  {/* View Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProgramClick(program.program_name);
                    }}
                    className="report-view-button report-view-button-active"
                  >
                    View Graph →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LearnerProgramsView;
