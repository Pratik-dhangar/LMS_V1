import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import sessionReportService from '../../api/services/sessionReportService';
import headService from '../../api/services/headService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/ManageUsersLayout.css';
import '../../styles/head/ReportCard.css';

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

      // Use the new API endpoint to fetch unique learners from session reports
      const uniqueLearners = await sessionReportService.getUniqueLearners();

      console.log('Unique learners from session reports:', uniqueLearners);

      // Transform the data to match the expected format
      const transformedLearners = uniqueLearners.map(learner => ({
        learner_id: learner.learner_id,
        learner_name: learner.learner_name,
        iip_id: null, // IIP ID not available in session reports
        total_sessions: learner.total_sessions || 0,
        total_reports: learner.total_reports || 0,
        last_session_date: learner.last_session_date || null,
        programs_covered: learner.programs_covered || []
      }));

      setLearners(transformedLearners);
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
   <div className="page-container">
      <Navbar />
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/dashboard")}
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
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">Session Reports</h1>
              <p className="page-description">
                View learner session reports and progress
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-section">
            <input
              type="text"
              placeholder="🔍 Search by learner name or IIP ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading learners...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLearners.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-description">
              {searchTerm ? 'No learners found matching your search' : 'No learners registered yet'}
            </p>
          </div>
        )}

        {/* Learners List */}
        {!loading && filteredLearners.length > 0 && (
          <div className="report-cards-grid">
            {filteredLearners.map((learner) => (
              <div
                key={learner.learner_id}
                onClick={() => handleLearnerClick(learner.learner_id)}
                className={`report-card ${learner.total_reports > 0 ? 'report-card-active' : 'report-card-inactive'}`}
              >
                {/* Learner Header */}
                <div className="report-card-header">
                  <div className={`report-card-avatar ${learner.total_reports > 0 ? 'report-card-avatar-active' : 'report-card-avatar-inactive'}`}>
                    {learner.learner_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="report-card-info">
                    <h3 className="report-card-name">{learner.learner_name}</h3>
                    {learner.iip_id && (
                      <p className="report-card-iip">IIP: {learner.iip_id}</p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="report-stats">
                  <div className="report-stat-box">
                    <div className="report-stat-value report-stat-sessions">{learner.total_sessions}</div>
                    <div className="report-stat-label">Sessions</div>
                  </div>
                  <div className="report-stat-box">
                    <div className="report-stat-value report-stat-reports">{learner.total_reports}</div>
                    <div className="report-stat-label">Reports</div>
                  </div>
                </div>

                {/* Last Session */}
                {learner.last_session_date && (
                  <div className="report-card-meta">
                    <span className="report-meta-label">Last Session:</span>{' '}
                    {new Date(learner.last_session_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                )}

                {/* Programs Badge */}
                {learner.programs_covered && learner.programs_covered.length > 0 && (
                  <div className="report-programs">
                    <span className="report-programs-label">Programs:</span>
                    <span className="report-programs-badge">
                      {learner.programs_covered.length}
                    </span>
                  </div>
                )}

                {/* No Reports Badge */}
                {learner.total_reports === 0 && (
                  <div className="report-no-reports">
                    No reports yet
                  </div>
                )}

                {/* View Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLearnerClick(learner.learner_id);
                  }}
                  className={`report-view-button ${learner.total_reports > 0 ? 'report-view-button-active' : 'report-view-button-inactive'}`}
                >
                  {learner.total_reports > 0 ? 'View Reports →' : 'View Details →'}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ReportCard;
