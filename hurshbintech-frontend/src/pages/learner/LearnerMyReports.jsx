import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LabelList,
} from "recharts";
import sessionReportService from "../../api/services/sessionReportService";
import learnerProgressReportService from "../../api/services/learnerProgressReportService";
import { downloadAllProgramsPDF, generateLearnerProgressReportPDF } from "../../utils/pdfGenerator";

import "../../styles/ManageUsersLayout.css";
import "../../styles/head/reportCard.css";
import "../../styles/Table.css";

const LearnerMyReports = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const learnerId = user?.id;

    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState(null);
    const [groupedReports, setGroupedReports] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [pdfPreviewData, setPdfPreviewData] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [progressReports, setProgressReports] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewingId, setPreviewingId] = useState(null);
    const [reportFilter, setReportFilter] = useState('head'); // 'head' | 'coach'

    useEffect(() => {
        if (learnerId) {
            fetchLearnerPrograms();
            fetchStatistics();
            fetchProgressReports();
        }
    }, [learnerId]);

    const fetchProgressReports = async () => {
        try {
            const reports = await learnerProgressReportService.getMyReports();
            setProgressReports(reports || []);
        } catch (error) {
            console.error("Error fetching progress reports:", error);
            setProgressReports([]);
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

    const fetchStatistics = async () => {
        try {
            const stats = await sessionReportService.getStatistics(learnerId);
            setStatistics(stats);
            const reports = await sessionReportService.getByLearnerGrouped(learnerId);
            setGroupedReports(reports);
        } catch (error) {
            console.error("Error fetching statistics:", error);
            setStatistics(null);
            setGroupedReports([]);
        }
    };

    const fetchLearnerPrograms = async () => {
        try {
            setLoading(true);
            const programsData = await sessionReportService.getLearnerPrograms(learnerId);
            setPrograms(programsData);
        } catch (error) {
            console.error("Error fetching learner programs:", error);
            toast.error("Failed to load programs");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadAllProgramsPDF = async () => {
        try {
            if (!programs || programs.length === 0) {
                toast.error("No programs available to generate report.");
                return;
            }
            toast.info("Generating PDF report...");
            let resolvedPrograms = pdfPreviewData?.programs;
            let resolvedLearnerName = pdfPreviewData?.learnerName;
            if (!resolvedPrograms) {
                const pdfData = await sessionReportService.getPdfData(learnerId);
                if (!pdfData || !pdfData.programs || pdfData.programs.length === 0) {
                    toast.error("No data available for PDF generation.");
                    return;
                }
                resolvedLearnerName = pdfData.learner_name || user?.name || "Learner";
                resolvedPrograms = pdfData.programs.map((prog) => ({
                    ...prog,
                    sessions: (prog.sessions || []).map((session) => ({
                        ...session,
                        sessionLabel: `S${session.session_id} - ${new Date(session.session_date || Date.now()).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
                    })),
                }));
            }
            await downloadAllProgramsPDF({
                learnerName: resolvedLearnerName || user?.name || "Learner",
                programs: resolvedPrograms,
            });
            toast.success("PDF downloaded successfully!");
        } catch (error) {
            console.error("Error generating PDF:", error);
            const errorMessage = error.response?.data?.detail || error.message || "Unknown error";
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
            const pdfData = await sessionReportService.getPdfData(learnerId);
            if (!pdfData || !pdfData.programs || pdfData.programs.length === 0) {
                toast.error("No data available for preview.");
                return;
            }
            const processedPrograms = pdfData.programs.map((prog) => ({
                ...prog,
                sessions: (prog.sessions || []).map((session) => {
                    const sessionTime = session.session_date
                        ? new Date(session.session_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : "N/A";
                    return { ...session, sessionLabel: `S${session.session_id} - ${sessionTime}` };
                }),
            }));
            setPdfPreviewData({
                learnerName: pdfData.learner_name || user?.name || "Learner",
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

    const renderCustomLabel = (props) => {
        const { x, y, width, value } = props;
        if (value === 0) {
            return (
                <text x={x + width / 2} y={y - 10} fill="#22c55e" textAnchor="middle" fontSize="12" fontWeight="bold">
                    Done
                </text>
            );
        }
        return (
            <text x={x + width / 2} y={y - 10} fill="#333" textAnchor="middle" fontSize="11" fontWeight="bold">
                {value}
            </text>
        );
    };

    const CustomBarShape = (props) => {
        const { x, y, width, height, fill, payload } = props;
        const isZeroValue = payload && payload.reinforcement_value === 0;
        return (
            <g>
                <rect x={x} y={y} width={width} height={height} fill={fill} radius={[6, 6, 0, 0]} />
                {isZeroValue && (
                    <line x1={x} y1={y} x2={x + width} y2={y} stroke="#22c55e" strokeWidth={3} />
                )}
            </g>
        );
    };

    return (
        <>
            <div className="page-container">
                <main className="page-main">
                    <div className="page-content">
                        {/* Header */}
                        <div className="page-header">
                            <button onClick={() => navigate("/learner/dashboard")} className="back-button">
                                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M15 19l-7-7 7-7"></path>
                                </svg>
                                Back to Dashboard
                            </button>
                            <div>
                                <h1 className="page-title">My Progress Report</h1>
                                <p className="page-description">
                                    {user?.name ? `${user.name}'s Learning Programs` : "My Learning Programs"}
                                </p>
                            </div>
                        </div>

                        {/* Loading State */}
                        {loading && (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p className="loading-text">Loading...</p>
                            </div>
                        )}

                        {!loading && (
                            <>
                                {/* Skill Development Graph  Card */}
                                <div style={sectionCard}>
                                    <div style={sectionHeader('#7c1c1c')}>
                                        <span>📊 Skill Development Graph And Report </span>
                                    </div>
                                    <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem', color: '#1f2937' }}>{user?.name || 'Learner'}</p>
                                            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                                                {programs.length} program{programs.length !== 1 ? 's' : ''} &middot; {programs.reduce((s, p) => s + (p.total_sessions || 0), 0)} sessions
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                                            <button
                                                onClick={handleViewReport}
                                                disabled={programs.length === 0 || loadingPreview}
                                                style={viewReportsBtnStyle}
                                            >
                                                {loadingPreview ? 'Loading...' : '📋 View Reports'}
                                            </button>
                                            <button
                                                onClick={handleDownloadAllProgramsPDF}
                                                disabled={programs.length === 0}
                                                style={dlBtnStyle}
                                            >
                                                ⬇ PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/*THE COMPREHENSIVE SKILL DEVELOPMENT EVALUATION REPORT Card */}
                                <div style={{ ...sectionCard, marginTop: '1.25rem' }}>
                                    <div style={{ ...sectionHeader('#7c1c1c'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span>📄 The Comprehensive Skill Development Evaluation Report</span>
                                        {/* Filter Tabs */}
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            {['head', 'coach'].map(f => (
                                                <button
                                                    key={f}
                                                    onClick={() => setReportFilter(f)}
                                                    style={{
                                                        background: reportFilter === f ? 'white' : 'rgba(255,255,255,0.18)',
                                                        color: reportFilter === f ? '#7c1c1c' : 'white',
                                                        border: 'none',
                                                        borderRadius: '1rem',
                                                        padding: '0.25rem 0.85rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                >
                                                    {f === 'head' ? 'Head' : 'Coach'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ padding: '1.25rem 1.5rem' }}>
                                        {progressReports.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                                <p style={{ margin: 0 }}>No final reports available yet</p>
                                            </div>
                                        ) : (() => {
                                            const filtered = progressReports.filter(r => {
                                                const by = (r.report_created_by || '').toLowerCase();
                                                if (reportFilter === 'head') return by.includes('head');
                                                if (reportFilter === 'coach') return by.includes('coach');
                                                return true;
                                            });
                                            if (filtered.length === 0) {
                                                return (
                                                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
                                                        <p style={{ margin: 0 }}>No {reportFilter} reports found</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {filtered.map((r, idx) => {
                                                        const by = (r.report_created_by || '').toLowerCase();
                                                        const isHead = by.includes('head');
                                                        const accentColor = isHead ? '#7c1c1c' : '#b87d0a';
                                                        const bgColor = isHead ? '#fff1f2' : '#fffbeb';
                                                        const badge = isHead ? 'Head' : 'Coach';
                                                        return (
                                                            <div key={r.id} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                backgroundColor: bgColor,
                                                                border: `1px solid ${accentColor}30`,
                                                                borderLeft: `4px solid ${accentColor}`,
                                                                borderRadius: '0.6rem',
                                                                padding: '0.85rem 1.1rem',
                                                                flexWrap: 'wrap',
                                                                gap: '0.75rem',
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                                    <span style={{
                                                                        background: accentColor,
                                                                        color: 'white',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 700,
                                                                        borderRadius: '0.9rem',
                                                                        padding: '0.18rem 0.6rem',
                                                                        letterSpacing: '0.03em',
                                                                        whiteSpace: 'nowrap',
                                                                    }}>
                                                                        {badge}
                                                                    </span>
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>
                                                                            Report #{idx + 1}
                                                                        </div>
                                                                        {r.report_created_by && (
                                                                            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                                                                                By: {r.report_created_by}
                                                                            </div>
                                                                        )}
                                                                        {r.date_of_report && (
                                                                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '1px' }}>
                                                                                {new Date(r.date_of_report).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <button
                                                                        onClick={() => handlePreviewProgressReport(r)}
                                                                        disabled={previewingId === r.id}
                                                                        style={{ ...previewBtnStyle, opacity: previewingId === r.id ? 0.7 : 1 }}
                                                                    >
                                                                        {previewingId === r.id ? '…' : '👁 Preview'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadProgressReport(r)}
                                                                        disabled={downloadingId === r.id}
                                                                        style={{ ...dlBtnStyle, opacity: downloadingId === r.id ? 0.7 : 1 }}
                                                                    >
                                                                        {downloadingId === r.id ? '…' : '⬇ PDF'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </>
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
                                                <div style={{ marginBottom: "1rem" }}>
                                                    <ResponsiveContainer width="100%" height={280}>
                                                        <BarChart data={prog.sessions} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                            <XAxis dataKey="sessionLabel" angle={0} textAnchor="middle" height={70} tick={{ fontSize: 11 }} label={{ value: "Session ID & Time", position: "insideBottom", offset: -10 }} />
                                                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: "Level (0-100)", angle: -90, position: "insideLeft" }} />
                                                            <Tooltip
                                                                content={({ active, payload, label }) => {
                                                                    if (active && payload && payload.length) {
                                                                        const entry = payload[0];
                                                                        const session = entry.payload;
                                                                        return (
                                                                            <div style={{ backgroundColor: "white", padding: "12px", border: "1px solid #ccc", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                                                                                {session && <p style={{ fontWeight: "bold", marginBottom: "4px" }}>Session ID: {session.session_id}</p>}
                                                                                {session?.session_date && (
                                                                                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                                                                                        {new Date(session.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                                                    </p>
                                                                                )}
                                                                                <p style={{ color: entry.color, margin: "2px 0" }}>
                                                                                    {entry.name}: {Number(entry?.value ?? 0)} ({Number(entry?.value ?? 0)}/100)
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                }}
                                                            />
                                                            <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="square" />
                                                            <Bar dataKey="reinforcement_value" fill="#db9d32" name="Reinforcement Level" radius={[6, 6, 0, 0]} shape={<CustomBarShape />}>
                                                                <LabelList dataKey="reinforcement_value" content={renderCustomLabel} position="top" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div style={{ overflowX: "auto" }}>
                                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                                                        <thead>
                                                            <tr style={{ backgroundColor: "#db9d32", color: "white" }}>
                                                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Session ID</th>
                                                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Date & Time</th>
                                                                <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: "600" }}>Reinforcement Level</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {prog.sessions.map((session, si) => (
                                                                <tr key={si} style={{ backgroundColor: si % 2 === 0 ? "#f9fafb" : "white", borderBottom: "1px solid #e5e7eb" }}>
                                                                    <td style={{ padding: "9px 12px", fontWeight: "600" }}>Session {session.session_id}</td>
                                                                    <td style={{ padding: "9px 12px", color: "#6b7280" }}>
                                                                        {session.session_date
                                                                            ? new Date(session.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                                                            : "N/A"}
                                                                    </td>
                                                                    <td style={{ padding: "9px 12px" }}>
                                                                        <span style={{ padding: "3px 10px", borderRadius: "6px", backgroundColor: "#fef3c7", color: "#9c6a08", fontWeight: "600" }}>
                                                                            {session.reinforcement_meter || "N/A"} ({session.reinforcement_value ?? 0}/100)
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
                                <button onClick={handleDownloadAllProgramsPDF} className="app-modal-btn app-modal-btn--success">
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

const statCard = (bg, color) => ({
    flex: '1 1 130px',
    backgroundColor: bg,
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    textAlign: 'center',
    color,
    minWidth: '120px',
});

const sectionCard = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    overflow: 'hidden',
    border: '1px solid #f0f0f0',
};

const sectionHeader = (bg) => ({
    background: `linear-gradient(135deg, ${bg}, #a83232)`,
    color: 'white',
    padding: '0.85rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
});

const viewReportsBtnStyle = {
    background: 'linear-gradient(135deg, #b87d0a, #db9d32)',
    color: 'white',
    border: 'none',
    borderRadius: '0.4rem',
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const previewBtnStyle = {
    background: 'linear-gradient(135deg, #b87d0a, #db9d32)',
    color: 'white',
    border: 'none',
    borderRadius: '0.4rem',
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

const dlBtnStyle = {
    background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
    color: 'white',
    border: 'none',
    borderRadius: '0.4rem',
    padding: '0.4rem 0.85rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
};

export default LearnerMyReports;
