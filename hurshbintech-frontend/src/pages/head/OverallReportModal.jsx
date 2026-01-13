import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';


const OverallReportModal = ({ statistics, onClose }) => {
    // Prepare data for Program breakdown bar chart
    const programData = Object.entries(statistics.program_breakdown || {}).map(([key, value]) => ({
        name: key.length > 25 ? key.substring(0, 25) + '...' : key,
        fullName: key,
        reports: value
    }));

    // Prepare data for Learner breakdown bar chart
    const learnerData = Object.entries(statistics.learner_breakdown || {}).map(([key, value]) => ({
        name: key.length > 15 ? key.substring(0, 15) + '...' : key,
        fullName: key,
        reports: value
    }));

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

    // Color palettes
    const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const promptColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const reinforcementColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#fbbf24', '#fcd34d', '#ef4444'];

    const handlePrint = () => {
        window.print();
    };

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white border border-gray-300 rounded p-2 shadow-lg">
                    <p className="font-semibold text-sm">{payload[0].payload.fullName}</p>
                    <p className="text-xs text-gray-600">Reports: {payload[0].value}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: '1792px' }}>
                {/* Header */}
                <div className="modal-header modal-header-teal">
                    <div>
                        <h2 className="modal-title">📊 Overall Session Reports</h2>
                        <p className="modal-subtitle">Statistics across all learners and programs</p>
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
                    <div className="chart-summary-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                        <div className="chart-summary-card chart-summary-blue">
                            <div className="chart-summary-value">{statistics.total_reports || 0}</div>
                            <div className="chart-summary-label">Total Reports</div>
                        </div>
                        <div className="chart-summary-card chart-summary-green">
                            <div className="chart-summary-value">{statistics.total_learners || 0}</div>
                            <div className="chart-summary-label">Total Learners</div>
                        </div>
                        <div className="chart-summary-card chart-summary-purple">
                            <div className="chart-summary-value">{statistics.total_programs || 0}</div>
                            <div className="chart-summary-label">Total Programs</div>
                        </div>
                        <div className="chart-summary-card chart-summary-orange">
                            <div className="chart-summary-value">
                                {Object.keys(statistics.prompt_distribution || {}).length}
                            </div>
                            <div className="chart-summary-label">Prompt Levels Used</div>
                        </div>
                    </div>

                    {/* Program Breakdown Bar Chart */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">📚 Reports by Program</h3>
                        {programData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={programData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        interval={0}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="reports" fill="#8b5cf6" name="Reports" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No program data available</p>
                        )}
                    </div>

                    {/* Learner Breakdown Bar Chart */}
                    <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">👥 Reports by Learner</h3>
                        {learnerData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={learnerData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        height={100}
                                        interval={0}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="reports" fill="#10b981" name="Reports" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-center text-gray-500 py-8">No learner data available</p>
                        )}
                    </div>

                    {/* Pie Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Prompt Meter Distribution */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">📊 Prompt Meter Distribution</h3>
                            {promptData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={promptData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
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
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={reinforcementData}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
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

                    {/* Detailed Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Program Table */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-3">Program Breakdown</h3>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b-2 border-gray-300">
                                            <th className="text-left py-2 px-3">Program</th>
                                            <th className="text-right py-2 px-3">Reports</th>
                                            <th className="text-right py-2 px-3">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(statistics.program_breakdown || {}).map(([name, count]) => (
                                            <tr key={name} className="border-b border-gray-200">
                                                <td className="py-2 px-3 font-semibold truncate max-w-xs" title={name}>{name}</td>
                                                <td className="text-right py-2 px-3">{count}</td>
                                                <td className="text-right py-2 px-3">
                                                    {((count / statistics.total_reports) * 100).toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Learner Table */}
                        <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                            <h3 className="text-lg font-bold text-gray-800 mb-3">Learner Breakdown</h3>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white">
                                        <tr className="border-b-2 border-gray-300">
                                            <th className="text-left py-2 px-3">Learner</th>
                                            <th className="text-right py-2 px-3">Reports</th>
                                            <th className="text-right py-2 px-3">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(statistics.learner_breakdown || {}).map(([name, count]) => (
                                            <tr key={name} className="border-b border-gray-200">
                                                <td className="py-2 px-3 font-semibold">{name}</td>
                                                <td className="text-right py-2 px-3">{count}</td>
                                                <td className="text-right py-2 px-3">
                                                    {((count / statistics.total_reports) * 100).toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-4 pt-4">
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

export default OverallReportModal;
