import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import learningGoalsService from "../../api/services/learningGoalsService";
import { useNavigate } from "react-router-dom";
import headService from "../../api/services/headService";
import sessionService from "../../api/services/sessionService";
import learningContentService from "../../api/services/learningContentService";
import programService from "../../api/services/programService";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Table.css";
import "../../styles/head/ScheduleSession.css";

const ScheduleSession = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [learners, setLearners] = useState([]);
  const [contents, setContents] = useState([]);
  const [learningGoals, setLearningGoals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Program state
  const [programList, setProgramList] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [programMode, setProgramMode] = useState('none'); // 'none' | 'existing' | 'new'
  const [programSearch, setProgramSearch] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramDescription, setNewProgramDescription] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [programDropdownOpen, setProgramDropdownOpen] = useState(false);
  const programDropdownRef = useRef(null);
  const contentSentinelRef = useRef(null);
  const CONTENT_PAGE_SIZE = 12;
  const [contentVisibleCount, setContentVisibleCount] = useState(CONTENT_PAGE_SIZE);

  const [formData, setFormData] = useState({
    title: "",
    trainer_id: "",
    learner_id: "",
    scheduled_date: "",
    duration: "",
    content_ids: [],
    goal_ids: [],
  });

  const [searchTerm, setSearchTerm] = useState({
    trainer: "",
    learner: "",
    goal: "",
    content: "",
  });

  const [showDropdown, setShowDropdown] = useState({
    trainer: false,
    learner: false,
  });

  const trainerDropdownRef = useRef(null);
  const learnerDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        trainerDropdownRef.current &&
        !trainerDropdownRef.current.contains(event.target)
      ) {
        setShowDropdown((prev) => ({ ...prev, trainer: false }));
      }
      if (
        learnerDropdownRef.current &&
        !learnerDropdownRef.current.contains(event.target)
      ) {
        setShowDropdown((prev) => ({ ...prev, learner: false }));
      }
      if (
        programDropdownRef.current &&
        !programDropdownRef.current.contains(event.target)
      ) {
        setProgramDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  // Reset visible count when content search or program selection changes
  useEffect(() => {
    setContentVisibleCount(CONTENT_PAGE_SIZE);
  }, [searchTerm.content, selectedProgramId]);

  // IntersectionObserver for lazy loading content grid
  useEffect(() => {
    const sentinel = contentSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setContentVisibleCount((prev) => prev + CONTENT_PAGE_SIZE);
        }
      },
      { rootMargin: '150px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [contentVisibleCount]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [trainersData, learnersData, contentsData, goalsData] =
        await Promise.all([
          headService.getAllTrainers(),
          headService.getLearnersForSessionScheduling(), // Fetch learners with subscription and status info
          learningContentService.head.getAll(),
          learningGoalsService.head.getAll(),
        ]);
      setTrainers(trainersData);
      setLearners(learnersData);
      setContents(contentsData);
      setLearningGoals(goalsData);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoadingData(false);
    }
  };

  // Toggle learning goal selection
  const handleGoalToggle = (goalId) => {
    setFormData((prev) => {
      const newGoalIds = prev.goal_ids.includes(goalId)
        ? prev.goal_ids.filter((id) => id !== goalId)
        : [...prev.goal_ids, goalId];
      return {
        ...prev,
        goal_ids: newGoalIds,
      };
    });
  };

  const handleContentToggle = (contentId) => {
    setFormData((prev) => {
      const newContentIds = prev.content_ids.includes(contentId)
        ? prev.content_ids.filter((id) => id !== contentId)
        : [...prev.content_ids, contentId];
      return {
        ...prev,
        content_ids: newContentIds,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.title ||
      !formData.trainer_id ||
      !formData.learner_id ||
      !formData.scheduled_date ||
      !formData.duration
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate scheduled_date
    const dateObj = new Date(formData.scheduled_date);
    if (isNaN(dateObj.getTime())) {
      toast.error("Please select a valid date and time.");
      return;
    }

    const scheduled_date = formData.scheduled_date + ":00";

    const sessionPayload = {
      ...formData,
      trainer_id: parseInt(formData.trainer_id),
      learner_id: parseInt(formData.learner_id),
      scheduled_date,
      duration: parseInt(formData.duration),
      content_ids: formData.content_ids.map(Number),
      goal_ids: formData.goal_ids.map(Number),
      ...(selectedProgramId ? { program_id: selectedProgramId } : {}),
    };

    try {
      setLoading(true);
      await sessionService.createSession(sessionPayload);
      toast.success("Session scheduled successfully!");
      navigate("/head/manage-sessions");
    } catch (error) {
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          const errorMessages = error.response.data.detail
            .map((err) => `${err.loc.join(".")}: ${err.msg}`)
            .join(", ");
          toast.error(`Validation error: ${errorMessages}`);
        } else {
          toast.error(error.response.data.detail);
        }
      } else {
        toast.error("Failed to schedule session");
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredTrainers = trainers.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchTerm.trainer.toLowerCase()) ||
      t.user_id?.toString().includes(searchTerm.trainer)
  );

  const filteredLearners = learners.filter(
    (l) =>
      l.name?.toLowerCase().includes(searchTerm.learner.toLowerCase()) ||
      l.id?.toString().includes(searchTerm.learner)
  );

  const filteredGoals = learningGoals.filter(
    (goal) =>
      goal.goal?.toLowerCase().includes(searchTerm.goal.toLowerCase()) ||
      goal.goal_description
        ?.toLowerCase()
        .includes(searchTerm.goal.toLowerCase())
  );

  const filteredContents = contents.filter(
    (content) =>
      content.title?.toLowerCase().includes(searchTerm.content.toLowerCase()) ||
      content.content_type
        ?.toLowerCase()
        .includes(searchTerm.content.toLowerCase())
  );

  // Programs filtered by search inside the dropdown
  const filteredPrograms = programList.filter((p) =>
    p.name?.toLowerCase().includes(programSearch.toLowerCase())
  );

  // The currently selected program object (for resolving goal names)
  const selectedProgram = selectedProgramId
    ? programList.find((p) => p.id === selectedProgramId) || null
    : null;

  // Goals resolved for read-only display when a program is active
  const lockedGoals = selectedProgram
    ? learningGoals.filter((g) => (selectedProgram.goal_ids || []).includes(g.id))
    : [];

  const getSelectedTrainerName = () => {
    const trainer = trainers.find(
      (t) => t.user_id === parseInt(formData.trainer_id)
    );
    return trainer ? `${trainer.name} (ID: ${trainer.user_id})` : "";
  };

  const getSelectedLearnerName = () => {
    const learner = learners.find(
      (l) => l.id === parseInt(formData.learner_id)
    );
    return learner
      ? `${learner.name} (ID: ${learner.id}) - ${learner.remaining_sessions} sessions - ${learner.status_text}`
      : "";
  };

  const handleTrainerSelect = (trainerId) => {
    setFormData({ ...formData, trainer_id: trainerId });
    setShowDropdown({ ...showDropdown, trainer: false });
    setSearchTerm({ ...searchTerm, trainer: "" });
  };

  const handleLearnerSelect = (learnerId) => {
    setFormData({ ...formData, learner_id: learnerId, goal_ids: [], content_ids: [] });
    setShowDropdown({ ...showDropdown, learner: false });
    setSearchTerm({ ...searchTerm, learner: "" });
    // Reset program state
    setSelectedProgramId(null);
    setProgramMode('none');
    setProgramList([]);
    setProgramSearch('');
    // Fetch programs for this learner
    fetchProgramsForLearner(learnerId);
  };

  const fetchProgramsForLearner = async (learnerId) => {
    if (!learnerId) return;
    try {
      setLoadingPrograms(true);
      const programs = await programService.getPrograms(learnerId);
      setProgramList(programs || []);
    } catch {
      // Non-fatal — programs are optional
    } finally {
      setLoadingPrograms(false);
    }
  };

  const handleProgramModeChange = (mode) => {
    setProgramMode(mode);
    if (mode !== 'existing') {
      setSelectedProgramId(null);
      setProgramSearch('');
      setFormData(prev => ({ ...prev, goal_ids: [], content_ids: [] }));
    }
  };

  const handleSelectExistingProgram = async (program) => {
    setSelectedProgramId(program.id);
    setProgramSearch(program.name);
    setProgramDropdownOpen(false);
    // Auto-populate goals (locked) and content (editable default)
    setFormData(prev => ({
      ...prev,
      goal_ids: program.goal_ids || [],
      content_ids: program.content_ids || [],
    }));
  };

  const handleCreateNewProgram = async () => {
    if (!newProgramName.trim()) {
      toast.error('Please enter a program name');
      return;
    }
    if (!formData.learner_id) {
      toast.error('Please select a learner first');
      return;
    }
    if (formData.goal_ids.length === 0) {
      toast.error('Please select at least one learning goal before creating a program');
      return;
    }
    if (formData.content_ids.length === 0) {
      toast.error('Please select at least one learning content before creating a program');
      return;
    }
    try {
      setCreatingProgram(true);
      const created = await programService.createProgram({
        name: newProgramName.trim(),
        description: newProgramDescription.trim() || null,
        learner_id: parseInt(formData.learner_id),
        goal_ids: formData.goal_ids,
        content_ids: formData.content_ids,
      });
      toast.success(`Program "${created.name}" created successfully`);
      setSelectedProgramId(created.id);
      setProgramMode('existing');
      setProgramSearch(created.name);
      setNewProgramName('');
      setNewProgramDescription('');
      // Refresh program list
      fetchProgramsForLearner(formData.learner_id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create program');
    } finally {
      setCreatingProgram(false);
    }
  };

  // State to hold the unconfirmed date/time from the input
  const [tempDate, setTempDate] = useState(formData.scheduled_date || "");

  // Handler for the "Set" button
  const handleSetDate = () => {
    // Commit the temporary date to the main form state
    setFormData({ ...formData, scheduled_date: tempDate });
    // You could also add a console.log or alert here for confirmation
    console.log("Date set:", tempDate);
  };

  // When an existing program is selected, bubble its goals/content to the top
  const sortedFilteredGoals = selectedProgramId
    ? [
      ...filteredGoals.filter((g) => formData.goal_ids.includes(g.id)),
      ...filteredGoals.filter((g) => !formData.goal_ids.includes(g.id)),
    ]
    : filteredGoals;

  const sortedFilteredContents = selectedProgramId
    ? [
      ...filteredContents.filter((c) => formData.content_ids.includes(c.id)),
      ...filteredContents.filter((c) => !formData.content_ids.includes(c.id)),
    ]
    : filteredContents;

  if (loadingData) {
    return (
      <>
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </>
    );
  }

  return (
    <div className="page-container schedule-session">
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={() => navigate("/head/manage-sessions")}
              className="back-button"
            >
              <svg
                className="back-icon"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Manage Sessions
            </button>
            <div>
              <h1 className="page-title">Schedule Training Session</h1>
              <p className="page-description">
                Create new training sessions
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="modern-form-card">
            {/* Trainer & Learner Selection */}
            <div className="modern-form-section">
              <div className="modern-form-grid-two-col">
                {/* Select Trainer with Searchable Dropdown */}
                <div className="dropdown-field" ref={trainerDropdownRef}>
                  <label className="modern-form-label">
                    Select Trainer <span className="required-indicator">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search trainer by name or ID..."
                    value={
                      formData.trainer_id
                        ? getSelectedTrainerName()
                        : searchTerm.trainer
                    }
                    onChange={(e) => {
                      // Clear selection when user starts typing
                      if (formData.trainer_id) {
                        setFormData({ ...formData, trainer_id: "" });
                      }
                      setSearchTerm({ ...searchTerm, trainer: e.target.value });
                      setShowDropdown({ ...showDropdown, trainer: true });
                    }}
                    onFocus={() =>
                      setShowDropdown({ ...showDropdown, trainer: true })
                    }
                    className="modern-form-input"
                    required={!formData.trainer_id}
                  />
                  {showDropdown.trainer && (
                    <div className="dropdown-menu">
                      {filteredTrainers.length > 0 ? (
                        filteredTrainers.map((trainer) => (
                          <div
                            key={trainer.id}
                            onClick={() => handleTrainerSelect(trainer.user_id)}
                            className={`dropdown-item ${formData.trainer_id === trainer.user_id
                              ? "dropdown-item-selected"
                              : ""
                              }`}
                          >
                            {trainer.name}{" "}
                            <span className="dropdown-item-meta">
                              (ID: {trainer.user_id})
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="dropdown-item dropdown-item-empty">
                          No trainers found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Select Learner with Searchable Dropdown */}
                <div className="dropdown-field" ref={learnerDropdownRef}>
                  <label className="modern-form-label">
                    Select Learner <span className="required-indicator">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Search learner by name or ID..."
                    value={
                      formData.learner_id
                        ? getSelectedLearnerName()
                        : searchTerm.learner
                    }
                    onChange={(e) => {
                      // Clear selection when user starts typing
                      if (formData.learner_id) {
                        setFormData({ ...formData, learner_id: "" });
                      }
                      setSearchTerm({ ...searchTerm, learner: e.target.value });
                      setShowDropdown({ ...showDropdown, learner: true });
                    }}
                    onFocus={() =>
                      setShowDropdown({ ...showDropdown, learner: true })
                    }
                    className="modern-form-input"
                    required={!formData.learner_id}
                  />
                  {showDropdown.learner && (
                    <div className="dropdown-menu">
                      {filteredLearners.length > 0 ? (
                        filteredLearners.map((learner) => (
                          <div
                            key={learner.id}
                            onClick={() => {
                              // Only allow selection if learner can be scheduled
                              if (learner.can_schedule) {
                                handleLearnerSelect(learner.id);
                              }
                            }}
                            className={`dropdown-item ${formData.learner_id === learner.id
                              ? "dropdown-item-selected"
                              : ""
                              } ${!learner.can_schedule ? "dropdown-item-disabled" : ""}`}
                          >
                            {learner.name}{" "}
                            <span className="dropdown-item-meta">
                              - {learner.remaining_sessions} sessions - {learner.status_text}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="dropdown-item dropdown-item-empty">
                          No learners found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="modern-form-section">
              <div className="modern-form-grid">

                {/* Session Title */}
                <div className="modern-form-grid-full">
                  <label className="modern-form-label">
                    Learning Program name <span className="required-indicator">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="modern-form-input"
                    placeholder="e.g., Introduction to Fruits"
                    required
                  />
                </div>

              </div>
            </div>



            {/* Date & Time and Duration */}
            <div className="modern-form-section">
              <div className="modern-form-grid-two-col">
                {/* Date & Time */}
                <div>
                  <label className="modern-form-label">
                    Date & Time <span className="required-indicator">*</span>
                  </label>

                  {/* Flex container to hold input and button */}
                  <div className="input-group">
                    <input
                      type="datetime-local"
                      value={tempDate}
                      onChange={(e) => setTempDate(e.target.value)}
                      className="modern-form-input"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSetDate}
                      className="modern-form-btn modern-form-btn-primary"
                    >
                      Set
                    </button>
                  </div>

                  {/* Optional: Show the user what date is currently *confirmed* */}
                  {formData.scheduled_date && (
                    <p className="modern-form-helper-text">
                      Confirmed time:{" "}
                      {new Date(formData.scheduled_date).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="modern-form-label">
                    Duration (minutes) <span className="required-indicator">*</span>
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    className="modern-form-select"
                    required
                  >
                    <option value="">-- Select Duration --</option>
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                    <option value="120">120 minutes</option>
                    <option value="150">150 minutes</option>
                    <option value="180">180 minutes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Select Program — parent section containing goals + content */}
            <div className="modern-form-section">
              <h2 className="modern-form-section-title">Select Program</h2>
              <p className="modern-form-section-description">
                Link this session to a program to reuse saved goals and content, or skip to
                select goals/content directly.
              </p>

              {/* Program mode switcher */}
              {formData.learner_id && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleProgramModeChange('none')}
                    className={`modern-form-btn ${programMode === 'none'
                      ? 'modern-form-btn-primary'
                      : 'modern-form-btn-secondary'
                      }`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                  >
                    No Program
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProgramModeChange('existing')}
                    className={`modern-form-btn ${programMode === 'existing'
                      ? 'modern-form-btn-primary'
                      : 'modern-form-btn-secondary'
                      }`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                  >
                    Select Existing Program
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProgramModeChange('new')}
                    className={`modern-form-btn ${programMode === 'new'
                      ? 'modern-form-btn-primary'
                      : 'modern-form-btn-secondary'
                      }`}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}
                  >
                    + Create New Program
                  </button>
                </div>
              )}

              {/* Existing program picker */}
              {programMode === 'existing' && (
                <div ref={programDropdownRef} className="dropdown-field" style={{ marginBottom: '1rem' }}>
                  {loadingPrograms ? (
                    <p className="modern-form-section-description">Loading programs...</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Search programs..."
                        value={programSearch}
                        onChange={(e) => {
                          setProgramSearch(e.target.value);
                          setSelectedProgramId(null);
                          setProgramDropdownOpen(true);
                          setFormData(prev => ({ ...prev, goal_ids: [], content_ids: [] }));
                        }}
                        onFocus={() => setProgramDropdownOpen(true)}
                        className="modern-form-input"
                      />
                      {programDropdownOpen && (
                        <div className="dropdown-menu">
                          {filteredPrograms.length > 0 ? (
                            filteredPrograms.map((prog) => (
                              <div
                                key={prog.id}
                                onClick={() => handleSelectExistingProgram(prog)}
                                className={`dropdown-item ${selectedProgramId === prog.id ? 'dropdown-item-selected' : ''
                                  }`}
                              >
                                {prog.name}
                                <span className="dropdown-item-meta">
                                  &nbsp;— {(prog.goal_ids || []).length} goal(s), {(prog.content_ids || []).length} content(s)
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="dropdown-item dropdown-item-empty">
                              {programList.length === 0
                                ? 'No programs found for this learner'
                                : 'No programs match your search'}
                            </div>
                          )}
                        </div>
                      )}
                      {selectedProgram && (
                        <p className="modern-form-section-description" style={{ marginTop: '0.4rem' }}>
                          ✅ Program &quot;<strong>{selectedProgram.name}</strong>&quot; selected —
                          goals are pre-loaded (locked) and content is pre-selected (editable).
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Create new program inline form */}
              {programMode === 'new' && (
                <div
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    background: '#f9fafb',
                  }}
                >
                  <p className="modern-form-section-description" style={{ marginBottom: '0.75rem' }}>
                    Select the goals and content below first, then click <strong>Create Program</strong>.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="modern-form-label">Program Name *</label>
                      <input
                        type="text"
                        value={newProgramName}
                        onChange={(e) => setNewProgramName(e.target.value)}
                        className="modern-form-input"
                        placeholder="e.g. Program-A"
                      />
                    </div>
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="modern-form-label">Description</label>
                      <input
                        type="text"
                        value={newProgramDescription}
                        onChange={(e) => setNewProgramDescription(e.target.value)}
                        className="modern-form-input"
                        placeholder="Optional description"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateNewProgram}
                      className="modern-form-btn modern-form-btn-primary"
                      disabled={creatingProgram}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {creatingProgram ? 'Creating...' : 'Create Program'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SELECT LEARNING GOALS (child) ─────────────────────────────── */}
              <div className="modern-form-section" style={{ marginTop: '1.5rem' }}>
                <h2 className="modern-form-section-title">Select Learning Goals</h2>

                <>
                  {selectedProgramId ? (
                    <p className="modern-form-section-description" style={{ marginBottom: '0.75rem' }}>
                      Goals are pre-loaded from program &quot;<strong>{selectedProgram?.name}</strong>&quot; and can be edited.
                    </p>
                  ) : (
                    <p className="modern-form-section-description">
                      Choose learning goals for this session (optional)
                    </p>
                  )}
                  <div>
                    <div className="search-container">
                      <Search className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search goals by name or description..."
                        value={searchTerm.goal}
                        onChange={(e) =>
                          setSearchTerm({ ...searchTerm, goal: e.target.value })
                        }
                        className="search-input"
                      />
                      {searchTerm.goal && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm({ ...searchTerm, goal: "" })}
                          className="search-clear"
                          aria-label="Clear goal search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {learningGoals.length === 0 ? (
                      <p className="empty-state">No learning goals available</p>
                    ) : (
                      <div className="table-primary-container">
                        <div className="table-primary-wrapper">
                          <table className="table-primary">
                            <thead className="table-primary-header">
                              <tr>
                                <th className="table-primary-th table-primary-th-center" style={{ width: '60px' }}>
                                  Select
                                </th>
                                <th className="table-primary-th">Goal</th>
                                <th className="table-primary-th">Description</th>
                              </tr>
                            </thead>
                            <tbody className="table-primary-body">
                              {sortedFilteredGoals.length > 0 ? (
                                (() => {
                                  const selGoals = sortedFilteredGoals.filter((g) => formData.goal_ids.includes(g.id));
                                  const unselGoals = sortedFilteredGoals.filter((g) => !formData.goal_ids.includes(g.id));
                                  const showDivider = selectedProgramId && selGoals.length > 0 && unselGoals.length > 0;
                                  const firstUnselId = unselGoals[0]?.id;
                                  return (
                                    <>
                                      {showDivider && selGoals.length > 0 && (
                                        <tr>
                                          <td colSpan="3" style={{ padding: '0.4rem 0.75rem', background: '#ecfdf5', fontSize: '0.75rem', color: '#065f46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            ✅ From Selected Program
                                          </td>
                                        </tr>
                                      )}
                                      {sortedFilteredGoals.map((goal) => {
                                        const isSelected = formData.goal_ids.includes(goal.id);
                                        const isDividerRow = showDivider && goal.id === firstUnselId;
                                        return (
                                          <React.Fragment key={goal.id}>
                                            {isDividerRow && (
                                              <tr>
                                                <td colSpan="3" style={{ padding: '0.4rem 0.75rem', background: '#f3f4f6', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '2px solid #e5e7eb' }}>
                                                  Other Goals
                                                </td>
                                              </tr>
                                            )}
                                            <tr
                                              onClick={() => handleGoalToggle(goal.id)}
                                              className={`table-primary-row ${isSelected ? 'row-selected' : ''}`}
                                            >
                                              <td className="table-primary-td table-primary-td-center">
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => { }}
                                                  className="custom-checkbox"
                                                />
                                              </td>
                                              <td className="table-primary-td">
                                                <div className="table-primary-cell-name-text">{goal.goal}</div>
                                              </td>
                                              <td className="table-primary-td">
                                                <div className="table-primary-cell-subtitle">{goal.goal_description}</div>
                                              </td>
                                            </tr>
                                          </React.Fragment>
                                        );
                                      })}
                                    </>
                                  );
                                })()
                              ) : (
                                <tr>
                                  <td colSpan="3" className="table-primary-td" style={{ textAlign: 'center', padding: '2rem' }}>
                                    No goals match your search
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="modern-form-section-description">
                    {formData.goal_ids.length} goal(s) selected
                  </p>
                </>
              </div>

              {/* ── SELECT LEARNING CONTENT (child) ───────────────────────────── */}
              <div className="modern-form-section" style={{ marginTop: '1.5rem' }}>
                <h2 className="modern-form-section-title">Select Learning Content</h2>
                <p className="modern-form-section-description">
                  {selectedProgramId
                    ? `Content pre-loaded from program "${selectedProgram?.name}". You can add or remove items.`
                    : 'Choose content that will be available during the session (optional)'}
                </p>

                {/* Search Bar for Content */}
                <div className="search-container">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search content by title or type..."
                    value={searchTerm.content}
                    onChange={(e) =>
                      setSearchTerm({ ...searchTerm, content: e.target.value })
                    }
                    className="search-input"
                  />
                  {searchTerm.content && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm({ ...searchTerm, content: "" })}
                      className="search-clear"
                      aria-label="Clear content search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {contents.length === 0 ? (
                  <p className="empty-state">No learning content available</p>
                ) : (
                  <div className="content-grid-container">
                    {sortedFilteredContents.length > 0 ? (
                      (() => {
                        const selCount = sortedFilteredContents.filter((c) => formData.content_ids.includes(c.id)).length;
                        const hasUnsel = sortedFilteredContents.some((c) => !formData.content_ids.includes(c.id));
                        const showDivider = selectedProgramId && selCount > 0 && hasUnsel;
                        const visibleItems = sortedFilteredContents.slice(0, contentVisibleCount);

                        const getContentIcon = (type) => {
                          const icons = { image: "🖼️", pdf: "📄", video: "🎥", audio: "🎵", document: "📝", youtube: "🎥" };
                          return icons[type] || "📁";
                        };

                        return (
                          <>
                            {showDivider && selCount > 0 && (
                              <div style={{ gridColumn: '1 / -1', padding: '0.5rem 0.75rem', background: '#ecfdf5', borderRadius: '6px', fontSize: '0.75rem', color: '#065f46', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                ✅ From Selected Program
                              </div>
                            )}
                            {visibleItems.map((content, idx) => {
                              const isSelected = formData.content_ids.includes(content.id);
                              const isFirstUnselected = showDivider && idx === selCount;

                              const renderThumbnail = () => {
                                if (content.is_youtube && content.youtube_video_id) {
                                  const youtubeThumbUrl = `https://img.youtube.com/vi/${content.youtube_video_id}/hqdefault.jpg`;
                                  return (
                                    <div className="content-thumbnail youtube-thumbnail">
                                      <img src={youtubeThumbUrl} alt={content.title} onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex"; }} />
                                      <div className="img-fallback"><span className="content-icon">🎥</span></div>
                                    </div>
                                  );
                                }
                                if (content.content_type === "image" || content.thumbnail_url) {
                                  const imageUrl = learningContentService.getFileUrl(content.content_type === "image" ? content.file_url : content.thumbnail_url);
                                  return (
                                    <div className="content-thumbnail">
                                      <img src={imageUrl} alt={content.title} onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex"; }} />
                                      <div className="img-fallback"><span className="content-icon">{getContentIcon(content.content_type)}</span></div>
                                    </div>
                                  );
                                }
                                return (
                                  <div className="content-icon-container">
                                    <span className="content-icon">{getContentIcon(content.content_type)}</span>
                                  </div>
                                );
                              };

                              return (
                                <React.Fragment key={content.id}>
                                  {isFirstUnselected && (
                                    <div style={{ gridColumn: '1 / -1', padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '6px', fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '2px solid #e5e7eb', marginTop: '0.5rem' }}>
                                      Other Content
                                    </div>
                                  )}
                                  <div
                                    onClick={() => handleContentToggle(content.id)}
                                    className={`content-card ${isSelected ? 'card-selected' : ''}`}
                                  >
                                    {renderThumbnail()}
                                    <div className="content-info">
                                      <h4 className="content-title" title={content.title}>{content.title}</h4>
                                      <p className="content-type">{content.is_youtube ? "YouTube" : content.content_type}</p>
                                    </div>
                                    <div className="content-checkbox">
                                      <input type="checkbox" checked={isSelected} onChange={() => { }} className="custom-checkbox-sm" />
                                    </div>
                                  </div>
                                </React.Fragment>
                              );
                            })}
                            {sortedFilteredContents.length > contentVisibleCount && (
                              <div ref={contentSentinelRef} className="col-span-full flex justify-center items-center py-3 text-sm text-gray-400 gap-2">
                                <svg className="animate-spin h-4 w-4 text-[#DB9D32]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Loading more...
                              </div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <div className="content-empty">No content matches your search</div>
                    )}
                  </div>
                )}
                <p className="modern-form-section-description">
                  {formData.content_ids.length} item(s) selected
                </p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="modern-form-actions">
              <button
                type="button"
                onClick={() => navigate("/head/manage-sessions")}
                className="modern-form-btn modern-form-btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="modern-form-btn modern-form-btn-primary" disabled={loading}>
                {loading ? "Scheduling..." : "Schedule ILP"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSession;
