import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';

const ReportCard = () => {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLearnersWithReports();
  }, []);

  const fetchLearnersWithReports = async () => {
    try {
      setLoading(true);
      const data = await sessionReportService.getLearnersSummary();
      setLearners(data);
    } catch (error) {
      console.error('Error fetching learners with reports:', error);
      toast.error('Failed to load learner reports');
    } finally {
      setLoading(false);
    }
  };

  const handleLearnerClick = (learnerId) => {
    navigate(`/head/learner-reports/${learnerId}`);
  };

  const filteredLearners = learners.filter(learner => {
    const searchLower = searchTerm.toLowerCase();
    return (
      learner.learner_name?.toLowerCase().includes(searchLower) ||
      learner.iip_id?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
              📊 Session Reports
            </h1>
            <p className="text-sm text-gray-600 mt-1">View learner session reports and progress</p>
          </div>
          <button
            onClick={() => navigate('/head/dashboard')}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Search by learner name or IIP ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="text-gray-600 mt-4">Loading learner reports...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLearners.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">
              {searchTerm ? 'No learners found matching your search' : 'No session reports available yet'}
            </p>
          </div>
        )}

        {/* Learners List */}
        {!loading && filteredLearners.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLearners.map((learner) => (
              <div
                key={learner.learner_id}
                onClick={() => handleLearnerClick(learner.learner_id)}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              >
                {/* Learner Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                    {learner.learner_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-lg">{learner.learner_name}</h3>
                    {learner.iip_id && (
                      <p className="text-xs text-gray-600">IIP: {learner.iip_id}</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-blue-600">{learner.total_sessions}</div>
                    <div className="text-xs text-gray-600">Sessions</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center">
                    <div className="text-2xl font-bold text-green-600">{learner.total_reports}</div>
                    <div className="text-xs text-gray-600">Reports</div>
                  </div>
                </div>

                {/* Last Session */}
                {learner.last_session_date && (
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Last Session:</span>{' '}
                    {new Date(learner.last_session_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                )}

                {/* Programs Badge */}
                {learner.programs_covered && learner.programs_covered.length > 0 && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs font-semibold text-gray-700">Programs:</span>
                    <span className="bg-purple-500 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                      {learner.programs_covered.length}
                    </span>
                  </div>
                )}

                {/* View Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLearnerClick(learner.learner_id);
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold mt-2"
                >
                  View Reports →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportCard;
