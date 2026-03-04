// AdminProgramGraphView.jsx - Admin view of progress graph for a specific program

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import sessionReportService from "../../api/services/sessionReportService";
import { downloadProgramGraphPDF } from "../../utils/pdfGenerator";

import "../../styles/ManageUsersLayout.css";

const AdminProgramGraphView = () => {
    const { learnerId, programName } = useParams();
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState([]);
    const [learnerName, setLearnerName] = useState("");
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        fetchProgramSessionData();
    }, [learnerId, programName]);

    const fetchProgramSessionData = async () => {
        try {
            setLoading(true);
            const data = await sessionReportService.getProgramSessionData(
                parseInt(learnerId),
                programName
            );

            const processedData = data.map((session) => {
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
            });

            setSessionData(processedData);

            const learners = await sessionReportService.getUniqueLearners();
            const learner = learners.find((l) => l.learner_id === parseInt(learnerId));
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
                sessionData: sessionData,
            });
            toast.success("PDF downloaded successfully!");
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("Failed to generate PDF");
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const sessionIndex = sessionData.findIndex((s) => s.sessionLabel === label);
            const session = sessionData[sessionIndex];
            return (
                <div style={{
                    backgroundColor: "white", padding: "15px", border: "1px solid #ccc",
                    borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}>
                    <p style={{ fontWeight: "bold", marginBottom: "8px" }}>
                        Session ID: {session?.session_id}
                    </p>
                    {session?.session_date && (
                        <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                            {new Date(session.session_date).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                            })}
                        </p>
                    )}
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color, margin: "4px 0" }}>
                            {entry.name}: {entry.payload.prompt_meter} ({entry.value}/100)
                        </p>
                    ))}
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
                                onClick={() => navigate(`/admin/learner-programs/${learnerId}`)}
                                className="back-button"
                            >
                                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round"
                                    strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M15 19l-7-7 7-7"></path>
                                </svg>
                                Back to Programs
                            </button>
                            <div>
                                <h1 className="page-title">Progress Graph</h1>
                                <p className="page-description">
                                    {learnerName && `${learnerName} — `}
                                    {programName}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="search-section" style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            <button
                                onClick={() => setShowPreview(true)}
                                className="app-modal-btn app-modal-btn--primary"
                                disabled={loading || sessionData.length === 0}
                                title={sessionData.length === 0 ? "No session data to preview" : "Preview before downloading"}
                            >
                                👁️ View Report
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="app-modal-btn app-modal-btn--success"
                                disabled={loading || sessionData.length === 0}
                                title={sessionData.length === 0 ? "No session data to download" : "Download as PDF"}
                            >
                                📥 Download PDF Report
                            </button>
                        </div>

                        {/* Loading */}
                        {loading && (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p className="loading-text">Loading session data...</p>
                            </div>
                        )}

                        {/* Empty */}
                        {!loading && sessionData.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📭</div>
                                <p className="empty-state-description">No session data available for this program</p>
                            </div>
                        )}

                        {/* Chart */}
                        {!loading && sessionData.length > 0 && (
                            <div className="chart-container" style={{
                                backgroundColor: "white", padding: "2rem", borderRadius: "12px",
                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)", marginBottom: "2rem",
                            }}>
                                <h2 style={{ textAlign: "center", marginBottom: "1.5rem", fontSize: "1.5rem", fontWeight: "bold" }}>
                                    {programName} — Session Progress
                                </h2>
                                <ResponsiveContainer width="100%" height={500}>
                                    <BarChart data={sessionData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="sessionLabel"
                                            angle={0}
                                            textAnchor="middle"
                                            height={80}
                                            tick={{ fontSize: 12 }}
                                            label={{ value: "Session ID & Time", position: "insideBottom", offset: -10 }}
                                        />
                                        <YAxis
                                            domain={[0, 100]}
                                            tick={{ fontSize: 12 }}
                                            label={{ value: "Level (0-100)", angle: -90, position: "insideLeft" }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="square" />
                                        <Bar dataKey="prompt_value" fill="#db9d32" name="Prompt Level" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Session Details Table */}
                        {!loading && sessionData.length > 0 && (
                            <div style={{
                                backgroundColor: "white", padding: "2rem", borderRadius: "12px",
                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            }}>
                                <h2 className="page-subtitle" style={{ marginBottom: "1rem" }}>Session Details</h2>
                                <div style={{ overflowX: "auto" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                        <thead>
                                            <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
                                                <th style={{ padding: "12px", textAlign: "left" }}>Session ID</th>
                                                <th style={{ padding: "12px", textAlign: "left" }}>Date &amp; Time</th>
                                                <th style={{ padding: "12px", textAlign: "left" }}>Prompt Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessionData.map((session, index) => (
                                                <tr
                                                    key={index}
                                                    style={{ borderBottom: "1px solid #e5e7eb", transition: "background-color 0.2s" }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                                >
                                                    <td style={{ padding: "12px" }}><strong>Session {session.session_id}</strong></td>
                                                    <td style={{ padding: "12px" }}>
                                                        {session.session_date &&
                                                            new Date(session.session_date).toLocaleDateString("en-US", {
                                                                month: "short", day: "numeric", year: "numeric",
                                                                hour: "2-digit", minute: "2-digit",
                                                            })}
                                                    </td>
                                                    <td style={{ padding: "12px" }}>
                                                        <span style={{
                                                            padding: "4px 12px", borderRadius: "6px",
                                                            backgroundColor: "#dbeafe", color: "#9c6a08", fontWeight: "600",
                                                        }}>
                                                            {session.prompt_meter} ({session.prompt_value}/100)
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

            {/* Preview Modal */}
            {showPreview && (
                <div
                    style={{
                        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
                        zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center",
                        overflowY: "auto", padding: "2rem 1rem",
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
                >
                    <div style={{
                        backgroundColor: "white", borderRadius: "14px", width: "100%", maxWidth: "860px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.25)", overflow: "hidden",
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            background: "linear-gradient(135deg, #db9d32 0%, #b8790a 100%)",
                            padding: "1.5rem 2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                        }}>
                            <div>
                                <h2 style={{ color: "white", fontSize: "1.4rem", fontWeight: "bold", margin: 0 }}>
                                    📊 Progress Graph
                                </h2>
                                <p style={{ color: "rgba(255,255,255,0.85)", margin: "4px 0 0", fontSize: "0.95rem" }}>
                                    {learnerName && <strong>{learnerName}</strong>}
                                    {learnerName && " — "}
                                    {programName}
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
                                    background: "rgba(255,255,255,0.15)", border: "none", color: "white",
                                    fontSize: "1.4rem", lineHeight: 1, borderRadius: "50%", width: "36px",
                                    height: "36px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
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
                                    <BarChart data={sessionData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis
                                            dataKey="sessionLabel"
                                            angle={0} textAnchor="middle" height={70} tick={{ fontSize: 11 }}
                                            label={{ value: "Session ID & Time", position: "insideBottom", offset: -10 }}
                                        />
                                        <YAxis
                                            domain={[0, 100]} tick={{ fontSize: 11 }}
                                            label={{ value: "Level (0-100)", angle: -90, position: "insideLeft" }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="square" />
                                        <Bar dataKey="prompt_value" fill="#db9d32" name="Prompt Level" radius={[6, 6, 0, 0]} />
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
                                            <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600" }}>Date &amp; Time</th>
                                            <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600" }}>Prompt Level</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessionData.map((session, index) => (
                                            <tr
                                                key={index}
                                                style={{
                                                    backgroundColor: index % 2 === 0 ? "#f9fafb" : "white",
                                                    borderBottom: "1px solid #e5e7eb",
                                                }}
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
                                                    <span style={{
                                                        padding: "3px 12px", borderRadius: "6px",
                                                        backgroundColor: "#fef3c7", color: "#9c6a08", fontWeight: "600",
                                                    }}>
                                                        {session.prompt_meter} ({session.prompt_value}/100)
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer Buttons */}
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button onClick={handleDownloadPDF} className="app-modal-btn app-modal-btn--success">
                                    📥 Download PDF Report
                                </button>
                                <button onClick={() => setShowPreview(false)} className="app-modal-btn app-modal-btn--secondary">
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

export default AdminProgramGraphView;
