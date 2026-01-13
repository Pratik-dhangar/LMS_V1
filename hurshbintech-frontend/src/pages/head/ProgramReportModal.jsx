import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'react-toastify';
import { downloadProgressReportPDF } from '../../utils/pdfGenerator';


const ProgramReportModal = ({ statistics, learnerName, onClose }) => {
    // Prepare data for Prompt Meter pie chart
    const promptData = Object.entries(statistics.prompt_distribution || {}).map(([key, value]) => ({
        name: key,
        value: value
    }));

    // Prepare data for Reinforcement Meter pie chart
    const reinforcementData = Object.entries(statistics.reinforcement_distribution || {}).map(([key, value]) => ({
        name: key,
        value: value
    }));

    // Progress data for line chart
    const progressData = statistics.progress_data || [];

    // Color palettes
    const promptColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const reinforcementColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#fbbf24', '#fcd34d', '#ef4444'];

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        try {
            downloadProgressReportPDF({
                learnerName: learnerName,
                programName: statistics.program_name,
                programStatistics: statistics,
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
                <div className="modal-header modal-header-indigo">
                    <div>
                        <h2 className="modal-title"><Emoji emoji="📈" size="base" /> Program Report</h2>
                        <p className="modal-subtitle">{statistics.program_name}</p>
                        <p className="modal-subtitle" style={{ fontSize: '0.875rem', opacity: 0.9 }}>{learnerName}</p>
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
                            <div className="chart-summary-value">{statistics.total_reports || 0}</div>
                            <div className="chart-summary-label">Total Sessions</div>
                        </div>
                        <div className="chart-summary-card chart-summary-green">
                            <div className="chart-summary-value">
                                {Object.keys(statistics.prompt_distribution || {}).length}
                            </div>
                            <div className="chart-summary-label">Prompt Levels Used</div>
                        </div>
                        <div className="chart-summary-card chart-summary-purple">
                            <div className="chart-summary-value">
                                {Object.keys(statistics.reinforcement_distribution || {}).length}
                            </div>
                            <div className="chart-summary-label">Reinforcement Levels Used</div>
                        </div>
                    </div>

                    {/* Progress Over Time Line Chart */}
                    {progressData.length > 0 && (
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center"><Emoji emoji="📈" size="base" /> Progress Over Sessions</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={progressData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="session_number"
                                        label={{ value: 'Session #', position: 'insideBottom', offset: -5 }}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white border border-gray-300 rounded p-3 shadow-lg">
                                                        <p className="font-bold">Session #{label}</p>
                                                        <p className="text-sm text-blue-600">Prompt: {data.prompt_meter}</p>
                                                        <p className="text-sm text-green-600">Reinforcement: {data.reinforcement_meter}</p>
                                                        {data.date && (
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {new Date(data.date).toLocaleDateString()}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="prompt_value"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        name="Prompt Level"
                                        dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="reinforcement_value"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        name="Reinforcement Level"
                                        dot={{ fill: '#10b981', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-gray-500 text-center mt-2">
                                Lower prompt values and higher reinforcement values indicate better progress
                            </p>
                        </div>
                    )}

                    {/* Pie Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Prompt Meter Distribution */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">📊 Prompt Meter Distribution</h3>
                            {promptData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={promptData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={90}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {promptData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={promptColors[index % promptColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-500 py-8">No data available</p>
                            )}
                        </div>

                        {/* Reinforcement Meter Distribution */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center"><Emoji emoji="🎯" size="base" /> Reinforcement Meter Distribution</h3>
                            {reinforcementData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={reinforcementData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={90}
                                            fill="#82ca9d"
                                            dataKey="value"
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {reinforcementData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={reinforcementColors[index % reinforcementColors.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-500 py-8">No data available</p>
                            )}
                        </div>
                    </div>

                    {/* Session History Table */}
                    {progressData.length > 0 && (
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-3">📋 Session History</h3>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b-2 border-gray-300">
                                            <th className="text-left py-2 px-3">Session #</th>
                                            <th className="text-left py-2 px-3">Date</th>
                                            <th className="text-center py-2 px-3">Prompt</th>
                                            <th className="text-center py-2 px-3">Reinforcement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {progressData.map((session) => (
                                            <tr key={session.session_number} className="border-b border-gray-200">
                                                <td className="py-2 px-3 font-semibold">#{session.session_number}</td>
                                                <td className="py-2 px-3">
                                                    {session.date ? new Date(session.date).toLocaleDateString() : '-'}
                                                </td>
                                                <td className="text-center py-2 px-3">
                                                    <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold ${session.prompt_value <= 20 ? 'bg-green-500' :
                                                        session.prompt_value <= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}>
                                                        {session.prompt_meter}
                                                    </span>
                                                </td>
                                                <td className="text-center py-2 px-3">
                                                    <span className={`inline-block px-2 py-1 rounded text-white text-xs font-bold ${session.reinforcement_value >= 80 ? 'bg-green-500' :
                                                        session.reinforcement_value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                        }`}>
                                                        {session.reinforcement_meter}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 pt-4">
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                        >
                            📥 Download PDF
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2"
                        >
                            🖨️ Print Report
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgramReportModal;
