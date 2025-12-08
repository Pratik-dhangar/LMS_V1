import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import learningGoalsService from '../../api/services/learningGoalsService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Pages.css';

const ManageLearningGoals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [formData, setFormData] = useState({ goal: '', goal_description: '' });
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  useEffect(() => { fetchGoals(); }, []);

  const fetchGoals = async () => {
    try {
      const data = await learningGoalsService.admin.getAll();
      setGoals(data);
    } catch {
      toast.error('Failed to load learning goals');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.goal) return toast.error('Goal is required');
    try {
      await learningGoalsService.admin.create(formData);
      toast.success('Learning goal created!');
      setShowAddModal(false);
      setFormData({ goal: '', goal_description: '' });
      fetchGoals();
    } catch {
      toast.error('Failed to create learning goal');
    }
  };

  const handleEdit = (goal) => {
    setSelectedGoal(goal);
    setFormData({ goal: goal.goal, goal_description: goal.goal_description || '' });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await learningGoalsService.admin.update(selectedGoal.id, formData);
      toast.success('Goal updated!');
      setShowEditModal(false);
      fetchGoals();
    } catch {
      toast.error('Failed to update goal');
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await learningGoalsService.admin.delete(goalId);
      toast.success('Goal deleted!');
      fetchGoals();
    } catch {
      toast.error('Failed to delete goal');
    }
  };

  const handleSearch = (query) => {
    setActiveSearchQuery(query);
  };

  const filteredGoals = goals.filter(goal =>
    goal.goal.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
    (goal.goal_description && goal.goal_description.toLowerCase().includes(activeSearchQuery.toLowerCase()))
  );

  return (
    <div className="page-container">
      <Navbar />
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Manage Learning Goals</h1>
              <p className="page-description">Create and manage learning goals for sessions</p>
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
              className="btn-success"
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
                {activeSearchQuery ? 'No goals match your search' : 'No learning goals available. Add some goals to get started!'}
              </p>
            </div>
          ) : (
            <div className="data-table-container">
              {/* Desktop Table */}
              <div className="table-wrapper table-desktop">
                <table className="data-table">
                  <thead className="data-table-header">
                    <tr>
                      <th className="data-table-th">Sr. No.</th>
                      <th className="data-table-th">Title (Goal)</th>
                      <th className="data-table-th">Goal Description</th>
                      <th className="data-table-th data-table-th-center">Edit</th>
                      <th className="data-table-th data-table-th-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="data-table-body">
                    {filteredGoals.map((goal, index) => (
                      <tr key={goal.id} className="data-table-row">
                        <td className="data-table-td data-table-td-center">{index + 1}</td>
                        <td className="data-table-td">
                          <div className="data-table-name">{goal.goal}</div>
                          <div className="data-table-subtext">
                            Created: {new Date(goal.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="data-table-td">
                          <div className="data-table-description">
                            {goal.goal_description || <span className="data-table-empty">No description</span>}
                          </div>
                        </td>
                        <td className="data-table-td data-table-td-center">
                          <button
                            onClick={() => handleEdit(goal)}
                            className="btn-primary btn-sm btn-icon"
                          >
                            <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        </td>
                        <td className="data-table-td data-table-td-center">
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="btn-danger btn-sm btn-icon"
                          >
                            <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="mobile-cards">
                {filteredGoals.map((goal, index) => (
                  <div key={goal.id} className="mobile-card">
                    <div className="mobile-card-header">
                      <div className="mobile-card-badge">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="mobile-card-title">{goal.goal}</h3>
                        <p className="mobile-card-date">
                          {new Date(goal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {goal.goal_description && (
                      <p className="mobile-card-description">
                        {goal.goal_description}
                      </p>
                    )}

                    <div className="mobile-card-actions">
                      <button
                        onClick={() => handleEdit(goal)}
                        className="btn-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-sm">
            <h2 className="modal-title">Add Learning Goal</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-field">
                <label className="form-label">
                  Goal <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={e => setFormData({ ...formData, goal_description: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ goal: '', goal_description: '' });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
                >
                  Add Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-sm">
            <h2 className="modal-title">Edit Learning Goal</h2>
            <form onSubmit={handleUpdate}>
              <div className="form-field">
                <label className="form-label">
                  Goal <span className="form-required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">Description (optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={e => setFormData({ ...formData, goal_description: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormData({ goal: '', goal_description: '' });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
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
