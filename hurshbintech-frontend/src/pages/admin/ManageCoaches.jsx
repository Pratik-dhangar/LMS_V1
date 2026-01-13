// ViewConsultants.jsx - Admin view of all registered consultants/coaches

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Users, Edit3, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import adminService from "../../api/services/adminService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";

// ViewConsultants Component - Admin can view, add and edit coaches
const ViewConsultants = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for consultant data and filtering
  const [consultants, setConsultants] = useState([]);
  const [filteredConsultants, setFilteredConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [visiblePasscodes, setVisiblePasscodes] = useState({});

  // Fetch consultants data when component mounts
  useEffect(() => {
    fetchConsultants();
  }, []);

  // Fetch all consultants from the server
  const fetchConsultants = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminService.getAllConsultants();
      setConsultants(data);
      setFilteredConsultants(data);
    } catch (err) {
      console.error("Error fetching consultants:", err);
      setError("Failed to load consultants. Please try again.");
      toast.error("Failed to load consultants");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters consultants based on search query (triggered by Search button click)
   *
   * @param {string} query - The search query from SearchBar component
   */
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === "") {
      setFilteredConsultants(consultants);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = consultants.filter(
        (consultant) =>
          consultant.name.toLowerCase().includes(lowerQuery) ||
          consultant.passcode.toLowerCase().includes(lowerQuery) ||
          (consultant.contact_no &&
            consultant.contact_no.toLowerCase().includes(lowerQuery))
      );
      setFilteredConsultants(filtered);
    }
  };

  /**
   * Toggle passcode visibility for a specific consultant
   * @param {number} consultantId - The consultant ID (profile ID)
   * @param {number} userId - The user ID
   */
  const togglePasscodeVisibility = async (consultantId, userId) => {
    const currentlyVisible = !!visiblePasscodes[consultantId];
    if (currentlyVisible) {
      setVisiblePasscodes((prev) => ({ ...prev, [consultantId]: false }));
      return;
    }

    try {
      const resp = await adminService.revealPasscode(userId);
      setVisiblePasscodes((prev) => ({
        ...prev,
        [consultantId]: resp.passcode,
      }));
    } catch (err) {
      console.error(
        "Failed to reveal passcode for consultant",
        consultantId,
        err
      );
      toast.error("Failed to reveal passcode");
      setVisiblePasscodes((prev) => ({ ...prev, [consultantId]: false }));
    }
  };

  /**
   * Navigate to edit coach page
   * @param {number} coachId - The coach ID to edit
   */
  const handleEditCoach = (coachId) => {
    navigate(`/admin/edit-coach/${coachId}`);
  };

  return (
    <div className="page-container">
      <Navbar />
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
              <h1 className="page-title">Manage HurshBin Coaches</h1>
              <p className="page-description">
                View and manage all registered coaches/consultants in the system
              </p>
            </div>
          </div>

          {/* Search Bar and Add New Coach Button */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact number..."
            />
            <button
              onClick={() => navigate("/admin/register-coach")}
              className="btn-success"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="icon-sm"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add New Coach
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredConsultants.length} result
                {filteredConsultants.length !== 1 ? "s" : ""}
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
              <p className="loading-text">Loading coaches...</p>
            </div>
          ) : (
            /* Table */
            <div className="table-primary-container">
              {filteredConsultants.length === 0 ? (
                <div className="table-primary-empty">
                  <Users className="table-primary-empty-icon" />
                  <h3 className="table-primary-empty-title">
                    {activeSearchQuery
                      ? "No coaches found"
                      : "No coaches registered yet"}
                  </h3>
                  <p className="table-primary-empty-description">
                    {activeSearchQuery
                      ? "Try adjusting your search criteria"
                      : "Register your first coach to get started"}
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate("/admin/register-coach")}
                      className="btn-success"
                    >
                      Register Coach
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-primary-wrapper">
                  <table className="table-primary">
                    <thead className="table-primary-header">
                      <tr>
                        <th className="table-primary-th table-primary-th-center">
                          Sr. No.
                        </th>
                        <th className="table-primary-th">Name</th>
                        <th className="table-primary-th">Passcode</th>
                        <th className="table-primary-th">Contact Number</th>
                        <th className="table-primary-th">Date Joined</th>
                        <th className="table-primary-th table-primary-th-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="table-primary-body">
                      {filteredConsultants.map((consultant, index) => (
                        <tr key={consultant.id} className="table-primary-row">
                          <td className="table-primary-td table-primary-td-center">
                            {index + 1}
                          </td>
                          <td className="table-primary-td">
                            <div className="table-primary-cell-name-text">
                              {consultant.name}
                            </div>
                          </td>
                          <td className="table-primary-td">
                            <div className="passcode-display-inline">
                              <span className="table-primary-badge">
                                {visiblePasscodes[consultant.id]
                                  ? visiblePasscodes[consultant.id]
                                  : "••••••"}
                              </span>
                              <button
                                onClick={() =>
                                  togglePasscodeVisibility(
                                    consultant.id,
                                    consultant.user_id
                                  )
                                }
                                className="table-primary-icon-btn"
                                title={
                                  visiblePasscodes[consultant.id]
                                    ? "Hide passcode"
                                    : "Show passcode"
                                }
                              >
                                {visiblePasscodes[consultant.id] ? (
                                  <EyeOff className="table-primary-icon-sm" />
                                ) : (
                                  <Eye className="table-primary-icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="table-primary-td">
                            {consultant.contact_no || "N/A"}
                          </td>
                          <td className="table-primary-td">
                            {consultant.date_of_joining
                              ? new Date(
                                  consultant.date_of_joining
                                ).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            <button
                              onClick={() => handleEditCoach(consultant.id)}
                              className="btn-primary btn-sm btn-icon"
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
          {!loading && filteredConsultants.length > 0 && (
            <div className="page-summary">
              Showing {filteredConsultants.length} of {consultants.length} coach
              {consultants.length !== 1 ? "es" : ""}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ViewConsultants;
