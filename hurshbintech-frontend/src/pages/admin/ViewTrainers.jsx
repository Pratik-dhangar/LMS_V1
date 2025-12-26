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
import '../../styles/admin/AdminViewTrainers.css';


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
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">

            <h1 className="page-title">
              View HurshBin Trainers
            </h1>
            <p className="page-description">View all registered trainers in the system</p>
          </div>

          {/* Search Bar */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact number..."
            />
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredTrainers.length} result{filteredTrainers.length !== 1 ? 's' : ''}
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
              <p className="loading-text">Loading trainers...</p>
            </div>
          ) : (
            /* Table */
            <div className="data-table-container">
              {filteredTrainers.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <p className="empty-state-title">
                    {activeSearchQuery ? 'No trainers found' : 'No trainers registered yet'}
                  </p>
                  <p className="text-gray-500">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'No trainers have been registered in the system'
                    }
                  </p>
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="admin-table-th">
                        Sr. No.
                      </th>
                      <th className="admin-table-th">
                        Name
                      </th>
                      <th className="admin-table-th">
                        Passcode
                      </th>
                      <th className="admin-table-th">
                        Contact Number
                      </th>
                      <th className="admin-table-th">
                        Date Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrainers.map((trainer, index) => (
                      <tr key={trainer.id}>
                        <td className="admin-table-td admin-table-td-center">
                          {index + 1}
                        </td>
                        <td className="admin-table-td">
                          <div className="data-table-name">{trainer.name}</div>
                          <div className="data-table-subtext">{trainer.role}</div>
                        </td>
                        <td className="admin-table-td">
                          <div className="passcode-container">
                            <span className="passcode-badge">
                              {visiblePasscodes[trainer.id] ? visiblePasscodes[trainer.id] : '••••••'}
                            </span>
                            <button
                              onClick={() => togglePasscodeVisibility(trainer.id, trainer.user_id)}
                              className="passcode-toggle-btn"
                              title={visiblePasscodes[trainer.id] ? 'Hide passcode' : 'Show passcode'}
                            >
                              {visiblePasscodes[trainer.id] ? (
                                <EyeOff className="icon-sm" />
                              ) : (
                                <Eye className="icon-sm" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="admin-table-td">
                          {trainer.contact_no || 'N/A'}
                        </td>
                        <td className="admin-table-td">
                          {trainer.date_of_joining
                            ? new Date(trainer.date_of_joining).toLocaleDateString()
                            : 'N/A'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Summary */}
          {!loading && filteredTrainers.length > 0 && (
            <div className="page-summary">
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
