// ViewLearners.jsx - Admin view of all registered learners (read-only)

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  Users,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Pages.css';


// ViewLearners Component - Admin can view all learners (no edit capability)
const ViewLearners = () => {
  const { user: _user } = useAuth();

  // State management for learner data and filtering
  const [learners, setLearners] = useState([]);
  const [filteredLearners, setFilteredLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [visiblePasscodes, setVisiblePasscodes] = useState({});

  // Fetch learners data when component mounts
  useEffect(() => {
    fetchLearners();
  }, []);


  // Fetch all learners from the server
  const fetchLearners = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminService.getAllLearners();
      setLearners(data);
      setFilteredLearners(data);
    } catch (err) {
      console.error('Error fetching learners:', err);
      setError('Failed to load learners. Please try again.');
      toast.error('Failed to load learners');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters learners based on search query (triggered by Search button click)
   * 
   * @param {string} query - The search query from SearchBar component
   */
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === '') {
      setFilteredLearners(learners);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = learners.filter(learner =>
        learner.name.toLowerCase().includes(lowerQuery) ||
        learner.passcode.toLowerCase().includes(lowerQuery)
      );
      setFilteredLearners(filtered);
    }
  };

  /**
   * Toggle passcode visibility for a specific learner
   * @param {number} learnerId - The learner ID (profile ID)
   * @param {number} userId - The user ID
   */
  const togglePasscodeVisibility = (learnerId, userId) => {
    // Reveal/hide using admin reveal endpoint
    const currentlyVisible = !!visiblePasscodes[learnerId];
    if (currentlyVisible) {
      setVisiblePasscodes(prev => ({ ...prev, [learnerId]: false }));
      return;
    }

    (async () => {
      try {
        const resp = await adminService.revealPasscode(userId);
        setVisiblePasscodes(prev => ({ ...prev, [learnerId]: resp.passcode }));
      } catch (err) {
        console.error('Failed to reveal passcode for learner', learnerId, err);
        toast.error('Failed to reveal passcode', { position: 'top-center', autoClose: 3000 });
        setVisiblePasscodes(prev => ({ ...prev, [learnerId]: false }));
      }
    })();
  };

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">

            <h1 className="page-title">
              View HurshBin Learners
            </h1>
            <p className="page-description">View all registered learners in the system</p>
          </div>

          {/* Search Bar */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode..."
            />
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredLearners.length} result{filteredLearners.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <div className="error-message-content">
                <AlertCircle className="error-icon" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="loading-container">
              <Loader2 className="loading-spinner-icon" />
              <p className="loading-text">Loading learners...</p>
            </div>
          ) : (
            /* Table */
            <div className="data-table-container">
              {filteredLearners.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <p className="empty-state-title">
                    {activeSearchQuery ? 'No learners found' : 'No learners registered yet'}
                  </p>
                  <p className="empty-state-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'No learners have been registered in the system'
                    }
                  </p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead className="data-table-header">
                      <tr>
                        <th className="data-table-th">
                          Sr. No.
                        </th>
                        <th className="data-table-th">
                          Name
                        </th>
                        <th className="data-table-th">
                          Passcode
                        </th>
                        <th className="data-table-th">
                          Date of Assessment
                        </th>
                      </tr>
                    </thead>
                    <tbody className="data-table-body">
                      {filteredLearners.map((learner, index) => (
                        <tr
                          key={learner.id}
                          className="data-table-row"
                        >
                          <td className="data-table-td data-table-td-center">
                            {index + 1}
                          </td>
                          <td className="data-table-td">
                            <div className="data-table-name">{learner.name}</div>
                            <div className="data-table-subtext">{learner.role}</div>
                          </td>
                          <td className="data-table-td">
                            <div className="passcode-display-inline">
                              <span className="passcode-badge">
                                {visiblePasscodes[learner.id] ? visiblePasscodes[learner.id] : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeVisibility(learner.id, learner.user_id)}
                                className="icon-btn"
                                title={visiblePasscodes[learner.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[learner.id] ? (
                                  <EyeOff className="icon-sm" />
                                ) : (
                                  <Eye className="icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="data-table-td">
                            {learner.date_of_assessment
                              ? new Date(learner.date_of_assessment).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {!loading && filteredLearners.length > 0 && (
            <div className="page-summary">
              Showing {filteredLearners.length} of {learners.length} learner{learners.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ViewLearners;
