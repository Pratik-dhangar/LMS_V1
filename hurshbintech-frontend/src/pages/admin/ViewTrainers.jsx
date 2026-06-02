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
import adminService from '../../api/services/adminService';
import SearchBar from '../../components/common/SearchBar';
import { useNavigate } from 'react-router-dom';
import '../../styles/Table.css';
import '../../styles/ManageUsersLayout.css';


// ViewTrainers Component - Admin can view all trainers (no edit capability)
const ViewTrainers = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for trainer data and filtering
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [selectedHeadFilter, setSelectedHeadFilter] = useState('');
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
  const handleSearch = (query, headFilter = selectedHeadFilter) => {
    setActiveSearchQuery(query);
    
    let filtered = trainers;
    
    // Apply search query filter
    if (query.trim() !== '') {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(trainer =>
        trainer.name.toLowerCase().includes(lowerQuery) ||
        trainer.passcode.toLowerCase().includes(lowerQuery) ||
        (trainer.contact_number && trainer.contact_number.toLowerCase().includes(lowerQuery)) ||
        (trainer.created_by_head_name && trainer.created_by_head_name.toLowerCase().includes(lowerQuery))
      );
    }
    
    // Apply head filter
    if (headFilter !== '') {
      filtered = filtered.filter(trainer => 
        trainer.created_by_head_name === headFilter
      );
    }
    
    setFilteredTrainers(filtered);
  };

  const handleHeadFilterChange = (e) => {
    const value = e.target.value;
    setSelectedHeadFilter(value);
    handleSearch(activeSearchQuery, value);
  };

  // Get unique head names for the filter dropdown
  const uniqueHeads = [...new Set(trainers
    .map(t => t.created_by_head_name)
    .filter(name => name)
  )].sort();

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
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="back-button"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>

            <div>
              <h1 className="page-title">
                View HurshBin Trainers
              </h1>
              <p className="page-description">View all registered trainers in the system</p>
            </div>
          </div>

          {/* Search Bar & Filters */}
          <div className="search-section" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <SearchBar
                onSearch={(query) => handleSearch(query, selectedHeadFilter)}
                placeholder="Search by name, passcode, contact number..."
              />
            </div>
            
            {uniqueHeads.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>Filter by Head:</span>
                <select
                  value={selectedHeadFilter}
                  onChange={handleHeadFilterChange}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  <option value="">All Heads</option>
                  {uniqueHeads.map(head => (
                    <option key={head} value={head}>
                      {head}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p>
                Found {filteredTrainers.length} result{filteredTrainers.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="view-users-error-message">
              <div className="view-users-error-content">
                <AlertCircle className="view-users-error-icon" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="view-users-loading-container">
              <Loader2 className="view-users-loading-spinner" />
              <p className="view-users-loading-text">Loading trainers...</p>
            </div>
          ) : (
            /* Table */
            <div className="table-primary-container">
              {filteredTrainers.length === 0 ? (
                <div className="table-primary-empty">
                  <Users className="table-primary-empty-icon" />
                  <h3 className="table-primary-empty-title">
                    {activeSearchQuery ? 'No trainers found' : 'No trainers registered yet'}
                  </h3>
                  <p className="table-primary-empty-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'No trainers have been registered in the system'
                    }
                  </p>
                </div>
              ) : (
                <div className="table-primary-wrapper">
                  <table className="table-primary">
                    <thead className="table-primary-header">
                      <tr>
                        <th className="table-primary-th table-primary-th-center">
                          Sr. No.
                        </th>
                        <th className="table-primary-th">
                          Name
                        </th>
                        <th className="table-primary-th">
                          Created By Head
                        </th>
                        <th className="table-primary-th">
                          Passcode
                        </th>
                        <th className="table-primary-th">
                          Contact Number
                        </th>
                        <th className="table-primary-th">
                          Date Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="table-primary-body">
                      {filteredTrainers.map((trainer, index) => (
                        <tr key={trainer.id} className="table-primary-row">
                          <td className="table-primary-td table-primary-td-center">
                            {index + 1}
                          </td>
                          <td className="table-primary-td">
                            <div className="table-primary-cell-name">
                              <div className="table-primary-cell-name-text">{trainer.name}</div>
                              <div className="table-primary-cell-subtitle">{trainer.role}</div>
                            </div>
                          </td>
                          <td className="table-primary-td">
                            {trainer.created_by_head_name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>N/A</span>}
                          </td>
                          <td className="table-primary-td">
                            <div className="passcode-display-inline">
                              <span className="table-primary-badge">
                                {visiblePasscodes[trainer.id] ? visiblePasscodes[trainer.id] : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeVisibility(trainer.id, trainer.user_id)}
                                className="table-primary-icon-btn"
                                title={visiblePasscodes[trainer.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[trainer.id] ? (
                                  <EyeOff className="table-primary-icon-sm" />
                                ) : (
                                  <Eye className="table-primary-icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="table-primary-td">
                            {trainer.contact_number || 'N/A'}
                          </td>
                          <td className="table-primary-td">
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
            <div className="page-summary">
              Showing {filteredTrainers.length} of {trainers.length} trainer{trainers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ViewTrainers;
