import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { toast } from "react-toastify";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import programAssignmentService from "../../api/services/programAssignmentService";
import '../../styles/Pages.css';

const ViewAssignedPrograms = () => {
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [learnerNotes, setLearnerNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssignments();
    fetchStats();
  }, []);

  useEffect(() => {
    if (filterStatus !== '') {
      fetchAssignments();
    }
  }, [filterStatus]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const data = await programAssignmentService.getMyAssignments(filterStatus || null);
      setAssignments(data);
    } catch (error) {
      toast.error("Failed to load assigned programs");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await programAssignmentService.getMyStats();
      setStats(statsData);
    } catch (error) {
      console.error("Failed to load stats", error);
    }
  };

  const handleViewDetails = async (assignment) => {
    try {
      const details = await programAssignmentService.getMyAssignmentById(assignment.id);
      const attachmentsData = await programAssignmentService.getAttachments(assignment.id);

      setSelectedAssignment(details);
      setLearnerNotes(details.learner_notes || '');
      setAttachments(attachmentsData);
      setShowDetailModal(true);
    } catch (error) {
      toast.error("Failed to load assignment details");
    }
  };

  const handleSaveNotes = async () => {
    try {
      await programAssignmentService.updateMyAssignment(selectedAssignment.id, {
        learner_notes: learnerNotes,
      });
      toast.success("Notes saved successfully");

      // Refresh assignment details
      const details = await programAssignmentService.getMyAssignmentById(selectedAssignment.id);
      setSelectedAssignment(details);
    } catch (error) {
      toast.error("Failed to save notes");
    }
  };

  const handleMarkComplete = async () => {
    if (!window.confirm("Mark this assignment as complete?")) return;

    try {
      await programAssignmentService.markComplete(selectedAssignment.id);
      toast.success("Assignment marked as complete!");

      // Refresh data
      fetchAssignments();
      fetchStats();

      const details = await programAssignmentService.getMyAssignmentById(selectedAssignment.id);
      setSelectedAssignment(details);
    } catch (error) {
      toast.error("Failed to mark as complete");
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
      await programAssignmentService.uploadMyAttachment(selectedAssignment.id, file);
      toast.success('File uploaded successfully');

      // Refresh attachments
      const attachmentsData = await programAssignmentService.getAttachments(selectedAssignment.id);
      setAttachments(attachmentsData);
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = '';
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

  const getProgressPercentage = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 100;
      case 'IN_PROGRESS':
        return 50;
      case 'NOT_STARTED':
        return 0;
      default:
        return 0;
    }
  };

  return (
    <div className="page-container">
      <Navbar />

      <main className="page-main">
        <div className="page-content">
          {/* Header with Stats */}
          <div className="page-header">
            <div>
              <h1 className="page-title">My Learning Programs</h1>
              <p className="page-description">View your assigned programs and track your progress</p>
            </div>
            {stats && (
              <div className="stats-summary">
                <div className="stat-compact">
                  <span className="stat-compact-value">{stats.completion_percentage}%</span>
                  <span className="stat-compact-label">Complete</span>
                </div>
                <div className="stat-compact">
                  <span className="stat-compact-value">{stats.completed}/{stats.total_assignments}</span>
                  <span className="stat-compact-label">Programs</span>
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="filters-section">
            <div className="filters-group">
              <button
                onClick={() => {
                  setFilterStatus('');
                  fetchAssignments();
                }}
                className={`filter-btn ${filterStatus === '' ? 'filter-btn-active' : ''}`}
              >
                All ({stats?.total_assignments || 0})
              </button>
              <button
                onClick={() => setFilterStatus('NOT_STARTED')}
                className={`filter-btn ${filterStatus === 'NOT_STARTED' ? 'filter-btn-active' : ''}`}
              >
                Not Started ({stats?.not_started || 0})
              </button>
              <button
                onClick={() => setFilterStatus('IN_PROGRESS')}
                className={`filter-btn ${filterStatus === 'IN_PROGRESS' ? 'filter-btn-active' : ''}`}
              >
                In Progress ({stats?.in_progress || 0})
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`filter-btn ${filterStatus === 'COMPLETED' ? 'filter-btn-active' : ''}`}
              >
                Completed ({stats?.completed || 0})
              </button>
            </div>
          </div>

          {/* Assignments Grid */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-description">
                {filterStatus ? 'No programs with this status' : 'No learning programs assigned yet.'}
              </p>
            </div>
          ) : (
            <div className="cards-grid">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="program-assignment-card">
                  <div className="card-header">
                    <div className="card-badge">#{assignment.program_id}</div>
                    <span className={`status-badge ${getStatusColor(assignment.completion_status)}`}>
                      {getStatusLabel(assignment.completion_status)}
                    </span>
                  </div>

                  <h3 className="card-title">{assignment.program_name}</h3>

                  <div className="card-info">
                    <div className="info-row">
                      <span className="info-label">Start Date:</span>
                      <span className="info-value">{new Date(assignment.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">End Date:</span>
                      <span className="info-value">{new Date(assignment.end_date).toLocaleDateString()}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Duration:</span>
                      <span className="info-value">{assignment.duration_days} days</span>
                    </div>
                  </div>

                  <div className="progress-section">
                    <div className="progress-label">Progress</div>
                    <div className="progress-bar-container">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${getProgressPercentage(assignment.completion_status)}%` }}
                      />
                    </div>
                    <div className="progress-percentage">{getProgressPercentage(assignment.completion_status)}%</div>
                  </div>

                  <button
                    onClick={() => navigate(`/learner/program-assignment/${assignment.id}`)}
                    className="btn-primary btn-full"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Assignment Detail Modal */}
      {showDetailModal && selectedAssignment && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">{selectedAssignment.program.goal}</h2>

            {/* Tabs */}
            <div className="tabs-container">
              <div className="tabs">
                <button className="tab-btn tab-btn-active">Overview</button>
              </div>

              <div className="tab-content">
                {/* Program Info */}
                <div className="assignment-details">
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Program ID:</span>
                      <span className="detail-value">{selectedAssignment.program_id}</span>
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
                        <span className="detail-label">Completed:</span>
                        <span className="detail-value">{new Date(selectedAssignment.completed_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {selectedAssignment.program.goal_description && (
                    <div className="description-section">
                      <h4 className="subsection-title">Description</h4>
                      <p className="description-text">{selectedAssignment.program.goal_description}</p>
                    </div>
                  )}

                  {/* Learning Contents */}
                  {selectedAssignment.program.contents && selectedAssignment.program.contents.length > 0 && (
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
                      <h4 className="subsection-title">Instructions from Head</h4>
                      <div className="notes-content notes-readonly">{selectedAssignment.head_notes}</div>
                    </div>
                  )}

                  {/* My Notes */}
                  <div className="notes-section">
                    <h4 className="subsection-title">My Notes</h4>
                    <textarea
                      className="form-textarea"
                      placeholder="Add your notes here..."
                      rows="4"
                      value={learnerNotes}
                      onChange={(e) => setLearnerNotes(e.target.value)}
                      disabled={selectedAssignment.completion_status === 'COMPLETED'}
                    />
                    {selectedAssignment.completion_status !== 'COMPLETED' && (
                      <button
                        onClick={handleSaveNotes}
                        className="btn-primary btn-sm"
                        style={{ marginTop: '0.5rem' }}
                      >
                        Save Notes
                      </button>
                    )}
                  </div>

                  {/* File Upload */}
                  <div className="attachments-section">
                    <h4 className="subsection-title">My Work</h4>

                    {selectedAssignment.completion_status !== 'COMPLETED' && (
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
                          {uploading ? 'Uploading...' : 'Upload File'}
                        </label>
                        <span className="upload-hint">Images, Videos, PDFs (Max: 500MB for videos, 50MB for others)</span>
                      </div>
                    )}

                    {attachments.length === 0 ? (
                      <div className="empty-state-sm">
                        <p>No files uploaded yet</p>
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
                                <span className="attachment-uploader">by {attachment.uploader_name || 'You'}</span>
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mark Complete Button */}
                  {selectedAssignment.completion_status !== 'COMPLETED' && (
                    <div className="action-section">
                      <button
                        onClick={handleMarkComplete}
                        className="btn-success btn-full"
                      >
                        Mark as Complete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAssignment(null);
                  setLearnerNotes('');
                  setAttachments([]);
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

export default ViewAssignedPrograms;
