// ManageLearners.jsx - view and manage all registered learners

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Users,
  Edit3,
  AlertCircle,
  Loader2
  , Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import headService from '../../api/services/headService';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Table.css';
import '../../styles/ManageUsersLayout.css';


// Manage Learners Component
const ManageLearners = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for learner data and filtering
  const [learners, setLearners] = useState([]);
  const [filteredLearners, setFilteredLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [visiblePasscodes, setVisiblePasscodes] = useState({});
  const [revealedPasscodes, setRevealedPasscodes] = useState({}); // Store decrypted passcodes

  // Fetch learners data when component mounts
  useEffect(() => {
    fetchLearners();
  }, []);


  // Fetch all learners from the server
  const fetchLearners = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await headService.getAllLearners();
      setLearners(data);
      setFilteredLearners(data);
    } catch (err) {
      console.error('Error fetching learners:', err);
      setError('Failed to load learners. Please try again.');
      toast.error('Failed to load learners', {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasscodeVisibility = async (learnerId, userId) => {
    // If already visible, just hide it
    if (visiblePasscodes[learnerId]) {
      setVisiblePasscodes(prev => ({ ...prev, [learnerId]: false }));
      return;
    }

    // If not yet revealed, fetch from backend
    if (!revealedPasscodes[learnerId]) {
      try {
        const response = await headService.revealPasscode(userId);
        setRevealedPasscodes(prev => ({ ...prev, [learnerId]: response.passcode }));
        setVisiblePasscodes(prev => ({ ...prev, [learnerId]: true }));
      } catch (err) {
        console.error('Error revealing passcode:', err);
        toast.error('Failed to reveal passcode', {
          position: "top-center",
          autoClose: 3000,
        });
      }
    } else {
      // Already revealed, just toggle visibility
      setVisiblePasscodes(prev => ({ ...prev, [learnerId]: true }));
    }
  };

  /**
   * Navigates to the edit page for a specific learner
   * 
   * @param {number} learnerId - The unique identifier of the learner to edit
   */
  const handleEditLearner = (learnerId) => {
    navigate(`/head/edit-learner/${learnerId}`);
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

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/admin/dashboard")}
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
              <h1 className="page-title">
                Manage HurshBin Learners
              </h1>
              <p className="page-description">View and manage all registered learners</p>
            </div>
          </div>

          {/* Search Bar and Add New Learner Button */}
          <div className="search-section">

            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode..."
            />
            <button
              onClick={() => navigate('/head/register-learner')}
              className="app-modal-btn app-modal-btn--success"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Learner
            </button>
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
                <AlertCircle className="icon-md error-icon" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="loading-container">
              <Loader2 className="loading-spinner" />
              <p className="loading-text">Loading learners...</p>
            </div>
          ) : (
            /* Table */
            <div className="table-primary-container">
              {filteredLearners.length === 0 ? (
                <div className="table-primary-empty">
                  <Users className="table-primary-empty-icon" />
                  <p className="table-primary-empty-title">
                    {activeSearchQuery ? 'No learners found' : 'No learners registered yet'}
                  </p>
                  <p className="table-primary-empty-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'Register your first learner to get started'
                    }
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate('/head/register-learner')}
                      className="app-modal-btn app-modal-btn--success"
                    >
                      Register Learner
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-primary-wrapper">
                  <table className="table-primary">
                    <thead className="table-primary-header">
                      <tr>
                        <th className="table-primary-th">
                          Sr. No.
                        </th>
                        <th className="table-primary-th">
                          Name
                        </th>
                        <th className="table-primary-th">
                          Passcode
                        </th>
                        <th className="table-primary-th">
                          Date of Assessment
                        </th>
                        <th className="table-primary-th">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="table-primary-body">
                      {filteredLearners.map((learner, index) => (
                        <tr
                          key={learner.id}
                          className="table-primary-row"
                        >
                          <td className="table-primary-td">
                            {index + 1}
                          </td>
                          <td className="table-primary-td">
                            <div className="table-primary-cell-name-text">{learner.name}</div>
                            <div className="table-primary-cell-subtitle">{learner.role}</div>
                          </td>
                          <td className="table-primary-td">
                            <div className="manage-users-passcode-display">
                              <span className="table-primary-badge">
                                {visiblePasscodes[learner.id]
                                  ? revealedPasscodes[learner.id]
                                  : '••••••'
                                }
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasscodeVisibility(learner.id, learner.user_id)}
                                className="manage-users-passcode-toggle-btn"
                                aria-label={visiblePasscodes[learner.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[learner.id] ? <EyeOff className="table-primary-icon-sm" /> : <Eye className="table-primary-icon-sm" />}
                              </button>
                            </div>
                          </td>
                          <td className="table-primary-td">
                            {learner.date_of_assessment
                              ? new Date(learner.date_of_assessment).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            <button
                              onClick={() => handleEditLearner(learner.id)}
                              className="app-modal-btn app-modal-btn--primary"
                            >
                              <Edit3 className="table-primary-icon-sm" />
                              Edit Profile
                            </button>
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
    </div>
  );
};

export default ManageLearners;
