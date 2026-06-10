import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import learningGoalsService from "../../api/services/learningGoalsService";
import learningSkillsService from "../../api/services/learningSkillsService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/components/common/Modal.css";
import "../../styles/Table.css";
import "../../styles/Subscription.css";
import "../../styles/admin/AdminManageLearningGoals.css";
import "../../styles/ManageUsersLayout.css";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 25];

const ManageLearningGoals = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [skills, setSkills] = useState([]);
  const [activeView, setActiveView] = useState("goals");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditSkillModal, setShowEditSkillModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [learningSkillName, setLearningSkillName] = useState("");
  const [editLearningSkillName, setEditLearningSkillName] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    goal: "",
    goal_description: "",
    delivery_instruction: "",
  });
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeView, activeSearchQuery, itemsPerPage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [goalsData, skillsData] = await Promise.all([
        learningGoalsService.admin.getAll(),
        learningSkillsService.admin.getAll(),
      ]);
      setGoals(goalsData || []);
      setSkills(skillsData || []);
    } catch (error) {
      console.error("Error fetching learning data:", error);
      toast.error("Failed to load learning data");
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const data = await learningGoalsService.admin.getAll();
      setGoals(data || []);
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast.error("Failed to refresh goals");
    }
  };

  const fetchSkills = async () => {
    try {
      const data = await learningSkillsService.admin.getAll();
      setSkills(data || []);
    } catch (error) {
      console.error("Error fetching skills:", error);
      toast.error("Failed to refresh skills");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.goal) return toast.error("Goal is required");
    try {
      await learningGoalsService.admin.create(formData);
      toast.success("Learning goal created!");
      setShowAddModal(false);
      setFormData({ goal: "", goal_description: "", delivery_instruction: "" });
      await fetchGoals();
    } catch {
      toast.error("Failed to create learning goal");
    }
  };

  const handleEdit = (goal) => {
    setSelectedGoal(goal);
    setFormData({
      goal: goal.goal,
      goal_description: goal.goal_description || "",
      delivery_instruction: goal.delivery_instruction || "",
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await learningGoalsService.admin.update(selectedGoal.id, formData);
      toast.success("Goal updated!");
      setShowEditModal(false);
      setFormData({ goal: "", goal_description: "", delivery_instruction: "" });
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
      await fetchGoals();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const handleSearch = (query) => {
    setActiveSearchQuery(query);
  };

  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    if (!learningSkillName.trim()) {
      toast.error("Skill name is required");
      return;
    }

    try {
      await learningSkillsService.admin.create({
        skill_name: learningSkillName.trim(),
      });
      toast.success("Learning skill created!");
      setShowAddSkillModal(false);
      setLearningSkillName("");
      await fetchSkills();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to create learning skill",
      );
    }
  };

  const handleSkillEdit = (skill) => {
    setSelectedSkill(skill);
    setEditLearningSkillName(skill.skill_name || "");
    setShowEditSkillModal(true);
  };

  const handleSkillUpdate = async (e) => {
    e.preventDefault();

    if (!editLearningSkillName.trim()) {
      toast.error("Skill name is required");
      return;
    }

    try {
      await learningSkillsService.admin.update(selectedSkill.id, {
        skill_name: editLearningSkillName.trim(),
      });
      toast.success("Learning skill updated!");
      setShowEditSkillModal(false);
      setSelectedSkill(null);
      setEditLearningSkillName("");
      await fetchSkills();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to update learning skill",
      );
    }
  };

  const handleSkillDelete = async (skillId) => {
    if (!window.confirm("Delete this learning skill?")) return;

    try {
      await learningSkillsService.admin.delete(skillId);
      toast.success("Learning skill deleted!");
      await fetchSkills();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to delete learning skill",
      );
    }
  };

  const filteredGoals = goals.filter(
    (goal) =>
      goal.goal.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      (goal.goal_description &&
        goal.goal_description
          .toLowerCase()
          .includes(activeSearchQuery.toLowerCase())),
  );

  const filteredSkills = skills.filter((skill) =>
    skill.skill_name?.toLowerCase().includes(activeSearchQuery.toLowerCase()),
  );

  const activeRecords = activeView === "goals" ? filteredGoals : filteredSkills;
  const totalPages = Math.max(
    1,
    Math.ceil(activeRecords.length / itemsPerPage),
  );
  const paginatedRecords = activeRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const renderPagination = () => {
    if (activeRecords.length === 0) {
      return null;
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, activeRecords.length);

    return (
      <div className="table-pagination-section">
        <div className="table-pagination-size-row">
          <label
            htmlFor="learning-goals-page-size"
            className="table-pagination-size-label"
          >
            Rows per page:
          </label>
          <select
            id="learning-goals-page-size"
            className="table-pagination-size-select"
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

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
              <h1 className="page-title">
                Manage Learning Goals and Learning Skill
              </h1>
              <p className="page-description">
                Create and manage learning goals and Learning Skill for sessions
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.85rem",
            }}
          >
            <span style={{ fontWeight: 700, color: "#1f2937" }}>
              Filter by :
            </span>
            <button
              onClick={() => setActiveView("goals")}
              className={`app-modal-btn ${
                activeView === "goals"
                  ? "app-modal-btn--primary"
                  : "app-modal-btn--secondary"
              }`}
            >
              Learning Goals
            </button>
            <button
              onClick={() => setActiveView("skills")}
              className={`app-modal-btn ${
                activeView === "skills"
                  ? "app-modal-btn--primary"
                  : "app-modal-btn--secondary"
              }`}
            >
              Learning Skill
            </button>
          </div>

          {/* Search Bar and Add Button */}
          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              placeholder={
                activeView === "goals"
                  ? "Search by goal or description..."
                  : "Search by skill name..."
              }
            />
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setShowAddModal(true)}
                className="app-modal-btn app-modal-btn--success"
              >
                + Add New Goal
              </button>
              <button
                onClick={() => setShowAddSkillModal(true)}
                className="app-modal-btn app-modal-btn--primary"
              >
                + Add Learning Skill
              </button>
            </div>
          </div>
          {activeSearchQuery && (
            <div className="search-results-info">
              <p className="search-results-text">
                {activeView === "goals"
                  ? `Found ${filteredGoals.length} of ${goals.length} goals`
                  : `Found ${filteredSkills.length} of ${skills.length} skills`}
              </p>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : activeView === "goals" && filteredGoals.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                {activeSearchQuery
                  ? "No goals match your search"
                  : "No learning goals available. Add some goals to get started!"}
              </p>
            </div>
          ) : activeView === "skills" && filteredSkills.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                {activeSearchQuery
                  ? "No skills match your search"
                  : "No learning skills available. Add some skills to get started!"}
              </p>
            </div>
          ) : (
            <div className="table-primary-container">
              {/* Desktop Table */}
              <div className="table-primary-wrapper table-desktop">
                <table className="table-primary">
                  <thead className="table-primary-header">
                    {activeView === "goals" ? (
                      <tr>
                        <th className="table-primary-th table-primary-th-center">
                          Sr. No.
                        </th>
                        <th className="table-primary-th">Title (Goal)</th>
                        <th className="table-primary-th">Goal Description</th>
                        <th className="table-primary-th">
                          Delivery Instructions
                        </th>
                        <th className="table-primary-th table-primary-th-center">
                          Edit
                        </th>
                        <th className="table-primary-th table-primary-th-center">
                          Delete
                        </th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="table-primary-th table-primary-th-center">
                          Sr. No.
                        </th>
                        <th className="table-primary-th">
                          Learning Skill Name
                        </th>
                        <th className="table-primary-th">Created At</th>
                        <th className="table-primary-th table-primary-th-center">
                          Edit
                        </th>
                        <th className="table-primary-th table-primary-th-center">
                          Delete
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="table-primary-body">
                    {activeView === "goals"
                      ? paginatedRecords.map((goal, index) => (
                          <tr key={goal.id} className="table-primary-row">
                            <td className="table-primary-td table-primary-td-center">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="table-primary-td">
                              <div className="table-primary-cell-name">
                                <div className="table-primary-cell-name-text">
                                  {goal.goal}
                                </div>
                                <div className="table-primary-cell-subtitle">
                                  Created:{" "}
                                  {new Date(
                                    goal.created_at,
                                  ).toLocaleDateString()}
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
                            <td className="table-primary-td">
                              <div className="data-table-description">
                                {goal.delivery_instruction || (
                                  <span className="data-table-empty">-</span>
                                )}
                              </div>
                            </td>
                            <td className="table-primary-td table-primary-td-center">
                              <button
                                onClick={() => handleEdit(goal)}
                                className="app-modal-btn app-modal-btn--primary btn-sm "
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
                                className="app-modal-btn app-modal-btn--danger btn-sm "
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
                        ))
                      : paginatedRecords.map((skill, index) => (
                          <tr key={skill.id} className="table-primary-row">
                            <td className="table-primary-td table-primary-td-center">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="table-primary-td">
                              <div className="table-primary-cell-name-text">
                                {skill.skill_name}
                              </div>
                            </td>
                            <td className="table-primary-td">
                              {skill.created_at
                                ? new Date(
                                    skill.created_at,
                                  ).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="table-primary-td table-primary-td-center">
                              <button
                                onClick={() => handleSkillEdit(skill)}
                                className="app-modal-btn app-modal-btn--primary btn-sm "
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
                                onClick={() => handleSkillDelete(skill.id)}
                                className="app-modal-btn app-modal-btn--danger btn-sm "
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
              {renderPagination()}
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
                  setFormData({
                    goal: "",
                    goal_description: "",
                    delivery_instruction: "",
                  });
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
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Delivery Instructions
                  </label>
                  <textarea
                    className="app-modal-form-textarea"
                    placeholder="Enter delivery instructions"
                    rows="4"
                    value={formData.delivery_instruction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delivery_instruction: e.target.value,
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
                    setFormData({
                      goal: "",
                      goal_description: "",
                      delivery_instruction: "",
                    });
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-modal-btn app-modal-btn--primary"
                >
                  Add Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Learning Skill Modal */}
      {showAddSkillModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Add Learning Skill</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddSkillModal(false);
                  setLearningSkillName("");
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSkillSubmit}>
              <div className="app-modal-content">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Skill Name <span className="form-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="app-modal-form-input"
                    placeholder="Enter learning skill"
                    value={learningSkillName}
                    onChange={(e) => setLearningSkillName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSkillModal(false);
                    setLearningSkillName("");
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-modal-btn app-modal-btn--primary"
                >
                  Add Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Learning Skill Modal */}
      {showEditSkillModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--md">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Edit Learning Skill</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditSkillModal(false);
                  setSelectedSkill(null);
                  setEditLearningSkillName("");
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSkillUpdate}>
              <div className="app-modal-content">
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">
                    Skill Name <span className="form-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="app-modal-form-input"
                    placeholder="Enter learning skill"
                    value={editLearningSkillName}
                    onChange={(e) => setEditLearningSkillName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSkillModal(false);
                    setSelectedSkill(null);
                    setEditLearningSkillName("");
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-modal-btn app-modal-btn--primary"
                >
                  Update Skill
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
                  setFormData({
                    goal: "",
                    goal_description: "",
                    delivery_instruction: "",
                  });
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
                <div className="app-modal-form-field">
                  <label className="app-modal-form-label">Delivery Instruction</label>
                  <textarea
                    className="app-modal-form-textarea"
                    placeholder="Enter delivery instruction"
                    rows="4"
                    value={formData.delivery_instruction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delivery_instruction: e.target.value,
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
                    setFormData({
                      goal: "",
                      goal_description: "",
                      delivery_instruction: "",
                    });
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="app-modal-btn app-modal-btn--primary"
                >
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
