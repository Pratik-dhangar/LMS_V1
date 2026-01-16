import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import learningGoalsService from "../../api/services/learningGoalsService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/components/common/Modal.css";
import "../../styles/Table.css";
import "../../styles/admin/AdminManageLearningGoals.css";
import "../../styles/ManageUsersLayout.css";

const ManageLearningGoals = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [formData, setFormData] = useState({
    goal: "",
    goal_description: "",
  });
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const data = await learningGoalsService.admin.getAll();
      setGoals(data);
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast.error("Failed to load goals");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.goal) return toast.error("Goal is required");
    try {
      await learningGoalsService.admin.create(formData);
      toast.success("Learning goal created!");
      setShowAddModal(false);
      setFormData({ goal: "", goal_description: "" });
      fetchGoals();
    } catch {
      toast.error("Failed to create learning goal");
    }
  };

  const handleEdit = (goal) => {
    setSelectedGoal(goal);
    setFormData({
      goal: goal.goal,
      goal_description: goal.goal_description || "",
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await learningGoalsService.admin.update(selectedGoal.id, formData);
      toast.success("Goal updated!");
      setShowEditModal(false);
      setFormData({ goal: "", goal_description: "" });
      setSelectedGoal(null);
      await fetchGoals();
    } catch {
      toast.error("Failed to update goal");
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm("Delete this goal?")) return;
    try {
      await learningGoalsService.admin.delete(goalId);
      toast.success("Goal deleted!");
      fetchGoals();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const handleSearch = (query) => {
    setActiveSearchQuery(query);
  };

  const filteredGoals = goals.filter(
    (goal) =>
      goal.goal.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      (goal.goal_description &&
        goal.goal_description
          .toLowerCase()
          .includes(activeSearchQuery.toLowerCase()))
  );

  return (
    <div className="page-container">
      <div className="page-main">
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
              <h1 className="page-title">Manage Learning Goals</h1>
              <p className="page-description">
                Create and manage learning goals for sessions
              </p>
            </div>
          </div>

          {/* Search Bar and Add Button */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search by goal or description..."
            />
            <button
              onClick={() => setShowAddModal(true)}
              className="app-modal-btn app-modal-btn--success"
            >
              + Add New Goal
            </button>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                Found {filteredGoals.length} of {goals.length} goals
              </p>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                {activeSearchQuery
                  ? "No goals match your search"
                  : "No learning goals available. Add some goals to get started!"}
              </p>
            </div>
          ) : (
            <div className="table-primary-container">
              {/* Desktop Table */}
              <div className="table-primary-wrapper table-desktop">
                <table className="table-primary">
                  <thead className="table-primary-header">
                    <tr>
                      <th className="table-primary-th table-primary-th-center">
                        Sr. No.
                      </th>
                      <th className="table-primary-th">Title (Goal)</th>
                      <th className="table-primary-th">Goal Description</th>
                      <th className="table-primary-th table-primary-th-center">
                        Edit
                      </th>
                      <th className="table-primary-th table-primary-th-center">
                        Delete
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-primary-body">
                    {filteredGoals.map((goal, index) => (
                      <tr key={goal.id} className="table-primary-row">
                        <td className="table-primary-td table-primary-td-center">
                          {index + 1}
                        </td>
                        <td className="table-primary-td">
                          <div className="table-primary-cell-name">
                            <div className="table-primary-cell-name-text">
                              {goal.goal}
                            </div>
                            <div className="table-primary-cell-subtitle">
                              Created:{" "}
                              {new Date(goal.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="table-primary-td">
                          <div className="data-table-description">
                            {goal.goal_description || (
                              <span className="data-table-empty">
                                No description
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-primary-td table-primary-td-center">
                          <button
                            onClick={() => handleEdit(goal)}
                            className="app-modal-btn app-modal-btn--primary btn-sm btn-icon"
                          >
                            <svg
                              className="table-primary-icon-sm"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </button>
                        </td>
                        <td className="table-primary-td table-primary-td-center">
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="app-modal-btn app-modal-btn--danger btn-sm btn-icon"
                          >
                            <svg
                              className="table-primary-icon-sm"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Add Learning Goal</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({ goal: "", goal_description: "" });
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="app-modal-content">
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">
                  Goal (Title) <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  className="app-modal-form-input"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={(e) =>
                    setFormData({ ...formData, goal: e.target.value })
                  }
                  required
                />
              </div>

              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Description</label>
                <textarea
                  className="app-modal-form-textarea"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      goal_description: e.target.value,
                    })
                  }
                />
              </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ goal: "", goal_description: "" });
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="app-modal-btn app-modal-btn--primary">
                  Add Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Edit Learning Goal</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setFormData({ goal: "", goal_description: "" });
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="app-modal-content">
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">
                  Goal (Title) <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  className="app-modal-form-input"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={(e) =>
                    setFormData({ ...formData, goal: e.target.value })
                  }
                  required
                />
              </div>

              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Description</label>
                <textarea
                  className="app-modal-form-textarea"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      goal_description: e.target.value,
                    })
                  }
                />
              </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormData({ goal: "", goal_description: "" });
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="app-modal-btn app-modal-btn--primary">
                  Update Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageLearningGoals;
