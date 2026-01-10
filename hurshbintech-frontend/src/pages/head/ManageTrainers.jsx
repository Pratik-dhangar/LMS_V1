// ManageTrainers.jsx - view and manage all registered trainers

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Users, Edit3, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import headService from "../../api/services/headService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Pages.css";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";

// ManageTrainers Component
const ManageTrainers = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for trainer data and filtering
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [visiblePasscodes, setVisiblePasscodes] = useState({});
  const [revealedPasscodes, setRevealedPasscodes] = useState({}); // Store decrypted passcodes

  // Fetch trainers data when component mounts
  useEffect(() => {
    fetchTrainers();
  }, []);

  // Fetch all trainers from the server
  const fetchTrainers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await headService.getAllTrainers();
      setTrainers(data);
      setFilteredTrainers(data);
    } catch (err) {
      console.error("Error fetching trainers:", err);
      setError("Failed to load trainers. Please try again.");
      toast.error("Failed to load trainers", {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasscodeVisibility = async (trainerId, userId) => {
    // If already visible, just hide it
    if (visiblePasscodes[trainerId]) {
      setVisiblePasscodes((prev) => ({ ...prev, [trainerId]: false }));
      return;
    }

    // If not yet revealed, fetch from backend
    if (!revealedPasscodes[trainerId]) {
      try {
        const response = await headService.revealPasscode(userId);
        setRevealedPasscodes((prev) => ({
          ...prev,
          [trainerId]: response.passcode,
        }));
        setVisiblePasscodes((prev) => ({ ...prev, [trainerId]: true }));
      } catch (err) {
        console.error("Error revealing passcode:", err);
        toast.error("Failed to reveal passcode", {
          position: "top-center",
          autoClose: 3000,
        });
      }
    } else {
      // Already revealed, just toggle visibility
      setVisiblePasscodes((prev) => ({ ...prev, [trainerId]: true }));
    }
  };

  /**
   * Navigates to the edit page for a specific trainer
   *
   * @param {number} trainerId - The unique identifier of the trainer to edit
   */
  const handleEditTrainer = (trainerId) => {
    navigate(`/head/edit-trainer/${trainerId}`);
  };

  /**
   * Filters trainers based on search query (triggered by Search button click)
   *
   * @param {string} query - The search query from SearchBar component
   */
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === "") {
      setFilteredTrainers(trainers);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = trainers.filter(
        (trainer) =>
          trainer.name.toLowerCase().includes(lowerQuery) ||
          trainer.passcode.toLowerCase().includes(lowerQuery) ||
          (trainer.contact_no &&
            trainer.contact_no.toLowerCase().includes(lowerQuery))
      );
      setFilteredTrainers(filtered);
    }
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
              <h1 className="page-title">Manage HurshBin Trainers</h1>
              <p className="page-description">
                View and manage all registered trainers
              </p>
            </div>
          </div>

          {/* Search Bar and Add New Trainer Button */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by name, passcode, contact number..."
            />
            <button
              onClick={() => navigate("/head/register-trainer")}
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
              Add New Trainer
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredTrainers.length} result
                {filteredTrainers.length !== 1 ? "s" : ""}
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
              <p className="loading-text">Loading trainers...</p>
            </div>
          ) : (
            /* Table */
            <div className="table-primary-container">
              {filteredTrainers.length === 0 ? (
                <div className="table-primary-empty">
                  <Users className="table-primary-empty-icon" />
                  <p className="table-primary-empty-title">
                    {activeSearchQuery
                      ? "No trainers found"
                      : "No trainers registered yet"}
                  </p>
                  <p className="table-primary-empty-description">
                    {activeSearchQuery
                      ? "Try adjusting your search criteria"
                      : "Register your first trainer to get started"}
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate("/head/register-trainer")}
                      className="btn-success"
                    >
                      Register Trainer
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-primary-wrapper">
                  <table className="table-primary">
                    <thead className="table-primary-header">
                      <tr>
                        <th className="table-primary-th">Sr. No.</th>
                        <th className="table-primary-th">Name</th>
                        <th className="table-primary-th">Passcode</th>
                        <th className="table-primary-th">Contact Number</th>
                        <th className="table-primary-th">Date Joined</th>
                        <th className="table-primary-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="table-primary-body">
                      {filteredTrainers.map((trainer, index) => (
                        <tr key={trainer.id} className="table-primary-row">
                          <td className="table-primary-td table-primary-td-center">
                            {index + 1}
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            <div className="table-primary-cell-name-text">
                              {trainer.name}
                            </div>
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            <div className="manage-users-passcode-display">
                              <span className="table-primary-badge">
                                {visiblePasscodes[trainer.id]
                                  ? revealedPasscodes[trainer.id]
                                  : "••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  togglePasscodeVisibility(
                                    trainer.id,
                                    trainer.user_id
                                  )
                                }
                                className="manage-users-passcode-toggle-btn"
                                aria-label={
                                  visiblePasscodes[trainer.id]
                                    ? "Hide passcode"
                                    : "Show passcode"
                                }
                              >
                                {visiblePasscodes[trainer.id] ? (
                                  <EyeOff className="table-primary-icon-sm" />
                                ) : (
                                  <Eye className="table-primary-icon-sm" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            {trainer.contact_no || "N/A"}
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            {trainer.date_of_joining
                              ? new Date(
                                  trainer.date_of_joining
                                ).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="table-primary-td table-primary-td-center">
                            <button
                              onClick={() => handleEditTrainer(trainer.id)}
                              className="btn-primary btn-icon"
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
          {!loading && filteredTrainers.length > 0 && (
            <div className="page-summary">
              Showing {filteredTrainers.length} of {trainers.length} trainer
              {trainers.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageTrainers;
