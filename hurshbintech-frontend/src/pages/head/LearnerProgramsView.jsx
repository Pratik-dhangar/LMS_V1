import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import sessionReportService from "../../api/services/sessionReportService";
import { downloadAllProgramsPDF } from "../../utils/pdfGenerator";

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
  const [showPreview, setShowPreview] = useState(false);
  const [pdfPreviewData, setPdfPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

      // If preview data is already loaded, reuse it; otherwise fetch fresh
      let resolvedPrograms = pdfPreviewData?.programs;
      let resolvedLearnerName = pdfPreviewData?.learnerName;

      if (!resolvedPrograms) {
        const pdfData = await sessionReportService.getPdfData(parseInt(learnerId));
        if (!pdfData || !pdfData.programs || pdfData.programs.length === 0) {
          toast.error("No data available for PDF generation.");
          return;
        }
        resolvedLearnerName = pdfData.learner_name || learnerName || "Learner";
        resolvedPrograms = pdfData.programs.map((prog) => ({
          ...prog,
          sessions: (prog.sessions || []).map((session) => ({
            ...session,
            sessionLabel: `S${session.session_id} - ${new Date(session.session_date || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
          })),
        }));
      }

      await downloadAllProgramsPDF({
        learnerName: resolvedLearnerName || learnerName || "Learner",
        programs: resolvedPrograms,
      });

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      const errorMessage =
        error.response?.data?.detail || error.message || "Unknown error";
      toast.error(`Failed to generate PDF: ${errorMessage}`);
    }
  };

  const handleViewReport = async () => {
    try {
      if (!programs || programs.length === 0) {
        toast.error("No programs available to preview.");
        return;
      }
      setLoadingPreview(true);
      const pdfData = await sessionReportService.getPdfData(parseInt(learnerId));
      if (!pdfData || !pdfData.programs || pdfData.programs.length === 0) {
        toast.error("No data available for preview.");
        return;
      }
      // For each program, process sessions to add sessionLabel
      const processedPrograms = pdfData.programs.map((prog) => ({
        ...prog,
        sessions: (prog.sessions || []).map((session) => {
          const sessionTime = session.session_date
            ? new Date(session.session_date).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
            : "N/A";
          return {
            ...session,
            sessionLabel: `S${session.session_id} - ${sessionTime}`,
          };
        }),
      }));
      setPdfPreviewData({
        learnerName: pdfData.learner_name || learnerName || "Learner",
        programs: processedPrograms,
      });
      setShowPreview(true);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to load report preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const filteredPrograms = programs.filter((program) =>
    program.program_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="page-container">
        <main className="page-main">
          <div className="page-content">
            {/* Header */}
            <div className="page-header">
              <button
                onClick={() => navigate(-1)}
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
                Back to Manage Learning Progress
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
                onClick={handleViewReport}
                className="app-modal-btn app-modal-btn--primary"
                disabled={loading || programs.length === 0 || loadingPreview}
                title={
                  programs.length === 0
                    ? "No programs available to preview"
                    : "Preview the full report"
                }
              >
                {loadingPreview ? "Loading..." : "👁️ View Report"}
              </button>
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
      </div>

      {/* ── Report Preview Modal ── */}
      {showPreview && pdfPreviewData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            overflowY: "auto",
            padding: "2rem 1rem",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "900px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #db9d32 0%, #b8790a 100%)",
                padding: "1.5rem 2rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h2 style={{ color: "white", fontSize: "1.4rem", fontWeight: "bold", margin: 0 }}>
                  📊 Latest Skilled Development
                </h2>
                <p style={{ color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontSize: "0.95rem" }}>
                  <strong>{pdfPreviewData.learnerName}</strong>
                </p>
                <p style={{ color: "rgba(255,255,255,0.65)", margin: "4px 0 0", fontSize: "0.8rem" }}>
                  Generated on:{" "}
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  fontSize: "1.4rem",
                  lineHeight: 1,
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "1.5rem 2rem 2rem" }}>
              {/* Summary cards */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "120px", backgroundColor: "#fef3c7", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#9c6a08" }}>
                    {pdfPreviewData.programs.length}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Programs</div>
                </div>
                <div style={{ flex: 1, minWidth: "120px", backgroundColor: "#dcfce7", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: "#15803d" }}>
                    {pdfPreviewData.programs.reduce((sum, p) => sum + (p.total_sessions || p.sessions?.length || 0), 0)}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Total Sessions</div>
                </div>
                <div style={{ flex: 1, minWidth: "120px", backgroundColor: "#ede9fe", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#7c3aed" }}>
                    {(() => {
                      const dates = pdfPreviewData.programs.map(p => p.last_session_date).filter(Boolean).sort();
                      return dates.length > 0
                        ? new Date(dates[dates.length - 1]).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                        : "N/A";
                    })()}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Latest Session</div>
                </div>
              </div>

              {/* Per-program charts and tables */}
              {pdfPreviewData.programs.map((prog, pi) => (
                <div
                  key={pi}
                  style={{
                    marginBottom: "2.5rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    overflow: "hidden",
                  }}
                >
                  {/* Program sub-header */}
                  <div style={{ backgroundColor: "#f3f4f6", padding: "0.75rem 1.25rem", borderBottom: "1px solid #e5e7eb" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "bold", color: "#374151" }}>
                      📚 {prog.program_name}
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                      {prog.total_sessions || prog.sessions?.length || 0} Sessions
                      {prog.last_session_date && ` · Last: ${new Date(prog.last_session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </span>
                  </div>

                  <div style={{ padding: "1rem 1.25rem" }}>
                    {prog.sessions && prog.sessions.length > 0 ? (
                      <>
                        {/* Bar Chart */}
                        <div style={{ marginBottom: "1rem" }}>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                              data={prog.sessions}
                              margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis
                                dataKey="sessionLabel"
                                angle={0}
                                textAnchor="middle"
                                height={70}
                                tick={{ fontSize: 11 }}
                                label={{ value: "Session ID & Time", position: "insideBottom", offset: -10 }}
                              />
                              <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 11 }}
                                label={{ value: "Level (0-100)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const session = prog.sessions.find(s => s.sessionLabel === label);
                                    return (
                                      <div style={{ backgroundColor: "white", padding: "12px", border: "1px solid #ccc", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                                        {session && <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Session ID: {session.session_id}</p>}
                                        {session?.session_date && (
                                          <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                                            {new Date(session.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                          </p>
                                        )}
                                        {payload.map((entry, i) => (
                                          <p key={i} style={{ color: entry.color, margin: "2px 0" }}>
                                            {entry.name}: {session?.prompt_meter} ({entry.value}/100)
                                          </p>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="square" />
                              <Bar dataKey="prompt_value" fill="#db9d32" name="Prompt Level" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Session Details Table */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#db9d32", color: "white" }}>
                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Session ID</th>
                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Date & Time</th>
                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Prompt Level</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prog.sessions.map((session, si) => (
                                <tr
                                  key={si}
                                  style={{ backgroundColor: si % 2 === 0 ? "#f9fafb" : "white", borderBottom: "1px solid #e5e7eb" }}
                                >
                                  <td style={{ padding: "9px 12px", fontWeight: "600" }}>Session {session.session_id}</td>
                                  <td style={{ padding: "9px 12px", color: "#6b7280" }}>
                                    {session.session_date
                                      ? new Date(session.session_date).toLocaleDateString("en-US", {
                                        month: "short", day: "numeric", year: "numeric",
                                        hour: "2-digit", minute: "2-digit",
                                      })
                                      : "N/A"}
                                  </td>
                                  <td style={{ padding: "9px 12px" }}>
                                    <span style={{ padding: "3px 10px", borderRadius: "6px", backgroundColor: "#fef3c7", color: "#9c6a08", fontWeight: "600" }}>
                                      {session.prompt_meter} ({session.prompt_value}/100)
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "#9ca3af", textAlign: "center", padding: "1rem" }}>No session data available</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={handleDownloadAllProgramsPDF}
                  className="app-modal-btn app-modal-btn--success"
                >
                  📥 Download PDF Report
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LearnerProgramsView;
