// ViewTrainers.jsx - Admin view of all registered trainers (read-only)

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
import '../../styles/admin/ViewTrainersPage.css';


// ViewTrainers Component - Admin can view all trainers (no edit capability)
const ViewTrainers = () => {
  const { user: _user } = useAuth();

  // State management for trainer data and filtering
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [visiblePasscodes, setVisiblePasscodes] = useState({});

  // Fetch trainers data when component mounts
  useEffect(() => {
    fetchTrainers();
  }, []);


  // Fetch all trainers from the server
  const fetchTrainers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminService.getAllTrainers();
      setTrainers(data);
      setFilteredTrainers(data);
    } catch (err) {
      console.error('Error fetching trainers:', err);
      setError('Failed to load trainers. Please try again.');
      toast.error('Failed to load trainers');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters trainers based on search query (triggered by Search button click)
   * 
   * @param {string} query - The search query from SearchBar component
   */
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === '') {
      setFilteredTrainers(trainers);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = trainers.filter(trainer =>
        trainer.name.toLowerCase().includes(lowerQuery) ||
        trainer.passcode.toLowerCase().includes(lowerQuery) ||
        (trainer.contact_no && trainer.contact_no.toLowerCase().includes(lowerQuery))
      );
      setFilteredTrainers(filtered);
    }
  };

  /**
   * Toggle passcode visibility for a specific trainer
   * @param {number} trainerId - The trainer ID (profile ID)
   * @param {number} userId - The user ID
   */
  const togglePasscodeVisibility = (trainerId, userId) => {
    // Reveal/hide using admin reveal endpoint
    const currentlyVisible = !!visiblePasscodes[trainerId];
    if (currentlyVisible) {
      setVisiblePasscodes(prev => ({ ...prev, [trainerId]: false }));
      return;
    }

    (async () => {
      try {
        const resp = await adminService.revealPasscode(userId);
        setVisiblePasscodes(prev => ({ ...prev, [trainerId]: resp.passcode }));
      } catch (err) {
        console.error('Failed to reveal passcode for trainer', trainerId, err);
        toast.error('Failed to reveal passcode', { position: 'top-center', autoClose: 3000 });
        setVisiblePasscodes(prev => ({ ...prev, [trainerId]: false }));
      }
    })();
  };

  return (
    <div className="view-trainers-container">
      <Navbar />
      <main className="view-trainers-main">
        <div className="view-trainers-content">
          {/* Header */}
          <div className="view-trainers-header">
            <h1 className="view-trainers-title">
              View HurshBin Trainers
            </h1>
            <p className="view-trainers-description">View all registered trainers in the system</p>
          </div>

          {/* Search Bar */}
          <div className="view-trainers-search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact number..."
            />
          </div>
          {activeSearchQuery && (
            <div className="view-trainers-search-results-info">
              <p>
                Found {filteredTrainers.length} result{filteredTrainers.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="view-trainers-error-message">
              <div className="view-trainers-error-content">
                <AlertCircle className="view-trainers-error-icon" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="view-trainers-loading-container">
              <Loader2 className="view-trainers-loading-spinner" />
              <p className="view-trainers-loading-text">Loading trainers...</p>
            </div>
          ) : (
            /* Table */
            <div className="view-trainers-table-container">
              {filteredTrainers.length === 0 ? (
                <div className="view-trainers-empty-state">
                  <Users className="view-trainers-empty-state-icon" />
                  <p className="view-trainers-empty-state-title">
                    {activeSearchQuery ? 'No trainers found' : 'No trainers registered yet'}
                  </p>
                  <p className="view-trainers-empty-state-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'No trainers have been registered in the system'
                    }
                  </p>
                </div>
              ) : (
                <div className="view-trainers-table-wrapper">
                  <table className="view-trainers-table">
                    <thead className="view-trainers-table-header">
                      <tr>
                        <th className="view-trainers-table-th view-trainers-table-th-center">
                          Sr. No.
                        </th>
                        <th className="view-trainers-table-th">
                          Name
                        </th>
                        <th className="view-trainers-table-th">
                          Passcode
                        </th>
                        <th className="view-trainers-table-th">
                          Contact Number
                        </th>
                        <th className="view-trainers-table-th">
                          Date Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="view-trainers-table-body">
                      {filteredTrainers.map((trainer, index) => (
                        <tr key={trainer.id} className="view-trainers-table-row">
                          <td className="view-trainers-table-td view-trainers-table-td-center">
                            {index + 1}
                          </td>
                          <td className="view-trainers-table-td">
                            <div className="view-trainers-trainer-name">
                              <div className="view-trainers-trainer-name-text">{trainer.name}</div>
                              <div className="view-trainers-trainer-role">{trainer.role}</div>
                            </div>
                          </td>
                          <td className="view-trainers-table-td">
                            <div className="view-trainers-passcode-display">
                              <span className="view-trainers-passcode-badge">
                                {visiblePasscodes[trainer.id] ? visiblePasscodes[trainer.id] : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeVisibility(trainer.id, trainer.user_id)}
                                className="view-trainers-passcode-toggle-btn"
                                title={visiblePasscodes[trainer.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[trainer.id] ? (
                                  <EyeOff className="view-trainers-icon-sm" />
                                ) : (
                                  <Eye className="view-trainers-icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="view-trainers-table-td">
                            {trainer.contact_no || 'N/A'}
                          </td>
                          <td className="view-trainers-table-td">
                            {trainer.date_of_joining
                              ? new Date(trainer.date_of_joining).toLocaleDateString()
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
          {!loading && filteredTrainers.length > 0 && (
            <div className="view-trainers-page-summary">
              Showing {filteredTrainers.length} of {trainers.length} trainer{trainers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ViewTrainers;
