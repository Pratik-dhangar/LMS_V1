import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import learningGoalsService from '../../api/services/learningGoalsService';
import learningContentService from '../../api/services/learningContentService';
import programAssignmentService from '../../api/services/programAssignmentService';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Pages.css';

// Sortable Item Component for Drag and Drop
const SortableItem = ({ id, content, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-content-item"
    >
      <div className="sortable-content-drag" {...attributes} {...listeners}>
        <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      {content.thumbnail_url && (
        <img src={content.thumbnail_url} alt="" className="sortable-content-thumbnail" />
      )}
      <div className="sortable-content-info">
        <div className="sortable-content-title">{content.content_title}</div>
        <div className="sortable-content-type">{content.content_type}</div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(content.content_id)}
        className="btn-danger btn-sm"
      >
        Remove
      </button>
    </div>
  );
};

const ManageLearningGoals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [formData, setFormData] = useState({
    goal: '',
    goal_description: '',
    program_type: 'IIP'
  });
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // Content selection states for Add Goal modal
  const [selectedContentsForNewGoal, setSelectedContentsForNewGoal] = useState([]);
  const [availableContentsForNew, setAvailableContentsForNew] = useState([]);
  const [loadingContentsForNew, setLoadingContentsForNew] = useState(false);
  const [searchQueryForNew, setSearchQueryForNew] = useState('');

  // Content preview states
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);

  // Content management modal states
  const [showContentModal, setShowContentModal] = useState(false);
  const [programContents, setProgramContents] = useState([]);
  const [availableContents, setAvailableContents] = useState([]);
  const [selectedContents, setSelectedContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [contentSearchQuery, setContentSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  useEffect(() => {
    fetchGoals();
    fetchAvailableContentsForNewGoal();
  }, []);

  const fetchAvailableContentsForNewGoal = async () => {
    try {
      setLoadingContentsForNew(true);
      const contents = await learningContentService.admin.getAll();
      setAvailableContentsForNew(contents);
    } catch (error) {
      console.error('Error loading available contents:', error);
    } finally {
      setLoadingContentsForNew(false);
    }
  };

  const handleContentToggleForNew = (content) => {
    setSelectedContentsForNewGoal(prev => {
      const exists = prev.find(c => c.id === content.id);
      if (exists) {
        return prev.filter(c => c.id !== content.id);
      } else {
        return [...prev, content];
      }
    });
  };

  const handleViewContent = (content) => {
    console.log('Viewing content:', content); // Debug log
    setPreviewContent(content);
    setShowContentPreview(true);
  };

  const handleClosePreview = () => {
    setShowContentPreview(false);
    setPreviewContent(null);
  };

  const renderContentPreview = () => {
    if (!previewContent) return null;

    const { title, content_type, file_url, description, created_at, created_by_name } = previewContent;
    const contentType = content_type?.toUpperCase();

    // Use file_url as-is if it starts with http, otherwise use it directly (proxy will handle it in dev)
    const fullFileUrl = file_url?.startsWith('http') ? file_url : file_url;

    // Format date
    const formatDate = (dateString) => {
      if (!dateString) return '';
      try {
        return new Date(dateString).toLocaleDateString('en-GB');
      } catch {
        return '';
      }
    };

    return (
      <div className="modal-overlay">
        <div className="content-preview-modal">
          {/* Header with metadata */}
          <div className="content-preview-header">
            <h2 className="content-preview-title">{title}</h2>
            <div className="content-preview-meta">
              <span className="content-type-badge content-type-{contentType?.toLowerCase()}">
                {contentType?.toLowerCase()}
              </span>
              {created_at && (
                <span className="content-date">
                  📅 {formatDate(created_at)}
                </span>
              )}
              {created_by_name && (
                <span className="content-author">
                  👤 {created_by_name}
                </span>
              )}
            </div>
            <div className="content-preview-actions">
              <a
                href={fullFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-external"
                title="Open in new tab"
                {...(contentType === 'VIDEO' && { download: title || 'video' })}
              >
                🔗
              </a>
              <button
                type="button"
                onClick={handleClosePreview}
                className="btn-close-preview"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content display area */}
          <div className="content-preview-body">
            {contentType === 'VIDEO' && (
              <div className="content-video-container">
                <video
                  controls
                  controlsList="nodownload"
                  className="content-preview-media"
                  src={fullFileUrl}
                  preload="metadata"
                  onError={(e) => {
                    console.error('Video load error:', e);
                    console.error('Video URL:', fullFileUrl);
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `
                      <div class="video-error">
                        <div class="error-icon">⚠️</div>
                        <p>Unable to load video</p>
                        <p>URL: ${fullFileUrl}</p>
                        <a href="${fullFileUrl}" target="_blank" class="btn-video-fallback">Try opening video directly</a>
                      </div>
                    `;
                  }}
                  onLoadedMetadata={(e) => {
                    console.log('Video metadata loaded successfully');
                    console.log('Video duration:', e.target.duration);
                  }}
                  onCanPlay={() => console.log('Video can start playing')}
                  onLoadStart={() => console.log('Video loading started')}
                  poster=""
                >
                  <p>Your browser does not support the video tag.</p>
                  <a href={fullFileUrl} target="_blank">Download video file</a>
                </video>
              </div>
            )}

            {contentType === 'IMAGE' && (
              <div className="content-image-container">
                <img
                  src={fullFileUrl}
                  alt={title}
                  className="content-preview-media"
                  onLoad={() => console.log('Image loaded successfully')}
                  onError={(e) => {
                    console.error('Image load error:', e);
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `
                      <div class="content-error">
                        <div class="error-icon">⚠️</div>
                        <p>Unable to load content</p>
                        <a href="${fullFileUrl}" target="_blank">Open in new tab</a>
                      </div>
                    `;
                  }}
                />
              </div>
            )}

            {contentType === 'PDF' && (
              <div className="content-pdf-container">
                <iframe
                  src={fullFileUrl}
                  className="content-preview-media"
                  title={title}
                  onError={(e) => console.error('PDF load error:', e)}
                >
                  Your browser does not support PDFs.
                </iframe>
                <div className="pdf-fallback">
                  <a href={fullFileUrl} target="_blank" rel="noopener noreferrer" className="btn-pdf-download">
                    📄 Open PDF in new tab
                  </a>
                </div>
              </div>
            )}

            {contentType === 'AUDIO' && (
              <div className="content-audio-container">
                <div className="audio-icon">🎵</div>
                <audio
                  controls
                  className="content-preview-media"
                  src={fullFileUrl}
                  onError={(e) => console.error('Audio load error:', e)}
                >
                  Your browser does not support the audio tag.
                </audio>
              </div>
            )}

            {description && (
              <div className="content-description">
                <h4>Description</h4>
                <p>{description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const data = await learningGoalsService.admin.getAll();
      setGoals(data);
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.goal) return toast.error('Goal is required');
    try {
      // Create the goal first
      const newGoal = await learningGoalsService.admin.create(formData);

      // If contents are selected, add them to the program
      if (selectedContentsForNewGoal.length > 0) {
        for (const content of selectedContentsForNewGoal) {
          try {
            await programAssignmentService.addContentToProgram(newGoal.id, content.id);
          } catch (error) {
            console.error('Failed to add content:', content.content_title, error);
          }
        }
        toast.success(`Learning goal created with ${selectedContentsForNewGoal.length} content(s)!`);
      } else {
        toast.success('Learning goal created!');
      }

      setShowAddModal(false);
      setFormData({ goal: '', goal_description: '', program_type: 'IIP' });
      setSelectedContentsForNewGoal([]);
      fetchGoals();
    } catch {
      toast.error('Failed to create learning goal');
    }
  };

  const handleEdit = (goal) => {
    setSelectedGoal(goal);
    setFormData({
      goal: goal.goal,
      goal_description: goal.goal_description || '',
      program_type: goal.program_type || 'IIP'
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await learningGoalsService.admin.update(selectedGoal.id, formData);
      toast.success('Goal updated!');
      setShowEditModal(false);
      setFormData({ goal: '', goal_description: '', program_type: 'IIP' });
      setSelectedGoal(null);
      await fetchGoals();
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

  // Content Management Functions
  const handleManageContents = async (goal) => {
    setSelectedGoal(goal);
    setShowContentModal(true);
    setLoadingContents(true);

    try {
      // Fetch program contents
      const contents = await programAssignmentService.getAdminProgramContents(goal.id);
      setProgramContents(contents);

      // Fetch all available learning contents
      const allContents = await learningContentService.admin.getAll();
      setAvailableContents(allContents);
    } catch (error) {
      toast.error('Failed to load contents');
    } finally {
      setLoadingContents(false);
    }
  };

  const handleAddContents = async () => {
    if (selectedContents.length === 0) {
      return toast.error('Please select at least one content');
    }

    try {
      for (const contentId of selectedContents) {
        await programAssignmentService.addContentToProgram(selectedGoal.id, contentId);
      }
      toast.success(`Added ${selectedContents.length} content(s) to program`);
      setSelectedContents([]);

      // Refresh program contents
      const contents = await programAssignmentService.getAdminProgramContents(selectedGoal.id);
      setProgramContents(contents);
    } catch (error) {
      toast.error('Failed to add contents');
    }
  };

  const handleRemoveContent = async (contentId) => {
    if (!window.confirm('Remove this content from the program?')) return;

    try {
      await programAssignmentService.removeContentFromProgram(selectedGoal.id, contentId);
      toast.success('Content removed from program');

      // Refresh program contents
      const contents = await programAssignmentService.getAdminProgramContents(selectedGoal.id);
      setProgramContents(contents);
    } catch (error) {
      toast.error('Failed to remove content');
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = programContents.findIndex((item) => item.content_id === active.id);
      const newIndex = programContents.findIndex((item) => item.content_id === over.id);

      const newOrder = arrayMove(programContents, oldIndex, newIndex);
      setProgramContents(newOrder);

      // Update sequence order on backend
      try {
        const contentOrders = newOrder.map((item, index) => ({
          content_id: item.content_id,
          sequence_order: index,
        }));

        await programAssignmentService.reorderProgramContents(selectedGoal.id, contentOrders);
        toast.success('Content order updated');
      } catch (error) {
        toast.error('Failed to update order');
        // Revert on error
        const contents = await programAssignmentService.getProgramContents(selectedGoal.id);
        setProgramContents(contents);
      }
    }
  };

  const filteredAvailableContents = availableContents.filter(content =>
    !programContents.some(pc => pc.content_id === content.id) &&
    ((content.content_title || '').toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
      (content.content_type || '').toLowerCase().includes(contentSearchQuery.toLowerCase()))
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
                      <th className="data-table-th">Category</th>
                      <th className="data-table-th">Goal Description</th>
                      <th className="data-table-th data-table-th-center">Contents</th>
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
                          <span className={`status-badge ${goal.program_type === 'HOME' ? 'status-badge-success' : 'status-badge-info'}`}>
                            {goal.program_type || 'IIP'}
                          </span>
                        </td>
                        <td className="data-table-td">
                          <div className="data-table-description">
                            {goal.goal_description || <span className="data-table-empty">No description</span>}
                          </div>
                        </td>
                        <td className="data-table-td data-table-td-center">
                          <button
                            onClick={() => handleManageContents(goal)}
                            className="btn-info btn-sm btn-icon"
                          >
                            <svg className="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Manage
                          </button>
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
                      <div className="flex-1">
                        <h3 className="mobile-card-title">{goal.goal}</h3>
                        <p className="mobile-card-date">
                          {new Date(goal.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`status-badge ${goal.program_type === 'HOME' ? 'status-badge-success' : 'status-badge-info'}`}>
                        {goal.program_type || 'IIP'}
                      </span>
                    </div>

                    {goal.goal_description && (
                      <p className="mobile-card-description">
                        {goal.goal_description}
                      </p>
                    )}

                    <div className="mobile-card-actions">
                      <button
                        onClick={() => handleManageContents(goal)}
                        className="btn-info"
                      >
                        Contents
                      </button>
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
          <div className="modal-content modal-lg">
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
                <label className="form-label">
                  Program Type <span className="form-required">*</span>
                </label>
                <div className="radio-group">
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="type-iip"
                      name="program_type"
                      value="IIP"
                      checked={formData.program_type === 'IIP'}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      className="form-radio"
                    />
                    <label htmlFor="type-iip" className="radio-label">IIP (Program)</label>
                  </div>
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="type-home"
                      name="program_type"
                      value="HOME"
                      checked={formData.program_type === 'HOME'}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      className="form-radio"
                    />
                    <label htmlFor="type-home" className="radio-label">Home Program</label>
                  </div>
                </div>
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

              {/* Content Selection Section */}
              <div className="form-field">
                <label className="form-label">
                  Learning Contents (Optional)
                  <span className="form-hint">({selectedContentsForNewGoal.length} selected)</span>
                </label>

                {/* Search Bar */}
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search learning contents..."
                    value={searchQueryForNew}
                    onChange={(e) => setSearchQueryForNew(e.target.value)}
                    className="search-input"
                  />
                </div>

                {loadingContentsForNew ? (
                  <div className="loading-small">Loading contents...</div>
                ) : (
                  <div className="content-selection-grid">
                    {availableContentsForNew
                      .filter(content =>
                        content.title?.toLowerCase().includes(searchQueryForNew.toLowerCase()) ||
                        content.content_type?.toLowerCase().includes(searchQueryForNew.toLowerCase()) ||
                        content.description?.toLowerCase().includes(searchQueryForNew.toLowerCase())
                      )
                      .map(content => (
                        <div key={content.id} className="content-item-checkbox">
                          <input
                            type="checkbox"
                            id={`new-content-${content.id}`}
                            checked={selectedContentsForNewGoal.some(c => c.id === content.id)}
                            onChange={() => handleContentToggleForNew(content)}
                            className="form-checkbox"
                          />
                          <label htmlFor={`new-content-${content.id}`} className="content-selection-label">
                            {content.thumbnail_url && (
                              <img src={content.thumbnail_url} alt="" className="content-selection-thumbnail" />
                            )}
                            <div className="content-selection-info">
                              <div className="content-selection-title">
                                {content.title || `Content #${content.id}`}
                              </div>
                              <div className="content-selection-type">{content.content_type}</div>
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleViewContent(content)}
                            className="btn-view-content"
                            title="Preview content"
                          >
                            👁️ View
                          </button>
                        </div>
                      ))}
                    {availableContentsForNew.filter(content =>
                      content.title?.toLowerCase().includes(searchQueryForNew.toLowerCase()) ||
                      content.content_type?.toLowerCase().includes(searchQueryForNew.toLowerCase()) ||
                      content.description?.toLowerCase().includes(searchQueryForNew.toLowerCase())
                    ).length === 0 && searchQueryForNew && (
                        <div className="no-results">No contents found matching your search.</div>
                      )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ goal: '', goal_description: '', program_type: 'IIP' });
                    setSelectedContentsForNewGoal([]);
                    setSearchQueryForNew('');
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
                <label className="form-label">
                  Program Type <span className="form-required">*</span>
                </label>
                <div className="radio-group">
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="edit-type-iip"
                      name="edit_program_type"
                      value="IIP"
                      checked={formData.program_type === 'IIP'}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      className="form-radio"
                    />
                    <label htmlFor="edit-type-iip" className="radio-label">IIP (Program)</label>
                  </div>
                  <div className="radio-item">
                    <input
                      type="radio"
                      id="edit-type-home"
                      name="edit_program_type"
                      value="HOME"
                      checked={formData.program_type === 'HOME'}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      className="form-radio"
                    />
                    <label htmlFor="edit-type-home" className="radio-label">Home Program</label>
                  </div>
                </div>
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
                    setFormData({ goal: '', goal_description: '', program_type: 'IIP' });
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

      {/* Content Management Modal */}
      {showContentModal && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">
              Manage Contents for "{selectedGoal?.goal}"
            </h2>

            {loadingContents ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <div className="content-management-container">
                {/* Current Program Contents with Drag & Drop */}
                <div className="content-section">
                  <h3 className="content-section-title">
                    Current Contents ({programContents.length})
                  </h3>

                  {programContents.length === 0 ? (
                    <div className="empty-state-sm">
                      <p>No contents assigned to this program yet</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={programContents.map(c => c.content_id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="sortable-list">
                          {programContents.map((content) => (
                            <SortableItem
                              key={content.content_id}
                              id={content.content_id}
                              content={content}
                              onRemove={handleRemoveContent}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Add New Contents */}
                <div className="content-section">
                  <h3 className="content-section-title">Add New Contents</h3>

                  <div className="form-field">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search contents..."
                      value={contentSearchQuery}
                      onChange={(e) => setContentSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="content-selection-list">
                    {filteredAvailableContents.length === 0 ? (
                      <div className="empty-state-sm">
                        <p>
                          {contentSearchQuery
                            ? 'No contents match your search'
                            : 'All contents have been added to this program'}
                        </p>
                      </div>
                    ) : (
                      filteredAvailableContents.map((content) => (
                        <div key={content.id} className="content-selection-item">
                          <input
                            type="checkbox"
                            id={`content-${content.id}`}
                            checked={selectedContents.includes(content.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContents([...selectedContents, content.id]);
                              } else {
                                setSelectedContents(selectedContents.filter(id => id !== content.id));
                              }
                            }}
                            className="form-checkbox"
                          />
                          <label htmlFor={`content-${content.id}`} className="content-selection-label">
                            {content.thumbnail_url && (
                              <img src={content.thumbnail_url} alt="" className="content-selection-thumbnail" />
                            )}
                            <div className="content-selection-info">
                              <div className="content-selection-title">
                                {content.title || `Content #${content.id}`}
                              </div>
                              <div className="content-selection-type">{content.content_type}</div>
                            </div>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleViewContent(content)}
                            className="btn-view-content"
                            title="Preview content"
                          >
                            👁️ View
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {selectedContents.length > 0 && (
                    <button
                      onClick={handleAddContents}
                      className="btn-success btn-full"
                    >
                      Add {selectedContents.length} Content(s) to Program
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowContentModal(false);
                  setProgramContents([]);
                  setSelectedContents([]);
                  setContentSearchQuery('');
                }}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Preview Modal */}
      {showContentPreview && renderContentPreview()}
    </div>
  );
};

export default ManageLearningGoals;
