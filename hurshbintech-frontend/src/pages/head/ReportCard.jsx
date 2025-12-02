import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import headService from '../../api/services/headService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/head/reportCard.css';

const ReportCard = () => {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllLearners();
  }, []);

  const fetchAllLearners = async () => {
    try {
      setLoading(true);

      // Fetch all learners and learners with reports in parallel
      const [allLearnersResponse, reportSummary] = await Promise.all([
        headService.getAllLearners(),
        sessionReportService.getLearnersSummary().catch(() => []) // Gracefully handle if no reports exist
      ]);

      console.log('All learners:', allLearnersResponse);
      console.log('Report summary:', reportSummary);

      // Create a map of learners with reports for quick lookup (using learner_id which is user.id)
      const reportMap = new Map();
      reportSummary.forEach(r => {
        reportMap.set(r.learner_id, r);
      });

      // Merge all learners with their report data (if any)
      // Note: learner.user_id is the actual user ID used in session_reports.learner_id
      const mergedLearners = allLearnersResponse.map(learner => {
        const reportData = reportMap.get(learner.user_id);
        console.log(`Learner ${learner.name} (user_id: ${learner.user_id}):`, reportData);
        return {
          learner_id: learner.user_id,  // Use user_id for navigation and matching
          profile_id: learner.id,        // Keep profile_id if needed
          learner_name: learner.name,
          iip_id: learner.iip_id || null,
          total_sessions: reportData?.total_sessions || 0,
          total_reports: reportData?.total_reports || 0,
          last_session_date: reportData?.last_session_date || null,
          programs_covered: reportData?.programs_covered || []
        };
      });

      setLearners(mergedLearners);
    } catch (error) {
      console.error('Error fetching learners:', error);
      toast.error('Failed to load learners');
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
    <div className="min-h-screen bg-gray-50 report-page">
      <Navbar />
      <div className="bg-white rounded-lg shadow-lg p-2 sm:p-4 report-card">
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
            <p className="text-gray-600 mt-4">Loading learners...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLearners.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">
              {searchTerm ? 'No learners found matching your search' : 'No learners registered yet'}
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
                className={`learner-card bg-gradient-to-br ${learner.total_reports > 0 ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-gray-50 to-gray-100 border-gray-200'} border-2 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer hover:scale-105`}
              >
                {/* Learner Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`${learner.total_reports > 0 ? 'bg-blue-500' : 'bg-gray-400'} text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold avatar`}>
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
                  <div className="bg-white rounded-lg p-2 text-center stat-box">
                    <div className="text-2xl font-bold text-blue-600">{learner.total_sessions}</div>
                    <div className="text-xs text-gray-600">Sessions</div>
                  </div>
                  <div className="bg-white rounded-lg p-2 text-center stat-box">
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

                {/* No Reports Badge */}
                {learner.total_reports === 0 && (
                  <div className="text-xs text-gray-500 italic mb-2">
                    No reports yet
                  </div>
                )}

                {/* View Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLearnerClick(learner.learner_id);
                  }}
                  className={`view-btn w-full ${learner.total_reports > 0 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 hover:bg-gray-500'} text-white py-2 rounded-lg text-sm font-semibold mt-2`}
                >
                  {learner.total_reports > 0 ? 'View Reports →' : 'View Details →'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ReportCard;
