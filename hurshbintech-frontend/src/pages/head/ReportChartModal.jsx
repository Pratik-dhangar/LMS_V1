import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ReportChartModal = ({ statistics, learnerName, onClose }) => {
  // Prepare data for Prompt Meter pie chart
  const promptData = Object.entries(statistics.prompt_distribution).map(([key, value]) => ({
    name: key,
    value: value
  }));

  // Prepare data for Reinforcement Meter pie chart
  const reinforcementData = Object.entries(statistics.reinforcement_distribution).map(([key, value]) => ({
    name: key,
    value: value
  }));

  // Prepare data for Program breakdown bar chart
  const programData = Object.entries(statistics.program_breakdown).map(([key, value]) => ({
    name: key.length > 30 ? key.substring(0, 30) + '...' : key,
    fullName: key,
    value: value
  }));

  // Color palettes
  const promptColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  const reinforcementColors = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#fbbf24', '#fcd34d', '#ef4444'];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-bold text-sm"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-lg sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">📊 Session Report Charts</h2>
              <p className="text-purple-100 mt-1">{learnerName}</p>
            </div>
            <button
              onClick={onClose}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold transition-all"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{statistics.total_reports}</div>
              <div className="text-sm text-gray-600 mt-1">Total Reports</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {Object.keys(statistics.prompt_distribution).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Prompt Levels</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {Object.keys(statistics.program_breakdown).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Programs Covered</div>
            </div>
          </div>

          {/* Pie Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prompt Meter Distribution */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">📊 Prompt Meter Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={promptData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {promptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={promptColors[index % promptColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Reinforcement Meter Distribution */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">🎯 Reinforcement Meter Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={reinforcementData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedLabel}
                    outerRadius={100}
                    fill="#82ca9d"
                    dataKey="value"
                  >
                    {reinforcementData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={reinforcementColors[index % reinforcementColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Program Breakdown Bar Chart */}
          <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">📚 Program Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={programData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tick={{ fontSize: 10 }}
                />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-gray-300 rounded p-2 shadow-lg">
                          <p className="font-semibold text-sm">{payload[0].payload.fullName}</p>
                          <p className="text-xs text-gray-600">Reports: {payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prompt Meter Table */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Prompt Meter Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3">Level</th>
                    <th className="text-right py-2 px-3">Count</th>
                    <th className="text-right py-2 px-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {promptData.map((item) => (
                    <tr key={item.name} className="border-b border-gray-200">
                      <td className="py-2 px-3 font-semibold">{item.name}</td>
                      <td className="text-right py-2 px-3">{item.value}</td>
                      <td className="text-right py-2 px-3">
                        {((item.value / statistics.total_reports) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reinforcement Meter Table */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Reinforcement Meter Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-3">Level</th>
                    <th className="text-right py-2 px-3">Count</th>
                    <th className="text-right py-2 px-3">%</th>
                  </tr>
                </thead>
                <tbody>
                  {reinforcementData.map((item) => (
                    <tr key={item.name} className="border-b border-gray-200">
                      <td className="py-2 px-3 font-semibold">{item.name}</td>
                      <td className="text-right py-2 px-3">{item.value}</td>
                      <td className="text-right py-2 px-3">
                        {((item.value / statistics.total_reports) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

export default ReportChartModal;
