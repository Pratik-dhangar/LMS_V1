import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import sessionReportService from "../../api/services/sessionReportService";
import { downloadProgramGraphPDF } from "../../utils/pdfGenerator";

import "../../styles/ManageUsersLayout.css";

const ProgramGraphView = () => {
  const { learnerId, programName } = useParams();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState([]);
  const [learnerName, setLearnerName] = useState("");
  const [skillName, setSkillName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchProgramSessionData();
  }, [learnerId, programName]);

  const fetchProgramSessionData = async () => {
    try {
      setLoading(true);

      console.log("[ProgramGraphView] Fetching data for:", {
        learnerId,
        programName,
      });

      // Fetch session data for this program
      // Note: programName is already decoded by React Router
      const data = await sessionReportService.getProgramSessionData(
        parseInt(learnerId),
        programName
      );

      const singleProgramData = await sessionReportService.getPdfData(
        parseInt(learnerId),
        programName
      );
      setSkillName(singleProgramData?.skill_name || "");

      // Process data to add session labels with ID and time
      const processedData = data.map((session, idx) => {
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
          xAxisKey: `S${session.session_id}-${idx}`,
        };
      });

      setSessionData(processedData);

      // Fetch learner info
      const learners = await sessionReportService.getUniqueLearners();
      const learner = learners.find(
        (l) => l.learner_id === parseInt(learnerId)
      );
      if (learner) {
        setLearnerName(learner.learner_name);
      }
    } catch (error) {
      console.error("Error fetching program session data:", error);
      toast.error("Failed to load session data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!sessionData || sessionData.length === 0) {
      toast.error("No session data available to generate PDF.");
      return;
    }
    try {
      await downloadProgramGraphPDF({
        learnerName: learnerName || "Learner",
        programName: programName,
        skillName,
        sessionData: sessionData,
      });
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  // Custom label component to show "Done" on zero-value bars
  const renderCustomLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (value === 0) {
      return (
        <text
          x={x + width / 2}
          y={y - 10}
          fill="#22c55e"
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
        >
          Done
        </text>
      );
    }
    return (
      <text x={x + width / 2} y={y - 10} fill="#333" textAnchor="middle" fontSize="12" fontWeight="bold">
        {value}
      </text>
    );
  };

  // Custom bar shape to render green line only on bars with 0 value
  const CustomBarShape = (props) => {
    const { x, y, width, height, fill, payload } = props;
    const isZeroValue = payload && payload.reinforcement_value === 0;

    return (
      <>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          radius="8,8,0,0"
        />
        {isZeroValue && (
          <line
            x1={x}
            y1={y}
            x2={x + width}
            y2={y}
            stroke="#22c55e"
            strokeWidth={3}
          />
        )}
      </>
    );
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const session = entry.payload;

      return (
        <div
          style={{
            backgroundColor: "white",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <p style={{ fontWeight: "bold", marginBottom: "8px" }}>
            Session ID: {session.session_id}
          </p>
          {session.session_date && (
            <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              {new Date(session.session_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <p style={{ color: entry.color, margin: "4px 0" }}>
            {entry.name}:{" "}
            {Number(session?.reinforcement_value ?? entry?.value ?? 0)} ({Number(session?.reinforcement_value ?? entry?.value ?? 0)}/100)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="page-container">
        <div className="page-main">
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
                Back to Reports
              </button>
              <div>
                <h1 className="page-title"> Progress Graph</h1>
                <p className="page-description">
                  {learnerName && `${learnerName} - `}
                  {programName}
                </p>
                <p className="page-description" style={{ marginTop: "0.25rem" }}>
                  Skill: {skillName || "-"}
                </p>
              </div>
            </div>

            <div className="search-section" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowPreview(true)}
                className="app-modal-btn app-modal-btn--primary"
                disabled={loading || sessionData.length === 0}
                title={
                  sessionData.length === 0
                    ? "No session data available to preview"
                    : "Preview the report before downloading"
                }
              >
                👁️ View Report
              </button>
              <button
                onClick={handleDownloadPDF}
                className="app-modal-btn app-modal-btn--success"
                disabled={loading || sessionData.length === 0}
                title={
                  sessionData.length === 0
                    ? "No session data available to download"
                    : "Download program report as PDF"
                }
              >
                📥 Download PDF Report
              </button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Loading session data...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && sessionData.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p className="empty-state-description">
                  No session data available for this program
                </p>
              </div>
            )}

            {/* Chart */}
            {!loading && sessionData.length > 0 && (
              <div
                className="chart-container"
                style={{
                  backgroundColor: "white",
                  padding: "2rem",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  marginBottom: "2rem",
                }}
              >
                <h2
                  style={{
                    textAlign: "center",
                    marginBottom: "1.5rem",
                    fontSize: "1.5rem",
                    fontWeight: "bold",
                  }}
                >
                  {programName} - Session Progress
                </h2>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart
                    data={sessionData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="xAxisKey"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Session ID & Time",
                        position: "insideBottom",
                        offset: -10,
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      label={{
                        value: "Level (0-100)",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip shared={false} content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
                      iconType="square"
                    />
                    <Bar
                      dataKey="reinforcement_value"
                      fill="#db9d32"
                      name="Reinforcement Level"
                      shape={<CustomBarShape />}
                    >
                      <LabelList
                        dataKey="reinforcement_value"
                        content={renderCustomLabel}
                        position="top"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Session Details Table */}
            {!loading && sessionData.length > 0 && (
              <div
                className="session-details-table"
                style={{
                  backgroundColor: "white",
                  padding: "2rem",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                }}
              >
                <h2 className="page-subtitle" style={{ marginBottom: "1rem" }}>
                  Session Details
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f3f4f6",
                          borderBottom: "2px solid #e5e7eb",
                        }}
                      >
                        <th style={{ padding: "12px", textAlign: "left" }}>
                          Session ID
                        </th>
                        <th style={{ padding: "12px", textAlign: "left" }}>
                          Date & Time
                        </th>
                        <th style={{ padding: "12px", textAlign: "left" }}>
                          Reinforcement Level
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.map((session, index) => (
                        <tr
                          key={index}
                          style={{
                            borderBottom: "1px solid #e5e7eb",
                            transition: "background-color 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#f9fafb")
                          }
                          onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "transparent")
                          }
                        >
                          <td style={{ padding: "12px" }}>
                            <strong>Session {session.session_id}</strong>
                          </td>
                          <td style={{ padding: "12px" }}>
                            {session.session_date &&
                              new Date(session.session_date).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "6px",
                                backgroundColor: "#dbeafe",
                                color: "#9c6a08",
                                fontWeight: "600",
                              }}
                            >
                              {session.reinforcement_meter || "N/A"} ({session.reinforcement_value ?? 0}/100)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Report Preview Modal ── */}
      {showPreview && (
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
              maxWidth: "860px",
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
                  📊 Progress Graph
                </h2>
                <p style={{ color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontSize: "0.95rem" }}>
                  {learnerName && <strong>{learnerName}</strong>}
                  {learnerName && " — "}
                  {programName}
                </p>
                <p style={{ color: "rgba(255,255,255,0.8)", margin: "4px 0 0", fontSize: "0.85rem" }}>
                  Skill: {skillName || "-"}
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
              {/* Chart */}
              <div style={{ marginBottom: "1.5rem" }}>
                <h3 style={{ textAlign: "center", fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem", color: "#374151" }}>
                  {programName} — Session Progress
                </h3>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={sessionData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="xAxisKey"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Session ID & Time", position: "insideBottom", offset: -10 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Level (0-100)", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip shared={false} content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="square" />
                    <Bar
                      dataKey="reinforcement_value"
                      fill="#db9d32"
                      name="Reinforcement Level"
                      shape={<CustomBarShape />}
                    >
                      <LabelList
                        dataKey="reinforcement_value"
                        content={renderCustomLabel}
                        position="top"
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Session Details Table */}
              <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "bold", marginBottom: "0.75rem", color: "#374151" }}>
                  Session Details
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#db9d32", color: "white" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600" }}>Session ID</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600" }}>Date & Time</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600" }}>Reinforcement Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionData.map((session, index) => (
                      <tr
                        key={index}
                        style={{ backgroundColor: index % 2 === 0 ? "#f9fafb" : "white", borderBottom: "1px solid #e5e7eb" }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: "600" }}>Session {session.session_id}</td>
                        <td style={{ padding: "10px 14px", color: "#6b7280" }}>
                          {session.session_date
                            ? new Date(session.session_date).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })
                            : "N/A"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "3px 12px",
                              borderRadius: "6px",
                              backgroundColor: "#fef3c7",
                              color: "#9c6a08",
                              fontWeight: "600",
                            }}
                          >
                            {session.reinforcement_meter || "N/A"} ({session.reinforcement_value ?? 0}/100)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={handleDownloadPDF}
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

export default ProgramGraphView;
