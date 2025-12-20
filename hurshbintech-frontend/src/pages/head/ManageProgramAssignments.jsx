import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import programAssignmentService from '../../api/services/programAssignmentService';
import headService from '../../api/services/headService';
import learningProgramsService from '../../api/services/learningProgramsService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/Pages.css';

const ManageProgramAssignments = () => {
  const [learners, setLearners] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [overview, setOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showContentsPreviewModal, setShowContentsPreviewModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [completionStats, setCompletionStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'assignments'

  const [filterLearner, setFilterLearner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchLearner, setSearchLearner] = useState('');
  const [searchProgram, setSearchProgram] = useState('');

  const [formData, setFormData] = useState({
    learner_ids: [],
    program_ids: [],  // Changed from program_id to program_ids array
    start_date: '',
    end_date: '',
    duration_days: '',
    head_notes: '',
    manual_duration: false,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (filterLearner || filterStatus) {
      fetchAssignments();
    }
  }, [filterLearner, filterStatus]);

  // Filter learners based on search term
  const filteredLearners = learners.filter(learner =>
    learner.name.toLowerCase().includes(searchLearner.toLowerCase())
  );

  // Filter programs based on search term
  const filteredPrograms = programs.filter(program =>
    program.goal.toLowerCase().includes(searchProgram.toLowerCase()) ||
    (program.goal_description && program.goal_description.toLowerCase().includes(searchProgram.toLowerCase()))
  );

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [learnersData, programsData, assignmentsData, overviewData] = await Promise.all([
        headService.getAllLearners(),
        learningProgramsService.getAllPrograms(),
        programAssignmentService.getAssignments(),
        programAssignmentService.getAssignmentsOverview(),
      ]);

      setLearners(learnersData);
      setPrograms(programsData);
      setAssignments(assignmentsData);
      setOverview(overviewData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const filters = {};
      if (filterLearner) filters.learner_id = parseInt(filterLearner);
      if (filterStatus) filters.status = filterStatus;

      const data = await programAssignmentService.getAssignments(filters);
      setAssignments(data);
    } catch (error) {
      toast.error('Failed to load assignments');
    }
  };

  const calculateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : '';
  };

  const handleDateChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-calculate duration if not manual mode
    if (!formData.manual_duration && newFormData.start_date && newFormData.end_date) {
      const duration = calculateDuration(newFormData.start_date, newFormData.end_date);
      newFormData.duration_days = duration;
    }

    setFormData(newFormData);
  };

  const handleLearnerSelect = (learnerId) => {
    const id = parseInt(learnerId);
    if (formData.learner_ids.includes(id)) {
      setFormData({
        ...formData,
        learner_ids: formData.learner_ids.filter(lid => lid !== id),
      });
    } else {
      setFormData({
        ...formData,
        learner_ids: [...formData.learner_ids, id],
      });
    }
  };

  const handleProgramSelect = (programId) => {
    const id = parseInt(programId);
    if (formData.program_ids.includes(id)) {
      setFormData({
        ...formData,
        program_ids: formData.program_ids.filter(pid => pid !== id),
      });
    } else {
      setFormData({
        ...formData,
        program_ids: [...formData.program_ids, id],
      });
    }
  };

  const handleProgramChange = async (programId) => {
    setFormData({ ...formData, program_id: programId });

    if (programId) {
      try {
        const programContents = await programAssignmentService.getProgramContents(programId);
        const program = programs.find(p => p.id === parseInt(programId));
        setSelectedProgram({ ...program, contents: programContents });
      } catch (error) {
        console.error('Failed to load program contents:', error);
      }
    } else {
      setSelectedProgram(null);
    }
  };

  const handleViewContents = () => {
    setShowContentsPreviewModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.learner_ids.length === 0) {
      return toast.error('Please select at least one learner');
    }

    if (formData.program_ids.length === 0) {
      return toast.error('Please select at least one program');
    }

    if (!formData.start_date || !formData.end_date) {
      return toast.error('Please select start and end dates');
    }

    try {
      let totalSuccess = 0;
      let totalFailed = 0;
      const failedAssignments = [];

      // Loop through each selected program and create assignments
      for (const programId of formData.program_ids) {
        const payload = {
          learner_ids: formData.learner_ids,
          program_id: parseInt(programId),
          start_date: formData.start_date,
          end_date: formData.end_date,
          duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
          head_notes: formData.head_notes || null,
        };

        try {
          const result = await programAssignmentService.createAssignments(payload);
          totalSuccess += result.success_count;
          totalFailed += result.failed_count;

          if (result.failed_learners && result.failed_learners.length > 0) {
            failedAssignments.push(...result.failed_learners);
          }
        } catch (error) {
          console.error(`Failed to assign program ${programId}:`, error);
          const programName = programs.find(p => p.id === programId)?.goal || `Program #${programId}`;
          toast.error(`Failed to assign ${programName}`);
          totalFailed += formData.learner_ids.length;
        }
      }

      // Show summary results
      if (totalSuccess > 0) {
        toast.success(
          `Successfully created ${totalSuccess} assignment(s) for ${formData.program_ids.length} program(s)!`
        );
      }

      if (totalFailed > 0) {
        toast.warning(`${totalFailed} assignment(s) failed`);
      }

      // Refresh data and close modal
      fetchInitialData();
      setShowAssignModal(false);
      setFormData({
        learner_ids: [],
        program_ids: [],
        start_date: '',
        end_date: '',
        duration_days: '',
        head_notes: '',
        manual_duration: false,
      });
      setSelectedProgram(null);
    } catch (error) {
      console.error('Failed to create assignments:', error);
      toast.error(error.response?.data?.detail || 'Failed to create assignments');
    }
  };

  const handleViewTracking = async (assignment) => {
    setSelectedAssignment(assignment);
    setShowTrackingModal(true);

    try {
      const [assignmentDetails, attachmentsData, stats] = await Promise.all([
        programAssignmentService.getAssignmentById(assignment.id),
        programAssignmentService.getAttachments(assignment.id),
        programAssignmentService.getCompletionStats(assignment.learner_id),
      ]);

      setSelectedAssignment(assignmentDetails);
      setAttachments(attachmentsData);
      setCompletionStats(stats);
    } catch (error) {
      toast.error('Failed to load tracking data');
    }
  };

  const handleUploadAttachment = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/avi', 'video/mov', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return toast.error('Only images, videos, and PDFs are allowed');
    }

    // Validate file size
    const maxSize = file.type.startsWith('video/') ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return toast.error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    try {
      setUploading(true);
      await programAssignmentService.uploadAttachment(selectedAssignment.id, file);
      toast.success('Attachment uploaded successfully');

      // Refresh attachments
      const attachmentsData = await programAssignmentService.getAttachments(selectedAssignment.id);
      setAttachments(attachmentsData);
    } catch (error) {
      toast.error('Failed to upload attachment');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Delete this attachment?')) return;

    try {
      await programAssignmentService.deleteAttachment(attachmentId);
      toast.success('Attachment deleted');

      const attachmentsData = await programAssignmentService.getAttachments(selectedAssignment.id);
      setAttachments(attachmentsData);
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Delete this assignment? This action cannot be undone.')) return;

    try {
      await programAssignmentService.deleteAssignment(assignmentId);
      toast.success('Assignment deleted');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to delete assignment');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'status-success';
      case 'IN_PROGRESS':
        return 'status-warning';
      case 'NOT_STARTED':
        return 'status-info';
      default:
        return 'status-default';
    }
  };

  const getStatusLabel = (status) => {
    return status.replace('_', ' ');
  };

  return (
    <div className="page-container">
      <Navbar />
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Manage Program Assignments</h1>
              <p className="page-description">Assign learning programs to learners and track their progress</p>
            </div>
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn-gradient"
            >
              + Assign Program
            </button>
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'tab-btn-active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📊 Overview by Learner
              </button>
              <button
                className={`tab-btn ${activeTab === 'assignments' ? 'tab-btn-active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                📋 All Assignments
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-section">
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                </div>
              ) : overview.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-description">
                    No assignments yet. Start by assigning programs to learners!
                  </p>
                </div>
              ) : (
                <div className="cards-grid">
                  {overview.map((learnerData) => (
                    <div key={learnerData.learner_id} className="overview-card">
                      <div className="overview-card-header">
                        <div className="overview-learner-info">
                          <div className="avatar-circle">
                            {learnerData.learner_name?.charAt(0)?.toUpperCase() || 'L'}
                          </div>
                          <div>
                            <h3 className="overview-learner-name">{learnerData.learner_name}</h3>
                            <p className="overview-learner-email">{learnerData.learner_email}</p>
                          </div>
                        </div>
                        <div className="overview-percentage">
                          <span className="percentage-value">{learnerData.completion_percentage}%</span>
                          <span className="percentage-label">Complete</span>
                        </div>
                      </div>

                      <div className="overview-stats-row">
                        <div className="overview-stat">
                          <span className="stat-number stat-total">{learnerData.total_assignments}</span>
                          <span className="stat-text">Total</span>
                        </div>
                        <div className="overview-stat">
                          <span className="stat-number stat-completed">{learnerData.completed}</span>
                          <span className="stat-text">Done</span>
                        </div>
                        <div className="overview-stat">
                          <span className="stat-number stat-progress">{learnerData.in_progress}</span>
                          <span className="stat-text">Active</span>
                        </div>
                        <div className="overview-stat">
                          <span className="stat-number stat-pending">{learnerData.not_started}</span>
                          <span className="stat-text">Pending</span>
                        </div>
                      </div>

                      <div className="progress-bar-container">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${learnerData.completion_percentage}%` }}
                        ></div>
                      </div>

                      <div className="overview-programs">
                        <h4 className="overview-programs-title">Assigned Programs</h4>
                        <div className="overview-programs-list">
                          {learnerData.assignments.map((a) => (
                            <div key={a.id} className="overview-program-item">
                              <span className={`status-dot ${getStatusColor(a.status)}`}></span>
                              <span className="program-name">{a.program_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        className="btn-outline btn-sm btn-full"
                        onClick={() => {
                          setFilterLearner(learnerData.learner_id.toString());
                          setActiveTab('assignments');
                        }}
                      >
                        View All Assignments →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <>
              {/* Filters */}
              <div className="filters-section">
                <div className="filters-group">
                  <select
                    className="form-select"
                    value={filterLearner}
                    onChange={(e) => setFilterLearner(e.target.value)}
                  >
                    <option value="">All Learners</option>
                    {learners.map(learner => (
                      <option key={learner.user_id} value={learner.user_id}>{learner.name}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="NOT_STARTED">Not Started</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>

                  {(filterLearner || filterStatus) && (
                    <button
                      onClick={() => {
                        setFilterLearner('');
                        setFilterStatus('');
                        fetchAssignments();
                      }}
                      className="btn-secondary"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Assignments Table */}
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                </div>
              ) : assignments.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-description">
                    No assignments found. Start by assigning programs to learners!
                  </p>
                </div>
              ) : (
                <div className="data-table-container">
                  <div className="table-wrapper table-desktop">
                    <table className="data-table">
                      <thead className="data-table-header">
                        <tr>
                          <th className="data-table-th">Program</th>
                          <th className="data-table-th">Learner</th>
                          <th className="data-table-th">Start Date</th>
                          <th className="data-table-th">End Date</th>
                          <th className="data-table-th">Duration</th>
                          <th className="data-table-th">Status</th>
                          <th className="data-table-th data-table-th-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="data-table-body">
                        {assignments.map((assignment) => (
                          <tr key={assignment.id} className="data-table-row">
                            <td className="data-table-td">
                              <div className="data-table-name">{assignment.program_name}</div>
                              <div className="data-table-subtext">ID: {assignment.program_id}</div>
                            </td>
                            <td className="data-table-td">
                              <div className="data-table-name">{assignment.learner_name}</div>
                            </td>
                            <td className="data-table-td">
                              {new Date(assignment.start_date).toLocaleDateString()}
                            </td>
                            <td className="data-table-td">
                              {new Date(assignment.end_date).toLocaleDateString()}
                            </td>
                            <td className="data-table-td">
                              {assignment.duration_days ||
                                calculateDuration(assignment.start_date, assignment.end_date)} days
                            </td>
                            <td className="data-table-td">
                              <span className={`status-badge ${getStatusColor(assignment.completion_status)}`}>
                                {getStatusLabel(assignment.completion_status)}
                              </span>
                            </td>
                            <td className="data-table-td data-table-td-center">
                              <div className="action-buttons">
                                <button
                                  onClick={() => handleViewTracking(assignment)}
                                  className="btn-primary btn-sm"
                                  title="View Tracking"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                  className="btn-danger btn-sm"
                                  title="Delete"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="mobile-cards">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="mobile-card">
                        <div className="mobile-card-header">
                          <h3 className="mobile-card-title">{assignment.program_name}</h3>
                          <span className={`status-badge ${getStatusColor(assignment.completion_status)}`}>
                            {getStatusLabel(assignment.completion_status)}
                          </span>
                        </div>

                        <div className="mobile-card-info">
                          <div className="info-row">
                            <span className="info-label">Learner:</span>
                            <span className="info-value">{assignment.learner_name}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Duration:</span>
                            <span className="info-value">
                              {new Date(assignment.start_date).toLocaleDateString()} - {new Date(assignment.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="info-label">Days:</span>
                            <span className="info-value">
                              {assignment.duration_days || calculateDuration(assignment.start_date, assignment.end_date)} days
                            </span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          <button
                            onClick={() => handleViewTracking(assignment)}
                            className="btn-primary"
                          >
                            View Tracking
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assignment.id)}
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
            </>
          )}
        </div>
      </div>
      <Footer />

      {/* Assign Program Modal */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">Assign Program to Learners</h2>

            <form onSubmit={handleSubmit}>
              {/* Learner Selection */}
              <div className="form-field">
                <label className="form-label">
                  Select Learners <span className="form-required">*</span>
                  <span className="form-hint">({formData.learner_ids.length} selected)</span>
                </label>
                <input
                  type="text"
                  placeholder="🔍 Search learners..."
                  className="form-input"
                  value={searchLearner}
                  onChange={(e) => setSearchLearner(e.target.value)}
                  style={{ marginBottom: '1rem' }}
                />
                <div className="checkbox-grid">
                  {filteredLearners.length > 0 ? (
                    filteredLearners.map(learner => (
                      <div key={learner.user_id} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`learner-${learner.user_id}`}
                          checked={formData.learner_ids.includes(learner.user_id)}
                          onChange={() => handleLearnerSelect(learner.user_id)}
                          className="form-checkbox"
                        />
                        <label htmlFor={`learner-${learner.user_id}`} className="checkbox-label">
                          {learner.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No learners found matching "{searchLearner}"
                    </div>
                  )}
                </div>
              </div>

              {/* Program Selection */}
              <div className="form-field">
                <label className="form-label">
                  Select Programs <span className="form-required">*</span>
                  <span className="form-hint">({formData.program_ids.length} selected)</span>
                </label>
                <input
                  type="text"
                  placeholder="🔍 Search programs..."
                  className="form-input"
                  value={searchProgram}
                  onChange={(e) => setSearchProgram(e.target.value)}
                  style={{ marginBottom: '1rem' }}
                />
                <div className="checkbox-grid">
                  {filteredPrograms.length > 0 ? (
                    filteredPrograms.map(program => (
                      <div key={program.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          id={`program-${program.id}`}
                          checked={formData.program_ids.includes(program.id)}
                          onChange={() => handleProgramSelect(program.id)}
                          className="form-checkbox"
                        />
                        <label htmlFor={`program-${program.id}`} className="checkbox-label">
                          <div>
                            <div className="font-semibold">{program.goal}</div>
                            {program.goal_description && (
                              <div className="text-xs text-gray-500 mt-1">{program.goal_description}</div>
                            )}
                            {program.contents && program.contents.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">
                                📖 {program.contents.length} content(s)
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No programs found matching "{searchProgram}"
                    </div>
                  )}
                </div>
              </div>

              {/* Date Range */}
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">
                    Start Date <span className="form-required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.start_date}
                    onChange={(e) => handleDateChange('start_date', e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">
                    End Date <span className="form-required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.end_date}
                    onChange={(e) => handleDateChange('end_date', e.target.value)}
                    min={formData.start_date}
                    required
                  />
                </div>
              </div>

              {/* Duration */}
              <div className="form-field">
                <div className="form-group-inline">
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Duration (Days)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Auto-calculated"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                      disabled={!formData.manual_duration}
                    />
                  </div>
                  <div className="checkbox-item" style={{ marginTop: '1.75rem' }}>
                    <input
                      type="checkbox"
                      id="manual-duration"
                      checked={formData.manual_duration}
                      onChange={(e) => setFormData({ ...formData, manual_duration: e.target.checked })}
                      className="form-checkbox"
                    />
                    <label htmlFor="manual-duration" className="checkbox-label">
                      Manual Override
                    </label>
                  </div>
                </div>
              </div>

              {/* Head Notes */}
              <div className="form-field">
                <label className="form-label">Notes for Learner (Optional)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Add any instructions or notes for the learner..."
                  rows="4"
                  value={formData.head_notes}
                  onChange={(e) => setFormData({ ...formData, head_notes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setFormData({
                      learner_ids: [],
                      program_id: '',
                      start_date: '',
                      end_date: '',
                      duration_days: '',
                      head_notes: '',
                      manual_duration: false,
                    });
                    setSelectedProgram(null);
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gradient">
                  Assign Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contents Preview Modal */}
      {showContentsPreviewModal && selectedProgram && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Program Contents</h2>

            <div className="contents-preview-list">
              {selectedProgram.contents.map((content, index) => (
                <div key={content.content_id} className="content-preview-item">
                  <div className="content-preview-order">{index + 1}</div>
                  {content.thumbnail_url && (
                    <img src={content.thumbnail_url} alt="" className="content-preview-thumbnail" />
                  )}
                  <div className="content-preview-info">
                    <div className="content-preview-title">{content.content_title}</div>
                    <div className="content-preview-type">{content.content_type}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                onClick={() => setShowContentsPreviewModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && selectedAssignment && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">Assignment Tracking</h2>

            {/* Completion Stats */}
            {completionStats && (
              <div className="stats-card">
                <h3 className="stats-title">Overall Progress for {selectedAssignment.learner.name}</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <div className="stat-value">{completionStats.total_assignments}</div>
                    <div className="stat-label">Total Programs</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{completionStats.completed}</div>
                    <div className="stat-label">Completed</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{completionStats.in_progress}</div>
                    <div className="stat-label">In Progress</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">{completionStats.completion_percentage}%</div>
                    <div className="stat-label">Completion Rate</div>
                  </div>
                </div>
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${completionStats.completion_percentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Assignment Details */}
            <div className="assignment-details">
              <h3 className="section-title">Program Details</h3>
              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Program:</span>
                  <span className="detail-value">
                    {selectedAssignment?.program?.goal || selectedAssignment?.program_name || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className={`status-badge ${getStatusColor(selectedAssignment.completion_status)}`}>
                    {getStatusLabel(selectedAssignment.completion_status)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Start Date:</span>
                  <span className="detail-value">{new Date(selectedAssignment.start_date).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">End Date:</span>
                  <span className="detail-value">{new Date(selectedAssignment.end_date).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Duration:</span>
                  <span className="detail-value">{selectedAssignment.duration_days} days</span>
                </div>
                {selectedAssignment.completed_at && (
                  <div className="detail-item">
                    <span className="detail-label">Completed On:</span>
                    <span className="detail-value">{new Date(selectedAssignment.completed_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Learning Contents */}
              {selectedAssignment?.program?.contents && selectedAssignment.program.contents.length > 0 && (
                <div className="contents-section">
                  <h4 className="subsection-title">Learning Contents ({selectedAssignment.program.contents.length})</h4>
                  <div className="contents-list">
                    {selectedAssignment.program.contents.map((content, index) => (
                      <div key={content.id} className="content-item">
                        <span className="content-order">{index + 1}</span>
                        {content.thumbnail_url && (
                          <img src={content.thumbnail_url} alt="" className="content-thumbnail" />
                        )}
                        <div className="content-info">
                          <div className="content-title">{content.title}</div>
                          <div className="content-type">{content.content_type}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Head Notes */}
              {selectedAssignment.head_notes && (
                <div className="notes-section">
                  <h4 className="subsection-title">Your Notes</h4>
                  <div className="notes-content">{selectedAssignment.head_notes}</div>
                </div>
              )}

              {/* Learner Notes (Read-only for Head) */}
              {selectedAssignment.learner_notes && (
                <div className="notes-section">
                  <h4 className="subsection-title">Learner's Notes</h4>
                  <div className="notes-content">{selectedAssignment.learner_notes}</div>
                </div>
              )}

              {/* Attachments */}
              <div className="attachments-section">
                <h4 className="subsection-title">Attachments</h4>

                <div className="upload-section">
                  <label className="upload-button">
                    <input
                      type="file"
                      accept="image/*,video/*,.pdf"
                      onChange={handleUploadAttachment}
                      disabled={uploading}
                      style={{ display: 'none' }}
                    />
                    <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Upload Reference Material'}
                  </label>
                  <span className="upload-hint">Images, Videos, PDFs (Max: 500MB for videos, 50MB for others)</span>
                </div>

                {attachments.length === 0 ? (
                  <div className="empty-state-sm">
                    <p>No attachments yet</p>
                  </div>
                ) : (
                  <div className="attachments-grid">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="attachment-card">
                        {attachment.thumbnail_url && (
                          <img src={attachment.thumbnail_url} alt="" className="attachment-thumbnail" />
                        )}
                        <div className="attachment-info">
                          <div className="attachment-name">{attachment.file_name}</div>
                          <div className="attachment-meta">
                            <span className="attachment-type">{attachment.file_type}</span>
                            <span className="attachment-uploader">by {attachment.uploader_name || 'Unknown'}</span>
                            <span className="attachment-date">
                              {new Date(attachment.uploaded_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="attachment-actions">
                          <a
                            href={attachment.file_path}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary btn-sm"
                          >
                            View
                          </a>
                          <button
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowTrackingModal(false);
                  setSelectedAssignment(null);
                  setAttachments([]);
                  setCompletionStats(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProgramAssignments;
