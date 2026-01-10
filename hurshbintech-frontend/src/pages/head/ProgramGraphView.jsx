import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import sessionReportService from '../../api/services/sessionReportService';
import { downloadProgressReportPDF } from '../../utils/pdfGenerator';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/Pages.css';
import '../../styles/ManageUsersLayout.css';

const ProgramGraphView = () => {
    const { learnerId, programName } = useParams();
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState([]);
    const [learnerName, setLearnerName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProgramSessionData();
    }, [learnerId, programName]);

    const fetchProgramSessionData = async () => {
        try {
            setLoading(true);

            console.log('[ProgramGraphView] Fetching data for:', { learnerId, programName });

            // Fetch session data for this program
            // Note: programName is already decoded by React Router
            const data = await sessionReportService.getProgramSessionData(
                parseInt(learnerId),
                programName
            );

            // Process data to add session labels with ID and time
            const processedData = data.map(session => {
                const sessionTime = session.session_date
                    ? new Date(session.session_date).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    })
                    : 'N/A';

                return {
                    ...session,
                    sessionLabel: `S${session.session_id} - ${sessionTime}`
                };
            });

            setSessionData(processedData);

            // Fetch learner info
            const learners = await sessionReportService.getUniqueLearners();
            const learner = learners.find(l => l.learner_id === parseInt(learnerId));
            if (learner) {
                setLearnerName(learner.learner_name);
            }
        } catch (error) {
            console.error('Error fetching program session data:', error);
            toast.error('Failed to load session data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            if (!sessionData || sessionData.length === 0) {
                toast.error('No session data available to generate PDF.');
                return;
            }

            toast.info('Generating PDF report...');

            // Use the backend API to get comprehensive data
            const pdfData = await sessionReportService.getPdfData(
                parseInt(learnerId),
                programName
            );

            if (!pdfData || !pdfData.sessions || pdfData.sessions.length === 0) {
                toast.error('No data available for PDF generation.');
                return;
            }

            // Create programs array with single program
            const programs = [{
                program_name: pdfData.program_name,
                program_id: pdfData.program_id,
                total_sessions: pdfData.total_sessions,
                last_session_date: pdfData.sessions.length > 0
                    ? pdfData.sessions[pdfData.sessions.length - 1].session_date
                    : null,
                sessions: pdfData.sessions
            }];

            downloadProgressReportPDF({
                learnerName: pdfData.learner_name || learnerName || 'Learner',
                programName: pdfData.program_name,
                programs: programs
            });

            toast.success('PDF downloaded successfully!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
            toast.error(`Failed to generate PDF: ${errorMessage}`);
        }
    };

    // Custom tooltip for the chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const sessionIndex = sessionData.findIndex(s => s.sessionLabel === label);
            const session = sessionData[sessionIndex];

            return (
                <div style={{
                    backgroundColor: 'white',
                    padding: '15px',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Session ID: {session.session_id}</p>
                    {session.session_date && (
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            {new Date(session.session_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    )}
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color, margin: '4px 0' }}>
                            {entry.name}: {entry.payload[entry.dataKey === 'prompt_value' ? 'prompt_meter' : 'reinforcement_meter']} ({entry.value}/100)
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="page-container">
            <Navbar />
            <div className="page-main">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">📊 Program Progress Graph</h1>
                        <p className="page-description">
                            {learnerName && `${learnerName} - `}
                            {programName}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={loading || sessionData.length === 0}
                            className="btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            📥 Download PDF
                        </button>
                        <button
                            onClick={() => navigate(`/head/learner-reports/${learnerId}`)}
                            className="btn-secondary"
                        >
                            ← Back to Programs
                        </button>
                    </div>
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
                    <div className="chart-container" style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        marginBottom: '2rem'
                    }}>
                        <h2 style={{
                            textAlign: 'center',
                            marginBottom: '1.5rem',
                            fontSize: '1.5rem',
                            fontWeight: 'bold'
                        }}>
                            {programName} - Session Progress
                        </h2>
                        <ResponsiveContainer width="100%" height={500}>
                            <BarChart
                                data={sessionData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="sessionLabel"
                                    angle={0}
                                    textAnchor="middle"
                                    height={80}
                                    tick={{ fontSize: 12 }}
                                    label={{ value: 'Session ID & Time', position: 'insideBottom', offset: -10 }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    tick={{ fontSize: 12 }}
                                    label={{ value: 'Level (0-100)', angle: -90, position: 'insideLeft' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="square"
                                />
                                <Bar
                                    dataKey="prompt_value"
                                    fill="#3b82f6"
                                    name="Prompt Level"
                                    radius={[8, 8, 0, 0]}
                                />
                                <Bar
                                    dataKey="reinforcement_value"
                                    fill="#22c55e"
                                    name="Reinforcement Level"
                                    radius={[8, 8, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Session Details Table */}
                {!loading && sessionData.length > 0 && (
                    <div className="session-details-table" style={{
                        backgroundColor: 'white',
                        padding: '2rem',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h2 className="page-subtitle" style={{ marginBottom: '1rem' }}>
                            Session Details
                        </h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{
                                        backgroundColor: '#f3f4f6',
                                        borderBottom: '2px solid #e5e7eb'
                                    }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Session ID</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Date & Time</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Prompt Level</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Reinforcement Level</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessionData.map((session, index) => (
                                        <tr
                                            key={index}
                                            style={{
                                                borderBottom: '1px solid #e5e7eb',
                                                transition: 'background-color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <td style={{ padding: '12px' }}>
                                                <strong>Session {session.session_id}</strong>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {session.session_date &&
                                                    new Date(session.session_date).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                }
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#dbeafe',
                                                    color: '#1e40af',
                                                    fontWeight: '600'
                                                }}>
                                                    {session.prompt_meter} ({session.prompt_value}/100)
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#dcfce7',
                                                    color: '#15803d',
                                                    fontWeight: '600'
                                                }}>
                                                    {session.reinforcement_meter} ({session.reinforcement_value}/100)
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
            <Footer />
        </div>
    );
};

export default ProgramGraphView;
