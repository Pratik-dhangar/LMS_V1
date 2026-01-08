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
import '../../styles/admin/ManageHeadsPage.css';


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
    <div className="manage-heads-container">
      <Navbar />
      <main className="manage-heads-main">
        <div className="manage-heads-content">
          {/* Header */}
          <div className="manage-heads-header">

            <h1 className="manage-heads-title">
              Manage HurshBin Heads
            </h1>
            <p className="manage-heads-description">View and manage all registered heads</p>
          </div>

          {/* Search Bar and Add New Head Button */}
          <div className="manage-heads-search-section">

            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact..."
            />
            <button
              onClick={() => navigate('/admin/register-head')}
              className="manage-heads-add-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Head
            </button>
          </div>
          {activeSearchQuery && (
            <div className="manage-heads-search-results-info">
              <p>
                Found {filteredHeads.length} result{filteredHeads.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="manage-heads-error-message">
              <AlertCircle className="manage-heads-error-icon" />
              <div className="manage-heads-error-content">
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="manage-heads-loading-container">
              <Loader2 className="manage-heads-loading-spinner" />
              <p className="manage-heads-loading-text">Loading heads...</p>
            </div>
          ) : (
            /* Table */
            <div className="manage-heads-table-container">
              {filteredHeads.length === 0 ? (
                <div className="manage-heads-empty-state">
                  <Users className="manage-heads-empty-state-icon" />
                  <p className="manage-heads-empty-state-title">
                    {activeSearchQuery ? 'No heads found' : 'No heads registered yet'}
                  </p>
                  <p className="manage-heads-empty-state-description">
                    {activeSearchQuery
                      ? 'Try adjusting your search criteria'
                      : 'Register your first head to get started'
                    }
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate('/admin/register-head')}
                      className="manage-heads-empty-state-btn"
                    >
                      Register Head
                    </button>
                  )}
                </div>
              ) : (
                <div className="manage-heads-table-wrapper">
                  <table className="manage-heads-table">
                    <thead className="manage-heads-table-header">
                      <tr>
                        <th className="manage-heads-table-th">
                          Sr. No.
                        </th>
                        <th className="manage-heads-table-th">
                          Name
                        </th>
                        <th className="manage-heads-table-th">
                          Passcode
                        </th>
                        <th className="manage-heads-table-th">
                          Contact Number
                        </th>
                        <th className="manage-heads-table-th">
                          Date Joined
                        </th>
                        <th className="manage-heads-table-th manage-heads-table-th-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="manage-heads-table-body">
                      {filteredHeads.map((head, index) => (
                        <tr
                          key={head.id}
                          className="manage-heads-table-row"
                        >
                          <td className="manage-heads-table-td manage-heads-table-td-center">
                            {index + 1}
                          </td>
                          <td className="manage-heads-table-td">
                            <div className="manage-heads-table-name">{head.name}</div>

                          </td>
                          <td className="manage-heads-table-td">
                            <div className="manage-heads-passcode-display">
                              <span className="manage-heads-passcode-badge">
                                {visiblePasscodes[head.id] ? visiblePasscodes[head.id] : '••••••'}
                              </span>
                              <button
                                onClick={() => togglePasscodeVisibility(head.id, head.user_id)}
                                className="manage-heads-passcode-toggle-btn"
                                title={visiblePasscodes[head.id] ? 'Hide passcode' : 'Show passcode'}
                              >
                                {visiblePasscodes[head.id] ? (
                                  <EyeOff className="manage-heads-icon-sm" />
                                ) : (
                                  <Eye className="manage-heads-icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="manage-heads-table-td">
                            {head.contact_no || 'N/A'}
                          </td>
                          <td className="manage-heads-table-td">
                            {head.date_of_joining
                              ? new Date(head.date_of_joining).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                          <td className="manage-heads-table-td">
                            <button
                              onClick={() => handleEditHead(head.id)}
                              className="manage-heads-edit-btn"
                            >
                              <Edit3 className="manage-heads-icon-sm" />
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
            <div className="manage-heads-page-summary">
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