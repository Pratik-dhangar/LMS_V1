import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import learningGoalsService from "../../api/services/learningGoalsService";
import { useNavigate } from "react-router-dom";
import headService from "../../api/services/headService";
import sessionService from "../../api/services/sessionService";
import learningContentService from "../../api/services/learningContentService";
import programService from "../../api/services/programService";
import trainerService from "../../api/services/trainerService";
import { useAuth } from "../../context/AuthContext";
import { downloadLearningProgramPDF } from "../../utils/pdfGenerator";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Table.css";
import "../../styles/head/ScheduleSession.css";

const ScheduleSession = ({ mode = 'head', embedded = false, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [learners, setLearners] = useState([]);
  const [contents, setContents] = useState([]);
  const [learningGoals, setLearningGoals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [canTrainerSchedule, setCanTrainerSchedule] = useState(true);

  // Program state
  const [programList, setProgramList] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [programMode, setProgramMode] = useState('none'); // 'none' | 'existing'
  const [programSearch, setProgramSearch] = useState('');
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [programDropdownOpen, setProgramDropdownOpen] = useState(false);
  const programDropdownRef = useRef(null);
  const contentGridRef = useRef(null);
  const contentSentinelRef = useRef(null);
  const CONTENT_PAGE_SIZE = 12;
  const [contentVisibleCount, setContentVisibleCount] = useState(CONTENT_PAGE_SIZE);

  const [formData, setFormData] = useState({
    title: "",
    trainer_id: "",
    learner_id: "",
    scheduled_dates: [],
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

  const isTrainerMode = mode === 'trainer';
  const rootClassName = embedded
    ? 'page-container schedule-session schedule-session--embedded'
    : 'page-container schedule-session';

  const normalizedContentSearch = searchTerm.content.toLowerCase();
  const filteredContentCount = contents.filter(
    (content) =>
      content.title?.toLowerCase().includes(normalizedContentSearch) ||
      content.content_type?.toLowerCase().includes(normalizedContentSearch)
  ).length;

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
    const contentGrid = contentGridRef.current;
    if (!sentinel || !contentGrid) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && contentVisibleCount < filteredContentCount) {
          setContentVisibleCount((prev) => prev + CONTENT_PAGE_SIZE);
        }
      },
      { root: contentGrid, rootMargin: '150px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [contentVisibleCount, filteredContentCount]);

  const handleContentGridScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150 && contentVisibleCount < filteredContentCount) {
      setContentVisibleCount((prev) => prev + CONTENT_PAGE_SIZE);
    }
  };

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [contentsData, goalsData] = await Promise.all([
        isTrainerMode ? learningContentService.trainer.getAll() : learningContentService.head.getAll(),
        isTrainerMode ? learningGoalsService.trainer.getAll() : learningGoalsService.head.getAll(),
      ]);
      const learnersData = isTrainerMode
        ? await trainerService.getLearnersForScheduling()
        : await headService.getLearnersForSessionScheduling();
      const trainersData = isTrainerMode ? [] : await headService.getAllTrainers();
      if (isTrainerMode) {
        const permission = await trainerService.getIlpPermission();
        setCanTrainerSchedule(!!permission?.can_trainers_schedule_ilp);
      }
      setTrainers(trainersData || []);
      setLearners(learnersData || []);
      setContents(contentsData);
      setLearningGoals(goalsData);
      if (isTrainerMode && user?.id) {
        setFormData((prev) => ({ ...prev, trainer_id: String(user.id) }));
      }
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

  const formatDateKey = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleScheduledDateSelect = (selectedDate) => {
    if (!selectedDate) {
      return;
    }

    const normalizedDate = formatDateKey(selectedDate);
    setFormData((prev) => {
      if (prev.scheduled_dates.includes(normalizedDate)) {
        return prev;
      }

      return {
        ...prev,
        scheduled_dates: [...prev.scheduled_dates, normalizedDate].sort(),
      };
    });
  };

  const handleRemoveScheduledDate = (dateToRemove) => {
    setFormData((prev) => ({
      ...prev,
      scheduled_dates: prev.scheduled_dates.filter((date) => date !== dateToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isTrainerMode && !canTrainerSchedule) {
      toast.error("Scheduling ILP is disabled by your Head.");
      return;
    }

    if (
      !formData.title ||
      (!isTrainerMode && !formData.trainer_id) ||
      !formData.learner_id ||
      !formData.scheduled_dates.length
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    const uniqueScheduledDates = [...new Set(formData.scheduled_dates)].sort();
    if (!uniqueScheduledDates.length) {
      toast.error("Please select at least one valid date.");
      return;
    }

    const baseSessionPayload = {
      ...formData,
      trainer_id: isTrainerMode ? Number(user?.id) : parseInt(formData.trainer_id),
      learner_id: parseInt(formData.learner_id),
      content_ids: formData.content_ids.map(Number),
      goal_ids: formData.goal_ids.map(Number),
      ...(selectedProgramId ? { program_id: selectedProgramId } : {}),
    };

    try {
      setLoading(true);

      const results = await Promise.allSettled(
        uniqueScheduledDates.map((scheduledDate) =>
          sessionService.createSession({
            ...baseSessionPayload,
            scheduled_date: `${scheduledDate}T00:00:00`,
          })
        )
      );

      const failedDates = results
        .map((result, index) => (result.status === "rejected" ? uniqueScheduledDates[index] : null))
        .filter(Boolean);
      const successCount = results.length - failedDates.length;

      if (failedDates.length === 0) {
        toast.success(
          successCount === 1
            ? "Session scheduled successfully!"
            : `${successCount} sessions scheduled successfully!`
        );
        navigate(isTrainerMode ? "/trainer/dashboard" : "/head/manage-sessions");
        return;
      }

      setFormData((prev) => ({
        ...prev,
        scheduled_dates: failedDates,
      }));
      toast.error(
        successCount > 0
          ? `${successCount} session(s) scheduled, but ${failedDates.length} date(s) failed. Please review the remaining dates and try again.`
          : `Failed to schedule sessions for ${failedDates.length} date(s).`
      );
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

  const getProgramMetaText = (prog) => {
    const skills = Array.isArray(prog?.skills) ? prog.skills : [];
    const skillCount = skills.length;
    const skillNames = skills
      .map((skill) => (skill?.skill_name || '').trim())
      .filter(Boolean);

    const subProgramCount = (prog?.goal_ids || []).length;

    if (skillCount > 0) {
      const skillLabel = skillNames.length > 0 ? skillNames.join(', ') : `${skillCount} skill(s)`;
      return ` | Skill: ${skillLabel} — Sub-programs: ${subProgramCount}, Learning-Content: ${(prog?.content_ids || []).length}`;
    }

    if (prog?.skill) {
      return ` | Skill: ${prog.skill} — Sub-programs: ${subProgramCount}, Learning-Content: ${(prog?.content_ids || []).length}`;
    }

    return ` — Sub-programs: ${subProgramCount}, Learning-Content: ${(prog?.content_ids || []).length}`;
  };

  // Goals resolved for read-only display when a program is active
  const lockedGoals = selectedProgram
    ? learningGoals.filter((g) => (selectedProgram.goal_ids || []).includes(g.id))
    : [];

  const getSelectedTrainerName = () => {
    if (isTrainerMode) {
      return `${user?.name || 'Trainer'} (ID: ${user?.id || 'current'})`;
    }
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
    if (isTrainerMode) return;
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
      const programs = isTrainerMode
        ? await programService.trainer.getPrograms(learnerId)
        : await programService.getPrograms(learnerId);
      setProgramList(programs || []);
    } catch (error) {
      console.error("[ScheduleSession] Failed to load programs for learner:", error);
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

  const handleGenerateProgramPdf = async () => {
    if (!selectedProgramId || !selectedProgram) {
      toast.error("Please select a program first");
      return;
    }

    try {
      const programDetail = isTrainerMode
        ? await programService.trainer.getProgramById(selectedProgramId)
        : await programService.getProgramById(selectedProgramId);

      let rows = [];

      // Check if program has multi-skill structure
      if (programDetail?.skills && Array.isArray(programDetail.skills) && programDetail.skills.length > 0) {
        // Use new multi-skill structure
        rows = programDetail.skills.map(skill => {
          const skillGoals = learningGoals.filter(goal => skill.goal_ids?.includes(goal.id));
          const subProgramText = skillGoals.length
            ? skillGoals.map(goal => goal.goal || `Goal #${goal.id}`).join(", ")
            : "-";
          return {
            skill: skill.skill_name || "-",
            subPrograms: subProgramText,
          };
        });
      } else {
        // Fall back to old single-skill structure for backward compatibility
        const selectedGoalIds = programDetail?.goal_ids || [];
        const selectedGoals = learningGoals.filter((goal) => selectedGoalIds.includes(goal.id));
        const subProgramText = selectedGoals.length
          ? selectedGoals.map((goal) => goal.goal || `Program #${goal.id}`).join(", ")
          : "-";

        rows = [{
          skill: programDetail?.skill || selectedProgram?.skill || "-",
          subPrograms: subProgramText,
        }];
      }

      const selectedLearner = learners.find((l) => l.id === parseInt(formData.learner_id));
      const selectedTrainer = trainers.find((t) => t.user_id === parseInt(formData.trainer_id));

      await downloadLearningProgramPDF({
        programName: selectedProgram.name,
        date: formData.scheduled_dates[0] || new Date().toISOString(),
        childName: selectedLearner?.name || "-",
        programStartDate: programDetail?.created_at || null,
        executerName: selectedTrainer?.name || "-",
        rows,
      });

      toast.success("Program PDF downloaded successfully");
    } catch {
      toast.error("Failed to generate program PDF");
    }
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

  const handleExit = () => {
    if (embedded && onClose) {
      onClose();
      return;
    }

    navigate(isTrainerMode ? "/trainer/dashboard" : "/head/manage-sessions");
  };

  if (loadingData) {
    return (
      <div className={rootClassName}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (isTrainerMode && !canTrainerSchedule) {
    return (
      <div className={rootClassName}>
        <div className="page-main">
          <div className="page-content">
            <div className="page-header">
              <button
                onClick={handleExit}
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
                {embedded ? "Close" : "Back to Dashboard"}
              </button>
              <div>
                <h1 className="page-title">Schedule ILP</h1>
                <p className="page-description">This feature is currently disabled by your Head.</p>
              </div>
            </div>
            <div className="modern-form-card" style={{ padding: '2rem', textAlign: 'center' }}>
              <p className="modern-form-section-description" style={{ marginBottom: 0 }}>
                You can return here once the Head enables trainer ILP scheduling.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <div className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button
              onClick={handleExit}
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
              {embedded ? "Close" : (isTrainerMode ? "Back to Dashboard" : "Back to Manage Sessions")}
            </button>
            <div>
              <h1 className="page-title">Schedule ILP</h1>
              <p className="page-description">
                {isTrainerMode ? "Create new ILP sessions for your learners" : "Create new training sessions"}
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="modern-form-card">
            {/* Trainer & Learner Selection */}
            <div className="modern-form-section">
              <div className="modern-form-grid-two-col">
                {isTrainerMode ? (
                  <div className="modern-form-grid-full" style={{ gridColumn: '1 / -1' }}>
                    <label className="modern-form-label">Scheduling As</label>
                    <div className="program-selected-card" style={{ marginTop: 0 }}>
                      <p className="modern-form-section-description program-selected-text" style={{ margin: 0 }}>
                        <span className="program-selected-icon" aria-hidden="true">✓</span>
                        {user?.name || 'Trainer'} (ID: {user?.id || 'current'})
                      </p>
                    </div>
                  </div>
                ) : (
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
                              {trainer.name} {" "}
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
                )}

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



            {/* Session Dates */}
            <div className="modern-form-section">
              <div className="modern-form-grid-full">
                <label className="modern-form-label">
                  Session Dates <span className="required-indicator">*</span>
                </label>
                <DatePicker
                  inline
                  onChange={handleScheduledDateSelect}
                  minDate={new Date()}
                  dateFormat="yyyy-MM-dd"
                  className="modern-form-input"
                  highlightDates={formData.scheduled_dates.map((scheduledDate) => new Date(`${scheduledDate}T00:00:00`))}
                />
                {formData.scheduled_dates.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <p className="modern-form-helper-text">Selected dates for this session:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.scheduled_dates.map((scheduledDate) => (
                        <button
                          key={scheduledDate}
                          type="button"
                          onClick={() => handleRemoveScheduledDate(scheduledDate)}
                          className="modern-form-btn modern-form-btn-secondary"
                          style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}
                        >
                          {new Date(`${scheduledDate}T00:00:00`).toLocaleDateString()} ×
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="modern-form-helper-text" style={{ marginTop: '0.75rem' }}>
                    Add one or more dates. Each selected day will create a separate session.
                  </p>
                )}
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
                                  {getProgramMetaText(prog)}
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
                        <div className="program-selected-card">
                          <p className="modern-form-section-description program-selected-text">
                            <span className="program-selected-icon" aria-hidden="true">✓</span>
                            Program &quot;<strong>{selectedProgram.name}</strong>&quot; selected —
                            goals are pre-loaded (locked) and content is pre-selected (editable).
                          </p>
                          <button
                            type="button"
                            onClick={handleGenerateProgramPdf}
                            className="modern-form-btn modern-form-btn-secondary program-pdf-btn"
                          >
                            Download Program PDF
                          </button>
                        </div>
                      )}
                    </>
                  )}
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
                  <div
                    ref={contentGridRef}
                    className="content-grid-container"
                    onScroll={handleContentGridScroll}
                  >
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
                onClick={handleExit}
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
