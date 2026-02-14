import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import programAssignmentService from '../../api/services/programAssignmentService';
import headService from '../../api/services/headService';
import learningProgramsService from '../../api/services/learningProgramsService';
import learningContentService from '../../api/services/learningContentService';
import '../../styles/components/common/Modal.css';
import '../../styles/ManageProgramAssignments.css';
import '../../styles/Table.css';

const ManageProgramAssignments = () => {
  const navigate = useNavigate();
  const [learners, setLearners] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [overview, setOverview] = useState([]);
  const [allLearningContents, setAllLearningContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showContentsPreviewModal, setShowContentsPreviewModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedGroupAssignments, setSelectedGroupAssignments] = useState([]);
  const [selectedContentAssignment, setSelectedContentAssignment] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [completionStats, setCompletionStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'assignments'
  const [feedbackData, setFeedbackData] = useState({
    feedback_text: '',
    rating: 0
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [showFinalFeedbackModal, setShowFinalFeedbackModal] = useState(false);
  const [finalFeedbackData, setFinalFeedbackData] = useState({
    rating: 0,
    remarks: '',
    completion_status: 'COMPLETED'
  });
  const [finalFeedbackSubmitting, setFinalFeedbackSubmitting] = useState(false);

  const [filterLearner, setFilterLearner] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchLearner, setSearchLearner] = useState('');
  const [searchProgram, setSearchProgram] = useState('');
  const [searchExtraContent, setSearchExtraContent] = useState('');

  const [formData, setFormData] = useState({
    learner_ids: [],
    program_ids: [],  // Changed from program_id to program_ids array
    extra_content_ids: [],  // Additional learning contents to assign
    assignment_title: '',  // Title/Name for this assignment
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
    fetchAssignments();
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

  // Group assignments by title
  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const title = assignment.assignment_title;
    if (!acc[title]) {
      acc[title] = [];
    }
    acc[title].push(assignment);
    return acc;
  }, {});

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [learnersData, programsData, assignmentsData, overviewData, learningContentsData] = await Promise.all([
        headService.getAllLearners(),
        learningProgramsService.getAllPrograms(),
        programAssignmentService.getAssignments(),
        programAssignmentService.getAssignmentsOverview(),
        learningContentService.getAllContentsForHead(),
      ]);

      setLearners(learnersData);
      setPrograms(programsData);
      setAssignments(assignmentsData);
      setOverview(overviewData);
      setAllLearningContents(learningContentsData || []);
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

  const handleExtraContentSelect = (contentId) => {
    const id = parseInt(contentId);
    if (formData.extra_content_ids.includes(id)) {
      setFormData({
        ...formData,
        extra_content_ids: formData.extra_content_ids.filter(cid => cid !== id),
      });
    } else {
      setFormData({
        ...formData,
        extra_content_ids: [...formData.extra_content_ids, id],
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

    if (!formData.assignment_title || formData.assignment_title.trim() === '') {
      return toast.error('Please enter an assignment title');
    }

    if (!formData.start_date || !formData.end_date) {
      return toast.error('Please select start and end dates');
    }

    try {
      console.log('[ManageProgramAssignments] Form data:', formData);
      console.log('[ManageProgramAssignments] Extra content IDs:', formData.extra_content_ids);

      // Send ALL selected programs in one request
      const payload = {
        learner_ids: formData.learner_ids,
        program_ids: formData.program_ids.map(id => parseInt(id)),  // Send as array
        assignment_title: formData.assignment_title.trim(),
        extra_content_ids: formData.extra_content_ids && formData.extra_content_ids.length > 0 ? formData.extra_content_ids : [],
        start_date: formData.start_date,
        end_date: formData.end_date,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
        head_notes: formData.head_notes || null,
      };

      console.log('[ManageProgramAssignments] Payload:', payload);

      const result = await programAssignmentService.createAssignments(payload);

      // Show summary results
      if (result.success_count > 0) {
        toast.success(
          `Successfully created ${result.success_count} assignment(s) for ${formData.learner_ids.length} learner(s) × ${formData.program_ids.length} program(s)!`
        );
      }

      if (result.failed_count > 0) {
        toast.warning(`${result.failed_count} assignment(s) failed`);
      }

      // Refresh data and close modal
      fetchInitialData();
      setShowAssignModal(false);
      setFormData({
        learner_ids: [],
        program_ids: [],
        assignment_title: '',
        extra_content_ids: [],
        start_date: '',
        end_date: '',
        duration_days: '',
        head_notes: '',
        manual_duration: false,
      });
      setSelectedProgram(null);
      setSearchExtraContent('');
    } catch (error) {
      console.error('Failed to create assignments:', error);
      toast.error(error.response?.data?.detail || 'Failed to create assignments');
    }
  };

  const handleViewTracking = async (assignment, groupAssignments = []) => {
    setSelectedAssignment(assignment);
    setSelectedGroupAssignments(groupAssignments);
    setShowTrackingModal(true);

    try {
      const [assignmentDetails, attachmentsData, stats] = await Promise.all([
        programAssignmentService.getAssignmentById(assignment.id),
        programAssignmentService.getAttachments(assignment.id),
        programAssignmentService.getCompletionStats(assignment.learner_id),
      ]);

      console.log('Assignment Details Response:', assignmentDetails);
      console.log('Program Names:', assignmentDetails.program_names);
      console.log('Content Assignments:', assignmentDetails.content_assignments);

      setSelectedAssignment(assignmentDetails);
      setAttachments(attachmentsData);
      setCompletionStats(stats);
    } catch (error) {
      console.error('Error loading tracking data:', error);
      toast.error('Failed to load tracking data');
    }
  };

  const handleRefreshTracking = async () => {
    if (!selectedAssignment) return;

    try {
      const [assignmentDetails, attachmentsData, stats] = await Promise.all([
        programAssignmentService.getAssignmentById(selectedAssignment.id),
        programAssignmentService.getAttachments(selectedAssignment.id),
        programAssignmentService.getCompletionStats(selectedAssignment.learner_id),
      ]);

      setSelectedAssignment(assignmentDetails);
      setAttachments(attachmentsData);
      setCompletionStats(stats);

      // Also refresh the main assignments list
      await fetchAssignments();

      // toast.success('Refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
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
    if (!window.confirm('Delete this assignment?\n\n⚠️ This will delete:\n- The program assignment\n- All assigned content\n\nThis action cannot be undone.')) return;

    try {
      await programAssignmentService.deleteAssignment(assignmentId);
      toast.success('Assignment and all associated content deleted');
      fetchAssignments();
    } catch (error) {
      toast.error('Failed to delete assignment');
    }
  };

  const handleDeleteAssignmentTitle = async (titleAssignments) => {
    const programCount = titleAssignments.length;
    const confirmation = window.confirm(
      `Delete this assignment title and all ${programCount} associated program${programCount > 1 ? 's' : ''}?\n\n⚠️ This will delete:\n- All program assignments under this title\n- All assigned content\n\nThis action cannot be undone.`
    );

    if (!confirmation) return;

    try {
      // Delete all assignments with this title (ask only once)
      const deletePromises = titleAssignments.map(a =>
        programAssignmentService.deleteAssignment(a.id)
      );
      await Promise.all(deletePromises);

      toast.success(`Deleted ${programCount} program${programCount > 1 ? 's' : ''} successfully`);
      fetchAssignments();
    } catch (error) {
      console.error('Failed to delete assignments:', error);
      toast.error('Failed to delete one or more assignments');
    }
  };

  const handleEditAssignment = async (assignment) => {
    // Load the assignment and prepare edit form
    try {
      const assignmentData = await programAssignmentService.getAssignmentById(assignment.id);
      setEditingAssignment(assignmentData);

      // Pre-fill the form with existing assignment data
      // Ensure extra_content_ids are converted to integers for proper matching
      const extraContentIds = (assignmentData.extra_content_ids || []).map(id =>
        typeof id === 'string' ? parseInt(id) : id
      );

      setFormData({
        learner_ids: [assignmentData.learner_id],
        program_ids: assignmentData.program_ids || [assignmentData.program_id],
        extra_content_ids: extraContentIds,
        assignment_title: assignmentData.assignment_title,
        start_date: assignmentData.start_date,
        end_date: assignmentData.end_date,
        duration_days: assignmentData.duration_days,
        head_notes: assignmentData.head_notes || '',
        manual_duration: !!assignmentData.duration_days,
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load assignment for editing:', error);
      toast.error('Failed to load assignment details');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!formData.assignment_title || formData.assignment_title.trim() === '') {
      return toast.error('Please enter an assignment title');
    }

    if (!formData.start_date || !formData.end_date) {
      return toast.error('Please select start and end dates');
    }

    if (formData.program_ids.length === 0) {
      return toast.error('Please select at least one program');
    }

    try {
      const payload = {
        assignment_title: formData.assignment_title.trim(),
        program_ids: formData.program_ids.map(id => parseInt(id)),
        extra_content_ids: formData.extra_content_ids && formData.extra_content_ids.length > 0 ? formData.extra_content_ids : [],
        start_date: formData.start_date,
        end_date: formData.end_date,
        duration_days: formData.duration_days ? parseInt(formData.duration_days) : null,
        head_notes: formData.head_notes || null,
      };

      await programAssignmentService.updateAssignment(editingAssignment.id, payload);
      toast.success('Assignment updated successfully');

      // Refresh data and close modal
      fetchInitialData();
      setShowEditModal(false);
      setEditingAssignment(null);
      setFormData({
        learner_ids: [],
        program_ids: [],
        assignment_title: '',
        extra_content_ids: [],
        start_date: '',
        end_date: '',
        duration_days: '',
        head_notes: '',
        manual_duration: false,
      });
      setSelectedProgram(null);
      setSearchExtraContent('');
    } catch (error) {
      console.error('Failed to update assignment:', error);
      toast.error(error.response?.data?.detail || 'Failed to update assignment');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'REVIEWED':
        return 'status-success';
      case 'IN_PROGRESS':
      case 'SUBMITTED':
        return 'status-warning';
      case 'LATE_SUBMITTED':
        return 'status-danger';
      case 'NEW':
        return 'status-info';
      default:
        return 'status-default';
    }
  };

  const getStatusLabel = (status) => {
    return status.replace(/_/g, ' ');
  };

  const handleReviewContent = async (contentAssignmentId) => {
    if (!window.confirm('Mark this content as reviewed?')) return;

    try {
      await programAssignmentService.reviewContent(contentAssignmentId);
      toast.success('Content marked as reviewed');

      // Refresh assignment details
      const assignmentDetails = await programAssignmentService.getAssignmentById(selectedAssignment.id);
      setSelectedAssignment(assignmentDetails);
    } catch (error) {
      toast.error('Failed to review content');
    }
  };

  const handleOpenFeedbackModal = (contentAssignment) => {
    setSelectedContentAssignment(contentAssignment);
    // Pre-fill feedback data if it exists
    if (contentAssignment.head_feedback_text || contentAssignment.head_rating) {
      setFeedbackData({
        feedback_text: contentAssignment.head_feedback_text || '',
        rating: contentAssignment.head_rating || 0
      });
    } else {
      setFeedbackData({
        feedback_text: '',
        rating: 0
      });
    }
    setShowFeedbackModal(true);
  };

  const handleCloseFeedbackModal = () => {
    setShowFeedbackModal(false);
    setSelectedContentAssignment(null);
    setFeedbackData({
      feedback_text: '',
      rating: 0
    });
  };

  const handleSubmitFeedback = async () => {
    if (!selectedContentAssignment) {
      toast.error('No content selected');
      return;
    }

    if (feedbackData.rating < 1 || feedbackData.rating > 5) {
      toast.error('Please select a rating between 1 and 5');
      return;
    }

    try {
      setFeedbackSubmitting(true);
      await programAssignmentService.submitFeedback(selectedContentAssignment.id, {
        feedback_text: feedbackData.feedback_text,
        rating: feedbackData.rating
      });
      toast.success('Feedback submitted successfully');

      // Refresh assignment details
      const assignmentDetails = await programAssignmentService.getAssignmentById(selectedAssignment.id);
      setSelectedAssignment(assignmentDetails);

      handleCloseFeedbackModal();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleOpenFinalFeedbackModal = () => {
    // Pre-fill if feedback already exists
    if (selectedAssignment?.final_feedback_rating || selectedAssignment?.final_feedback_remarks) {
      setFinalFeedbackData({
        rating: selectedAssignment.final_feedback_rating || 0,
        remarks: selectedAssignment.final_feedback_remarks || ''
      });
    } else {
      setFinalFeedbackData({
        rating: 0,
        remarks: ''
      });
    }
    setShowFinalFeedbackModal(true);
  };

  const handleCloseFinalFeedbackModal = () => {
    setShowFinalFeedbackModal(false);
    setFinalFeedbackData({
      rating: 0,
      remarks: '',
      completion_status: 'COMPLETED'
    });
  };

  const handleSubmitFinalFeedback = async () => {
    if (!selectedAssignment) {
      toast.error('No assignment selected');
      return;
    }

    if (finalFeedbackData.rating < 1 || finalFeedbackData.rating > 5) {
      toast.error('Please select a rating between 1 and 5 stars');
      return;
    }

    try {
      setFinalFeedbackSubmitting(true);
      await programAssignmentService.submitFinalFeedback(selectedAssignment.id, {
        rating: finalFeedbackData.rating,
        remarks: finalFeedbackData.remarks,
        completion_status: finalFeedbackData.completion_status
      });
      toast.success('Final feedback submitted successfully!');

      // Refresh assignment details
      const assignmentDetails = await programAssignmentService.getAssignmentById(selectedAssignment.id);
      setSelectedAssignment(assignmentDetails);

      handleCloseFinalFeedbackModal();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit final feedback');
    } finally {
      setFinalFeedbackSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/dashboard")}
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
              <h1 className="page-title">Manage Home Program Assignments</h1>
              <p className="page-description">
                Assign home learning programs to learners and track their progress
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="search-section">
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn-gradient  "
            >
              + Assign Home Program
            </button>
          </div>

          {/* Tabs */}
          <div className="mpa-tabs-container">
            <div className="mpa-tabs">
              <button
                className={`mpa-tab-btn ${activeTab === 'overview' ? 'mpa-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📊 Overview by Learner
              </button>
              <button
                className={`mpa-tab-btn ${activeTab === 'assignments' ? 'mpa-tab-btn-active' : ''}`}
                onClick={() => setActiveTab('assignments')}
              >
                📋 All Home Program Assignments
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="mpa-overview-section">
              {loading ? (
                <div className="mpa-loading-container">
                  <div className="mpa-loading-spinner"></div>
                </div>
              ) : overview.length === 0 ? (
                <div className="mpa-empty-state">
                  <p className="mpa-empty-state-description">
                    No assignments yet. Start by assigning home programs to learners!
                  </p>
                </div>
              ) : (
                <div className="mpa-cards-grid">
                  {overview.map((learnerData) => (
                    <div key={learnerData.learner_id} className="mpa-overview-card">
                      <div className="mpa-overview-card-header">
                        <div className="mpa-overview-learner-info">
                          <div className="mpa-avatar-circle">
                            {learnerData.learner_name?.charAt(0)?.toUpperCase() || 'L'}
                          </div>
                          <div>
                            <h3 className="mpa-overview-learner-name">{learnerData.learner_name}</h3>
                            <p className="mpa-overview-learner-email">{learnerData.learner_email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="overview-programs">
                        <h4 className="overview-programs-title">📌 Assigned Home Program Titles</h4>
                        <div className="overview-programs-list">
                          {Array.from(
                            // Group assignments by assignment_title
                            learnerData.assignments.reduce((acc, a) => {
                              const title = a.assignment_title || a.program_name || 'Untitled';
                              if (!acc.has(title)) {
                                acc.set(title, []);
                              }
                              acc.get(title).push(a);
                              return acc;
                            }, new Map()).entries()
                          ).map(([title]) => (
                            <div key={title} className="overview-program-item" style={{ cursor: 'default' }}>
                              <span style={{ fontSize: '12px', color: '#999' }}>•</span>
                              <span className="program-name">
                                {title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        className="mpa-btn-outline mpa-btn-sm mpa-btn-full"
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
              <div className="mpa-filters-section">
                <div className="mpa-filters-group">
                  <select
                    className="mpa-form-select"
                    value={filterLearner}
                    onChange={(e) => setFilterLearner(e.target.value)}
                  >
                    <option value="">All Learners</option>
                    {learners.map(learner => (
                      <option key={learner.user_id} value={learner.user_id}>{learner.name}</option>
                    ))}
                  </select>

                  <select
                    className="mpa-form-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="NEW">New</option>
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
                      className="mpa-btn-secondary"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Assignments Table */}
              {loading ? (
                <div className="mpa-loading-container">
                  <div className="mpa-loading-spinner"></div>
                </div>
              ) : assignments.length === 0 ? (
                <div className="mpa-empty-state">
                  <p className="mpa-empty-state-description">
                    No assignments found. Start by assigning programs to learners!
                  </p>
                </div>
              ) : (
                <div className="table-primary-container">
                  <div className="table-primary-wrapper mpa-table-desktop">
                    <table className="table-primary">
                      <thead className="table-primary-header">
                        <tr>
                          <th className="table-primary-th">Title</th>
                          <th className="table-primary-th">Learner</th>
                          <th className="table-primary-th">Start Date</th>
                          <th className="table-primary-th">End Date</th>
                          <th className="table-primary-th">Duration</th>
                          <th className="table-primary-th">Status</th>
                          <th className="table-primary-th table-primary-th-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="table-primary-body">
                        {assignments.map((assignment, index) => (
                          <tr key={`${assignment.id}-${index}`} className="table-primary-row">
                            <td className="table-primary-td">
                              <div className="table-primary-cell-name">{assignment.assignment_title}</div>
                            </td>
                            <td className="table-primary-td">
                              <div className="table-primary-cell-name">{assignment.learner_name}</div>
                            </td>
                            <td className="table-primary-td">
                              {new Date(assignment.start_date).toLocaleDateString()}
                            </td>
                            <td className="table-primary-td">
                              {new Date(assignment.end_date).toLocaleDateString()}
                            </td>
                            <td className="table-primary-td">
                              {assignment.duration_days ||
                                calculateDuration(assignment.start_date, assignment.end_date)} days
                            </td>
                            <td className="table-primary-td">
                              <span className={`mpa-status-badge ${getStatusColor(assignment.completion_status)}`}>
                                {getStatusLabel(assignment.completion_status)}
                              </span>
                            </td>
                            <td className="table-primary-td table-primary-td-center">
                              <div className="mpa-action-buttons">
                                <button
                                  onClick={() => handleViewTracking(assignment, [assignment])}
                                  className="mpa-btn-primary mpa-btn-sm"
                                  title="View Tracking"
                                >
                                  Track
                                </button>
                                <button
                                  onClick={() => handleEditAssignment(assignment)}
                                  className="mpa-btn-secondary mpa-btn-sm"
                                  title="Edit"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteAssignmentTitle([assignment])}
                                  className="mpa-btn-danger mpa-btn-sm"
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
                  <div className="mpa-mobile-cards">
                    {assignments.map((assignment, index) => (
                      <div key={`${assignment.id}-${index}`} className="mpa-mobile-card">
                        <div className="mpa-mobile-card-header">
                          <h3 className="mpa-mobile-card-title">{assignment.assignment_title}</h3>
                          <span className={`mpa-status-badge ${getStatusColor(assignment.completion_status)}`}>
                            {getStatusLabel(assignment.completion_status)}
                          </span>
                        </div>

                        <div className="mpa-mobile-card-info">
                          <div className="mpa-info-row">
                            <span className="mpa-info-label">Learner:</span>
                            <span className="mpa-info-value">{assignment.learner_name}</span>
                          </div>
                          <div className="mpa-info-row">
                            <span className="mpa-info-label">Program:</span>
                            <span className="mpa-info-value">
                              {assignment.program_name}
                            </span>
                          </div>
                          <div className="mpa-info-row">
                            <span className="mpa-info-label">Duration:</span>
                            <span className="mpa-info-value">
                              {new Date(assignment.start_date).toLocaleDateString()} - {new Date(assignment.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="mpa-info-row">
                            <span className="mpa-info-label">Days:</span>
                            <span className="mpa-info-value">
                              {assignment.duration_days || calculateDuration(assignment.start_date, assignment.end_date)} days
                            </span>
                          </div>
                        </div>

                        <div className="mpa-mobile-card-actions">
                          <button
                            onClick={() => handleViewTracking(assignment, [assignment])}
                            className="mpa-btn-primary"
                          >
                            View Tracking
                          </button>
                          <button
                            onClick={() => handleEditAssignment(assignment)}
                            className="mpa-btn-secondary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAssignmentTitle([assignment])}
                            className="mpa-btn-danger"
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

      {/* Assign Home Program Modal */}
      {showAssignModal && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--lg">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Assign Home Program to Learners</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setFormData({
                    learner_ids: [],
                    program_ids: [],
                    extra_content_ids: [],
                    start_date: '',
                    end_date: '',
                    duration_days: '',
                    head_notes: '',
                    manual_duration: false,
                    assignment_title: '',
                  });
                  setSelectedProgram(null);
                  setSearchExtraContent('');
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="app-modal-content">
                {/* Assignment Title */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">
                    Assignment Title <span className="mpa-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter a title for this program assignment (e.g., 'Q1 Home Program', 'Advanced Learning Path')..."
                    className="mpa-form-input"
                    value={formData.assignment_title}
                    onChange={(e) => setFormData({ ...formData, assignment_title: e.target.value })}
                    required
                  />
                </div>

                {/* Learner Selection */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">
                    Select Learners <span className="mpa-form-required">*</span>
                    <span className="mpa-form-hint">({formData.learner_ids.length} selected)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="🔍 Search learners..."
                    className="mpa-form-input mpa-search-input-spacing"
                    value={searchLearner}
                    onChange={(e) => setSearchLearner(e.target.value)}
                  />
                  <div className="mpa-checkbox-grid">
                    {filteredLearners.length > 0 ? (
                      filteredLearners.map(learner => (
                        <div key={learner.user_id} className="mpa-checkbox-item">
                          <input
                            type="checkbox"
                            id={`learner-${learner.user_id}`}
                            checked={formData.learner_ids.includes(learner.user_id)}
                            onChange={() => handleLearnerSelect(learner.user_id)}
                            className="mpa-form-checkbox"
                          />
                          <label htmlFor={`learner-${learner.user_id}`} className="mpa-checkbox-label">
                            {learner.name}
                          </label>
                        </div>
                      ))
                    ) : (
                      <div className="mpa-text-center mpa-text-gray-500 mpa-py-4">
                        No learners found matching "{searchLearner}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Program Selection */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">
                    Select Programs <span className="mpa-form-required">*</span>
                    <span className="mpa-form-hint">({formData.program_ids.length} selected)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="🔍 Search programs..."
                    className="mpa-form-input mpa-search-input-spacing"
                    value={searchProgram}
                    onChange={(e) => setSearchProgram(e.target.value)}
                  />
                  <div className="mpa-checkbox-grid">
                    {filteredPrograms.length > 0 ? (
                      filteredPrograms.map(program => (
                        <div key={program.id} className="mpa-checkbox-item">
                          <input
                            type="checkbox"
                            id={`program-${program.id}`}
                            checked={formData.program_ids.includes(program.id)}
                            onChange={() => handleProgramSelect(program.id)}
                            className="mpa-form-checkbox"
                          />
                          <label htmlFor={`program-${program.id}`} className="mpa-checkbox-label">
                            <div>
                              <div className="mpa-font-semibold">{program.goal}</div>
                              {program.goal_description && (
                                <div className="mpa-text-xs mpa-text-gray-500 mpa-mt-1">{program.goal_description}</div>
                              )}
                            </div>
                          </label>
                        </div>
                      ))
                    ) : (
                      <div className="mpa-text-center mpa-text-gray-500 mpa-py-4">
                        No programs found matching "{searchProgram}"
                      </div>
                    )}
                  </div>
                </div>

                {/* Learning Content Selection */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">
                    Assign Learning Content
                    <span className="mpa-form-hint">({formData.extra_content_ids.length} selected)</span>
                  </label>
                  <p className="mpa-text-sm mpa-text-gray-600 mpa-mb-2">
                    Select learning materials to assign to learners
                  </p>
                  <input
                    type="text"
                    placeholder="🔍 Search learning content..."
                    className="mpa-form-input mpa-search-input-spacing"
                    value={searchExtraContent}
                    onChange={(e) => setSearchExtraContent(e.target.value)}
                  />
                  <div className="mpa-checkbox-grid mpa-content-checkbox-grid">
                    {allLearningContents
                      .filter(content =>
                        content.title.toLowerCase().includes(searchExtraContent.toLowerCase()) ||
                        (content.description && content.description.toLowerCase().includes(searchExtraContent.toLowerCase()))
                      )
                      .map(content => (
                        <div key={content.id} className="mpa-checkbox-item">
                          <input
                            type="checkbox"
                            id={`extra-content-${content.id}`}
                            checked={formData.extra_content_ids.includes(parseInt(content.id))}
                            onChange={() => handleExtraContentSelect(content.id)}
                            className="mpa-form-checkbox"
                          />
                          <label htmlFor={`extra-content-${content.id}`} className="mpa-checkbox-label">
                            <div>
                              <div className="mpa-font-semibold">{content.title}</div>
                              {content.description && (
                                <div className="mpa-text-xs mpa-text-gray-500 mpa-mt-1">{content.description}</div>
                              )}
                              <div className="mpa-text-xs mpa-text-[#9C4D0B] mpa-mt-1">
                                📄 {content.content_type}
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    {allLearningContents.filter(content =>
                      content.title.toLowerCase().includes(searchExtraContent.toLowerCase()) ||
                      (content.description && content.description.toLowerCase().includes(searchExtraContent.toLowerCase()))
                    ).length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                          No learning content found{searchExtraContent ? ` matching "${searchExtraContent}"` : ''}
                        </div>
                      )}
                  </div>
                </div>

                {/* Date Range */}
                <div className="mpa-form-row">
                  <div className="mpa-form-field">
                    <label className="mpa-form-label">
                      Start Date <span className="mpa-form-required">*</span>
                    </label>
                    <input
                      type="date"
                      className="mpa-form-input"
                      value={formData.start_date}
                      onChange={(e) => handleDateChange('start_date', e.target.value)}
                      required
                    />
                  </div>

                  <div className="mpa-form-field">
                    <label className="mpa-form-label">
                      End Date <span className="mpa-form-required">*</span>
                    </label>
                    <input
                      type="date"
                      className="mpa-form-input"
                      value={formData.end_date}
                      onChange={(e) => handleDateChange('end_date', e.target.value)}
                      min={formData.start_date}
                      required
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="mpa-form-field">
                  <div className="mpa-form-group-inline">
                    <div className="mpa-duration-field-flex">
                      <label className="mpa-form-label">Duration (Days)</label>
                      <input
                        type="number"
                        className="mpa-form-input"
                        placeholder="Auto-calculated"
                        value={formData.duration_days}
                        onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                        disabled={!formData.manual_duration}
                      />
                    </div>
                    <div className="mpa-checkbox-item mpa-manual-override-spacing">
                      <input
                        type="checkbox"
                        id="manual-duration"
                        checked={formData.manual_duration}
                        onChange={(e) => setFormData({ ...formData, manual_duration: e.target.checked })}
                        className="mpa-form-checkbox"
                      />
                      <label htmlFor="manual-duration" className="mpa-checkbox-label">
                        Manual Override
                      </label>
                    </div>
                  </div>
                </div>

                {/* Head Notes */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Notes for Learner (Optional)</label>
                  <textarea
                    className="mpa-form-textarea"
                    placeholder="Add any instructions or notes for the learner..."
                    rows="4"
                    value={formData.head_notes}
                    onChange={(e) => setFormData({ ...formData, head_notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setFormData({
                      learner_ids: [],
                      program_ids: [],
                      extra_content_ids: [],
                      start_date: '',
                      end_date: '',
                      duration_days: '',
                      head_notes: '',
                      manual_duration: false,
                    });
                    setSelectedProgram(null);
                    setSearchExtraContent('');
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gradient">
                  Assign Home Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contents Preview Modal */}
      {showContentsPreviewModal && selectedProgram && (
        <div className="app-modal-overlay">
          <div className="app-modal-container">
            <div className="app-modal-header">
              <h2 className="app-modal-title">Program Contents</h2>
              <button
                type="button"
                onClick={() => setShowContentsPreviewModal(false)}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="app-modal-content">
              <div className="mpa-contents-preview-list">
                {selectedProgram.contents.map((content, index) => (
                  <div key={content.content_id} className="mpa-content-preview-item">
                    <div className="mpa-content-preview-order">{index + 1}</div>
                    {content.thumbnail_url && (
                      <img src={content.thumbnail_url} alt="" className="mpa-content-preview-thumbnail" />
                    )}
                    <div className="mpa-content-preview-info">
                      <div className="mpa-content-preview-title">{content.content_title}</div>
                      <div className="mpa-content-preview-type">{content.content_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="app-modal-footer">
              <button
                onClick={() => setShowContentsPreviewModal(false)}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && editingAssignment && (
        <div className="app-modal-overlay">
          <div className="app-modal-container app-modal-container--lg">
            <div className="app-modal-header app-modal-header--primary">
              <h2 className="app-modal-title">Edit Assignment</h2>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAssignment(null);
                  setFormData({
                    learner_ids: [],
                    program_ids: [],
                    extra_content_ids: [],
                    start_date: '',
                    end_date: '',
                    duration_days: '',
                    head_notes: '',
                    manual_duration: false,
                    assignment_title: '',
                  });
                  setSelectedProgram(null);
                  setSearchExtraContent('');
                }}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="app-modal-content">
                {/* Assignment Title */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">
                    Assignment Title <span className="mpa-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="mpa-form-input"
                    value={formData.assignment_title}
                    onChange={(e) => setFormData({ ...formData, assignment_title: e.target.value })}
                    placeholder="e.g., Ass-1, Module-1, etc."
                  />
                </div>

                {/* Learner Info (Read-only) */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Learner (Read-only)</label>
                  <input
                    type="text"
                    className="mpa-form-input"
                    value={
                      formData.learner_ids.length > 0
                        ? learners.find(l => l.user_id === formData.learner_ids[0])?.name || ''
                        : ''
                    }
                    disabled
                  />
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                    To change learner, delete this assignment and create a new one.
                  </small>
                </div>

                {/* Programs Section */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Programs <span className="mpa-form-required">*</span></label>
                  <div className="mpa-search-box">
                    <input
                      type="text"
                      className="mpa-search-input"
                      placeholder="Search programs..."
                      value={searchProgram}
                      onChange={(e) => setSearchProgram(e.target.value)}
                    />
                  </div>
                  <div className="mpa-checkbox-group">
                    {filteredPrograms.map(program => (
                      <div key={program.id} className="mpa-checkbox-item">
                        <input
                          type="checkbox"
                          id={`prog-${program.id}`}
                          checked={formData.program_ids.includes(program.id)}
                          onChange={() => handleProgramSelect(program.id)}
                        />
                        <label htmlFor={`prog-${program.id}`}>
                          <div className="mpa-checkbox-label-text">
                            <div className="mpa-checkbox-label-title">{program.goal}</div>
                            {program.goal_description && (
                              <div className="mpa-checkbox-label-description">{program.goal_description}</div>
                            )}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.program_ids.length > 0 && (
                    <div className="mpa-selected-items">
                      <small>
                        <strong>Selected: </strong>
                        {formData.program_ids.map(pid => programs.find(p => p.id === pid)?.goal).join(', ')}
                      </small>
                    </div>
                  )}
                </div>

                {/* Extra Content */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Extra Content (Optional)</label>
                  <div className="mpa-search-box">
                    <input
                      type="text"
                      className="mpa-search-input"
                      placeholder="Search additional content..."
                      value={searchExtraContent}
                      onChange={(e) => setSearchExtraContent(e.target.value)}
                    />
                  </div>
                  <div className="mpa-checkbox-group">
                    {allLearningContents
                      .filter(content =>
                        content.title.toLowerCase().includes(searchExtraContent.toLowerCase())
                      )
                      .map(content => (
                        <div key={content.id} className="mpa-checkbox-item">
                          <input
                            type="checkbox"
                            id={`content-${content.id}`}
                            checked={formData.extra_content_ids.includes(parseInt(content.id))}
                            onChange={() => handleExtraContentSelect(content.id)}
                          />
                          <label htmlFor={`content-${content.id}`}>
                            <div className="mpa-checkbox-label-text">
                              <div className="mpa-checkbox-label-title">{content.title}</div>
                              {content.description && (
                                <div className="mpa-checkbox-label-description">{content.description}</div>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Dates and Duration */}
                <div className="mpa-form-row">
                  <div className="mpa-form-field">
                    <label className="mpa-form-label">
                      Start Date <span className="mpa-form-required">*</span>
                    </label>
                    <input
                      type="date"
                      className="mpa-form-input"
                      value={formData.start_date}
                      onChange={(e) => handleDateChange('start_date', e.target.value)}
                    />
                  </div>
                  <div className="mpa-form-field">
                    <label className="mpa-form-label">
                      End Date <span className="mpa-form-required">*</span>
                    </label>
                    <input
                      type="date"
                      className="mpa-form-input"
                      value={formData.end_date}
                      onChange={(e) => handleDateChange('end_date', e.target.value)}
                    />
                  </div>
                </div>

                {/* Duration */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Duration (Days)</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="number"
                      className="mpa-form-input"
                      value={formData.duration_days}
                      onChange={(e) =>
                        setFormData({ ...formData, duration_days: e.target.value, manual_duration: !!e.target.value })
                      }
                      placeholder="Auto-calculated"
                      disabled={!formData.manual_duration}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.manual_duration}
                        onChange={(e) => setFormData({ ...formData, manual_duration: e.target.checked })}
                      />
                      <span>Manual</span>
                    </label>
                  </div>
                </div>

                {/* Head Notes */}
                <div className="mpa-form-field">
                  <label className="mpa-form-label">Head Notes (Optional)</label>
                  <textarea
                    className="mpa-form-textarea"
                    value={formData.head_notes}
                    onChange={(e) => setFormData({ ...formData, head_notes: e.target.value })}
                    placeholder="Add any notes or instructions for the learner..."
                    rows="4"
                  />
                </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAssignment(null);
                    setFormData({
                      learner_ids: [],
                      program_ids: [],
                      extra_content_ids: [],
                      start_date: '',
                      end_date: '',
                      duration_days: '',
                      head_notes: '',
                      manual_duration: false,
                      assignment_title: '',
                    });
                    setSelectedProgram(null);
                    setSearchExtraContent('');
                  }}
                  className="app-modal-btn app-modal-btn--secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="app-modal-btn app-modal-btn--primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && selectedAssignment && (
        <div className="app-modal-overlay">
          <div className="app-modal-container mpa-modal-lg">
            <div className="app-modal-header">
              <h2 className="app-modal-title">Home Program Tracking</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  onClick={handleRefreshTracking}
                  className="app-modal-btn app-modal-btn--secondary"
                  style={{ padding: '6px 12px', fontSize: '0.875rem' }}
                  title="Refresh data"
                >
                  🔄 Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTrackingModal(false);
                    setSelectedAssignment(null);
                    setAttachments([]);
                    setCompletionStats(null);
                    fetchAssignments();
                  }}
                  className="app-modal-close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="app-modal-content">

              {/* Assignment Details */}
              <div className="mpa-assignment-details">
                <h3 className="mpa-section-title">Home Program Details</h3>
                <div className="mpa-details-grid">
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">Home Program Title:</span>
                    <span className="mpa-detail-value">
                      {selectedAssignment?.assignment_title || 'N/A'}
                    </span>
                  </div>
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">Home Programs:</span>
                    <span className="mpa-detail-value">
                      {selectedAssignment?.program_names && selectedAssignment.program_names.length > 0
                        ? selectedAssignment.program_names.join(', ')
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">Status:</span>
                    <span className={`mpa-status-badge ${getStatusColor(selectedAssignment.completion_status)}`}>
                      {getStatusLabel(selectedAssignment.completion_status)}
                    </span>
                  </div>
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">Start Date:</span>
                    <span className="mpa-detail-value">{new Date(selectedAssignment.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">End Date:</span>
                    <span className="mpa-detail-value">{new Date(selectedAssignment.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="mpa-detail-item">
                    <span className="mpa-detail-label">Duration:</span>
                    <span className="mpa-detail-value">{selectedAssignment.duration_days} days</span>
                  </div>
                  {selectedAssignment.completed_at && (
                    <div className="mpa-detail-item">
                      <span className="mpa-detail-label">Completed On:</span>
                      <span className="mpa-detail-value">{new Date(selectedAssignment.completed_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Learning Contents - Both Auto and Manual */}
                {selectedAssignment?.content_assignments && selectedAssignment.content_assignments.length > 0 ? (
                  <div className="mpa-contents-section">
                    <h4 className="mpa-subsection-title">Learning Contents ({selectedAssignment.content_assignments.length})</h4>
                    <div className="mpa-contents-list">
                      {selectedAssignment.content_assignments.map((assignment, index) => (
                        <div key={assignment.id} className="mpa-content-item">
                          <span className="mpa-content-order">{index + 1}</span>
                          {assignment.learning_content?.thumbnail_url && (
                            <img src={assignment.learning_content.thumbnail_url} alt="" className="mpa-content-thumbnail" />
                          )}
                          <div className="mpa-content-info">
                            <div className="mpa-content-title">
                              {assignment.learning_content?.title || 'Untitled Content'}
                            </div>
                            <div className="mpa-content-type">{assignment.learning_content?.content_type || 'N/A'}</div>
                            <div className="mpa-content-meta">
                              {assignment.completion_status === 'SUBMITTED' || assignment.completion_status === 'LATE_SUBMITTED' ? (
                                <button
                                  onClick={() => handleOpenFeedbackModal(assignment)}
                                  className="mpa-btn-primary mpa-btn-sm mpa-btn-feedback"
                                >
                                  💬 Add Feedback
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mpa-contents-section">
                    <h4 className="mpa-subsection-title">Assigned Learning Contents</h4>
                    <div className="mpa-empty-state-sm">
                      <p>No learning contents assigned yet</p>
                    </div>
                  </div>
                )}

                {/* Head Notes */}
                {selectedAssignment.head_notes && (
                  <div className="mpa-notes-section">
                    <h4 className="mpa-subsection-title">Your Notes</h4>
                    <div className="mpa-notes-content">{selectedAssignment.head_notes}</div>
                  </div>
                )}

                {/* Learner Notes (Read-only for Head) */}
                {selectedAssignment.learner_notes && (
                  <div className="mpa-notes-section">
                    <h4 className="mpa-subsection-title">Learner's Notes</h4>
                    <div className="mpa-notes-content">{selectedAssignment.learner_notes}</div>
                  </div>
                )}

                {/* Attachments */}
                <div className="mpa-attachments-section">
                  <h4 className="mpa-subsection-title">Attachments</h4>

                  <div className="mpa-upload-section">
                    <label className="mpa-upload-button">
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf"
                        onChange={handleUploadAttachment}
                        disabled={uploading}
                        className="mpa-hidden-file-input"
                      />
                      <svg className="mpa-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {uploading ? 'Uploading...' : 'Upload Reference Material'}
                    </label>
                    <span className="mpa-upload-hint">Images, Videos, PDFs (Max: 500MB for videos, 50MB for others)</span>
                  </div>

                  {attachments.length === 0 ? (
                    <div className="mpa-empty-state-sm">
                      <p>No attachments yet</p>
                    </div>
                  ) : (
                    <div className="mpa-attachments-grid">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="mpa-attachment-card">
                          {attachment.thumbnail_url && (
                            <img src={attachment.thumbnail_url} alt="" className="mpa-attachment-thumbnail" />
                          )}
                          <div className="mpa-attachment-info">
                            <div className="mpa-attachment-name">{attachment.file_name}</div>
                            <div className="mpa-attachment-meta">
                              <span className="mpa-attachment-type">{attachment.file_type}</span>
                              <span className="mpa-attachment-uploader">by {attachment.uploader_name || 'Unknown'}</span>
                              <span className="mpa-attachment-date">
                                {new Date(attachment.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="mpa-attachment-actions">
                            <a
                              href={attachment.file_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mpa-btn-primary mpa-btn-sm"
                            >
                              View
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="mpa-btn-danger mpa-btn-sm"
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

            </div>

            <div className="app-modal-footer">
              {/* Final Feedback Button - Show for COMPLETED assignments */}
              {selectedAssignment?.completion_status === 'COMPLETED' && (
                <button
                  onClick={handleOpenFinalFeedbackModal}
                  className="app-modal-btn app-modal-btn--primary"
                  style={{ marginRight: 'auto' }}
                >
                  ⭐ {selectedAssignment.final_feedback_rating ? 'Update' : 'Add'} Final Feedback
                </button>
              )}
              <button
                onClick={() => {
                  setShowTrackingModal(false);
                  setSelectedAssignment(null);
                  setAttachments([]);
                  setCompletionStats(null);
                  // Refresh the main list when closing to show updated statuses
                  fetchAssignments();
                }}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && selectedContentAssignment && (
        <div className="app-modal-overlay">
          <div className="app-modal-container mpa-modal-md">
            <div className="app-modal-header">
              <h2 className="app-modal-title">Add Feedback</h2>
              <button
                type="button"
                onClick={handleCloseFeedbackModal}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="app-modal-content">
              {/* Learner Submission Section */}
              {selectedContentAssignment && (
                <div className="mpa-feedback-learner-submission">
                  <h3 className="mpa-subsection-title">Learner Submission</h3>
                  <p className="mpa-text-muted">
                    Submitted on: {new Date(selectedContentAssignment.submitted_at).toLocaleString()}
                  </p>
                  {selectedContentAssignment.learner_notes && (
                    <div className="mpa-learner-notes-box">
                      <h4>Learner Notes:</h4>
                      <p>{selectedContentAssignment.learner_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Star Rating Section */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Rating (1-5 Stars)</label>
                <div className="mpa-star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackData({ ...feedbackData, rating: star })}
                      className={`mpa-star-btn ${feedbackData.rating >= star ? 'mpa-star-active' : ''}`}
                      title={`${star} stars`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                {feedbackData.rating > 0 && <p className="mpa-text-muted">{feedbackData.rating} out of 5 stars</p>}
              </div>

              {/* Remarks Section */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label" htmlFor="feedback_text">
                  Remarks (Optional)
                </label>
                <textarea
                  id="feedback_text"
                  value={feedbackData.feedback_text}
                  onChange={(e) => setFeedbackData({ ...feedbackData, feedback_text: e.target.value })}
                  placeholder="Enter your feedback and remarks..."
                  className="app-modal-form-textarea"
                  rows="5"
                />
              </div>

              {/* Feedback History (if exists) */}
              {selectedContentAssignment.feedback_history && selectedContentAssignment.feedback_history.length > 0 && (
                <div className="mpa-feedback-history-section">
                  <h4 className="mpa-subsection-title">Previous Feedback</h4>
                  {selectedContentAssignment.feedback_history.map((item, index) => (
                    <div key={index} className="mpa-feedback-history-item">
                      <div className="mpa-feedback-history-header">
                        <span className="mpa-feedback-history-rating">⭐ {item.rating}/5</span>
                        <span className="mpa-text-muted">{new Date(item.feedback_given_at).toLocaleString()}</span>
                      </div>
                      {item.feedback_text && <p className="mpa-feedback-history-text">{item.feedback_text}</p>}
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Modal Actions */}
            <div className="app-modal-footer">
              <button
                onClick={handleCloseFeedbackModal}
                className="app-modal-btn app-modal-btn--secondary"
                disabled={feedbackSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="app-modal-btn app-modal-btn--primary"
                disabled={feedbackSubmitting || feedbackData.rating < 1}
              >
                {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Final Feedback Modal */}
      {showFinalFeedbackModal && selectedAssignment && (
        <div className="app-modal-overlay">
          <div className="app-modal-container mpa-modal-md">
            <div className="app-modal-header">
              <h2 className="app-modal-title">⭐ Final Feedback for {selectedAssignment.learner?.name}</h2>
              <button
                type="button"
                onClick={handleCloseFinalFeedbackModal}
                className="app-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="app-modal-content">
              <div className="mpa-feedback-program-info">
                <h3 className="mpa-subsection-title">Program</h3>
                <p className="mpa-text-lg">{selectedAssignment.program?.goal || selectedAssignment.program_name}</p>
                {selectedAssignment.final_feedback_given_at && (
                  <p className="mpa-text-muted">
                    Last updated: {new Date(selectedAssignment.final_feedback_given_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Star Rating Section */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">Rating (1-5 Stars) <span className="text-required">*</span></label>
                <div className="mpa-star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFinalFeedbackData({ ...finalFeedbackData, rating: star })}
                      className={`mpa-star-btn ${finalFeedbackData.rating >= star ? 'mpa-star-active' : ''}`}
                      title={`${star} stars`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                {finalFeedbackData.rating > 0 && <p className="mpa-text-muted">{finalFeedbackData.rating} out of 5 stars</p>}
              </div>

              {/* Remarks Section */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label" htmlFor="final_remarks">
                  Remarks (Optional)
                </label>
                <textarea
                  id="final_remarks"
                  value={finalFeedbackData.remarks}
                  onChange={(e) => setFinalFeedbackData({ ...finalFeedbackData, remarks: e.target.value })}
                  placeholder="Enter your final feedback and remarks about overall performance..."
                  className="app-modal-form-textarea"
                  rows="6"
                />
              </div>

              {/* Status Section */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label" htmlFor="completion_status">
                  Program Status
                </label>
                <select
                  id="completion_status"
                  value={finalFeedbackData.completion_status}
                  onChange={(e) => setFinalFeedbackData({ ...finalFeedbackData, completion_status: e.target.value })}
                  className="app-modal-form-input"
                >
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
                <p className="mpa-text-muted" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                  Select the status to change the learner's program status
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="app-modal-footer">
              <button
                onClick={handleCloseFinalFeedbackModal}
                className="app-modal-btn app-modal-btn--secondary"
                disabled={finalFeedbackSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFinalFeedback}
                className="app-modal-btn app-modal-btn--primary"
                disabled={finalFeedbackSubmitting || finalFeedbackData.rating < 1}
              >
                {finalFeedbackSubmitting ? 'Submitting...' : 'Submit Final Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProgramAssignments;
