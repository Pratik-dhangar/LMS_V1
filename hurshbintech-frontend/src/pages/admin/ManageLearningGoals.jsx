import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import learningGoalsService from '../../api/services/learningGoalsService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SearchBar from '../../components/common/SearchBar';

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to update goal');
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      await learningGoalsService.admin.delete(goalId);
      toast.success('Goal deleted!');
      fetchGoals();
    } catch (error) {
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 bg-[#f5f6fa] p-8 m-6 min-h-screen md:p-4">
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b-[3px] border-[#2c3e50] md:flex-col md:gap-4 md:items-start">
            <div>
              <h1 className="text-[#2c3e50] text-[2rem] m-0 font-bold md:text-2xl">Manage Learning Goals</h1>
              <p className="text-gray-600 mt-2">Create and manage learning goals for sessions</p>
            </div>
          </div>

          {/* Search Bar and Add Button */}
          <div className="mb-6 flex justify-center items-center gap-4">
            <SearchBar 
              onSearch={handleSearch} 
              placeholder="Search by goal or description..." 
            />
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#27ae60] hover:bg-[#229954] text-white px-6 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all whitespace-nowrap"
            >
              + Add New Goal
            </button>
          </div>
          {activeSearchQuery && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Found {filteredGoals.length} of {goals.length} goals
              </p>
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-md">
              <p className="text-gray-500 text-lg">
                {activeSearchQuery ? 'No goals match your search' : 'No learning goals available. Add some goals to get started!'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-gray-300">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-[#34495e] text-white">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold border border-gray-400">Sr. No.</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold border border-gray-400">Title (Goal)</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold border border-gray-400">Goal Description</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold border border-gray-400">Edit</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold border border-gray-400">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredGoals.map((goal, index) => (
                      <tr key={goal.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium border border-gray-300">{index + 1}</td>
                        <td className="px-6 py-4 border border-gray-300">
                          <div className="text-sm font-semibold text-gray-900">{goal.goal}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Created: {new Date(goal.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 border border-gray-300">
                          <div className="text-sm text-gray-600 max-w-md">
                            {goal.goal_description || <span className="italic text-gray-400">No description</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center border border-gray-300">
                          <button
                            onClick={() => handleEdit(goal)}
                            className="inline-flex items-center px-4 py-2 bg-[#3498db] text-white rounded-lg hover:bg-[#2980b9] font-medium transition-colors text-sm shadow-md hover:shadow-lg"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center border border-gray-300">
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors text-sm shadow-md hover:shadow-lg"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="md:hidden divide-y divide-gray-200">
                {filteredGoals.map((goal, index) => (
                  <div key={goal.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white w-10 h-10 rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{goal.goal}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(goal.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {goal.goal_description && (
                      <p className="text-sm text-gray-600 mb-3 pl-13">
                        {goal.goal_description}
                      </p>
                    )}
                    
                    <div className="flex space-x-2 pl-13">
                      <button
                        onClick={() => handleEdit(goal)}
                        className="flex-1 bg-[#3498db] text-white py-2 rounded-lg hover:bg-[#2980b9] font-medium transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(goal.id)}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-medium transition-colors text-sm"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 mx-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Add Learning Goal</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Goal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value })}
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700">Description (optional)</label>
                <textarea
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={e => setFormData({ ...formData, goal_description: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ goal: '', goal_description: '' });
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-3 rounded-lg hover:opacity-90 font-medium shadow-lg transition-all"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md my-8 mx-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Edit Learning Goal</h2>
            <form onSubmit={handleUpdate}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Goal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter goal title"
                  value={formData.goal}
                  onChange={e => setFormData({ ...formData, goal: e.target.value })}
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-gray-700">Description (optional)</label>
                <textarea
                  className="w-full border-2 border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter goal description"
                  rows="4"
                  value={formData.goal_description}
                  onChange={e => setFormData({ ...formData, goal_description: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormData({ goal: '', goal_description: '' });
                  }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-3 rounded-lg hover:opacity-90 font-medium shadow-lg transition-all"
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
