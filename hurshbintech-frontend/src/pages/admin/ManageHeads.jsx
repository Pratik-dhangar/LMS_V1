// ManageHeads.jsx - view and manage all registered heads

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Users,
  Edit3,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SearchBar from '../../components/common/SearchBar';
import adminService from '../../api/services/adminService';
import '../../styles/admin/index.css';


// ManageHeads Component
const ManageHeads = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for head data and filtering
  const [heads, setHeads] = useState([]);
  const [filteredHeads, setFilteredHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [visiblePasscodes, setVisiblePasscodes] = useState({});
  const [error, setError] = useState('');

  // Fetch heads data when component mounts
  useEffect(() => {
    fetchHeads();
  }, []);

  // Handle search functionality
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === '') {
      setFilteredHeads(heads);
    } else {
      const searchLower = query.toLowerCase();
      const filtered = heads.filter(head =>
        head.name.toLowerCase().includes(searchLower) ||
        head.passcode.toLowerCase().includes(searchLower) ||
        (head.contact_no && head.contact_no.toLowerCase().includes(searchLower))
      );
      setFilteredHeads(filtered);
    }
  };


  const fetchHeads = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminService.getAllHeads();
      setHeads(data);
      setFilteredHeads(data);
    } catch (err) {
      console.error('Error fetching heads:', err);
      setError('Failed to load heads. Please try again.');
      toast.error('Failed to load heads', {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigates to the edit page for a specific head
   * 
   * @param {number} headId - The unique identifier of the head to edit
   */
  const handleEditHead = (headId) => {
    navigate(`/admin/edit-head/${headId}`);
  };

  /**
   * Toggle password visibility for a specific head
   * 
   * @param {number} headId - The unique identifier of the head (profile ID)
   * @param {number} userId - The user ID associated with the head
   */
  const togglePasscodeVisibility = async (headId, userId) => {
    const currentlyVisible = !!visiblePasscodes[headId];
    if (currentlyVisible) {
      // Hide the passcode
      setVisiblePasscodes(prev => ({ ...prev, [headId]: false }));
      return;
    }

    // Reveal: call admin reveal endpoint and cache the decrypted passcode
    try {
      const resp = await adminService.revealPasscode(userId);
      setVisiblePasscodes(prev => ({ ...prev, [headId]: resp.passcode }));
    } catch (err) {
      console.error('Failed to reveal passcode for head', headId, err);
      toast.error('Failed to reveal passcode', { position: 'top-center', autoClose: 3000 });
      setVisiblePasscodes(prev => ({ ...prev, [headId]: false }));
    }
  };

  return (
    <div className="page-container">
      <Navbar />
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">

            <h1 className="page-title">
              Manage HurshBin Heads
            </h1>
            <p className="page-description">View and manage all registered heads</p>
          </div>

          {/* Search Bar and Add New Head Button */}
          <div className="search-section">

            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact..."
            />
            <button
              onClick={() => navigate('/admin/register-head')}
              className="btn-success btn-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Head
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredHeads.length} result{filteredHeads.length !== 1 ? 's' : ''}
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
              <p className="loading-text">Loading heads...</p>
            </div>
          ) : (
            /* Table */
            <div className="data-table-container">
              {filteredHeads.length === 0 ? (
                <div className="empty-state">
                  <Users className="empty-state-icon" />
                  <p className="empty-state-title">
                    {activeSearchQuery ? 'No heads found' : 'No heads registered yet'}
                  </p>
                  <p className="empty-state-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'Register your first head to get started'
                    }
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate('/admin/register-head')}
                      className="btn-success"
                    >
                      Register Head
                    </button>
                  )}
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
                          Contact Number
                        </th>
                        <th className="data-table-th">
                          Date Joined
                        </th>
                        <th className="data-table-th data-table-th-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="data-table-body">
                      {filteredHeads.map((head, index) => (
                        <tr
                          key={head.id}
                          className="data-table-row"
                        >
                          <td className="data-table-td data-table-td-center">
                            {index + 1}
                          </td>
                          <td className="data-table-td">
                            <div className="data-table-name">{head.name}</div>

                          </td>
                          <td className="data-table-td">
                            <div className="passcode-display-inline">
                              <span className="passcode-badge">
                                {visiblePasscodes[head.id] ? visiblePasscodes[head.id] : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeVisibility(head.id, head.user_id)}
                                className="icon-btn"
                                title={visiblePasscodes[head.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[head.id] ? (
                                  <EyeOff className="icon-sm" />
                                ) : (
                                  <Eye className="icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="data-table-td">
                            {head.contact_no || 'N/A'}
                          </td>
                          <td className="data-table-td">
                            {head.date_of_joining
                              ? new Date(head.date_of_joining).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                          <td className="data-table-td">
                            <button
                              onClick={() => handleEditHead(head.id)}
                              className="btn-primary btn-sm btn-icon"
                            >
                              <Edit3 className="icon-sm" />
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
          {!loading && filteredHeads.length > 0 && (
            <div className="page-summary">
              Showing {filteredHeads.length} of {heads.length} head{heads.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageHeads;