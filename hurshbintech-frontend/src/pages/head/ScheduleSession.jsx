import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import learningGoalsService from "../../api/services/learningGoalsService";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import headService from "../../api/services/headService";
import sessionService from "../../api/services/sessionService";
import learningContentService from "../../api/services/learningContentService";
import "../../styles/ManageUsersLayout.css";
import "../../styles/head/ScheduleSession.css";

const ScheduleSession = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [learners, setLearners] = useState([]);
  const [contents, setContents] = useState([]);
  const [learningGoals, setLearningGoals] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
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
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [trainersData, learnersData, contentsData, goalsData] =
        await Promise.all([
          headService.getAllTrainers(),
          headService.getAllLearners(),
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
    };

    try {
      setLoading(true);
      await sessionService.createSession(sessionPayload);
      toast.success("Session scheduled successfully!");
      navigate("/head/dashboard");
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
      l.user_id?.toString().includes(searchTerm.learner)
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

  const getSelectedTrainerName = () => {
    const trainer = trainers.find(
      (t) => t.user_id === parseInt(formData.trainer_id)
    );
    return trainer ? `${trainer.name} (ID: ${trainer.user_id})` : "";
  };

  const getSelectedLearnerName = () => {
    const learner = learners.find(
      (l) => l.user_id === parseInt(formData.learner_id)
    );
    return learner ? `${learner.name} (ID: ${learner.user_id})` : "";
  };

  const handleTrainerSelect = (trainerId) => {
    setFormData({ ...formData, trainer_id: trainerId });
    setShowDropdown({ ...showDropdown, trainer: false });
    setSearchTerm({ ...searchTerm, trainer: "" });
  };

  const handleLearnerSelect = (learnerId) => {
    setFormData({ ...formData, learner_id: learnerId });
    setShowDropdown({ ...showDropdown, learner: false });
    setSearchTerm({ ...searchTerm, learner: "" });
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

  if (loadingData) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <div className="page-container schedule-session">
      <Navbar />
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
          <form onSubmit={handleSubmit} className="form-section">
            {/* Title */}
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">
                Session Title <span className="text-required">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="app-modal-form-input"
                placeholder="e.g., Introduction to Fruits"
                required
              />
            </div>

            {/* Description */}
            <div className="app-modal-form-field">
              <label className="app-modal-form-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="app-modal-form-textarea"
                rows="3"
                placeholder="Session description (optional)"
              />
            </div>

            <div className="app-modal-form-grid app-modal-form-grid app-modal-form-grid--2">
              {/* Select Trainer with Searchable Dropdown */}
              <div className="dropdown-field" ref={trainerDropdownRef}>
                <label className="app-modal-form-label">
                  Select Trainer <span className="text-required">*</span>
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
                  className="app-modal-form-input"
                  required={!formData.trainer_id}
                />
                {showDropdown.trainer && (
                  <div className="dropdown-menu">
                    {filteredTrainers.length > 0 ? (
                      filteredTrainers.map((trainer) => (
                        <div
                          key={trainer.id}
                          onClick={() => handleTrainerSelect(trainer.user_id)}
                          className={`dropdown-item ${
                            formData.trainer_id === trainer.user_id
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
                {/* {formData.trainer_id && !showDropdown.trainer && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, trainer_id: "" });
                      setSearchTerm({ ...searchTerm, trainer: "" });
                    }}
                    className="dropdown-clear"
                  >
                    ✕
                  </button>
                )} */}
              </div>

              {/* Select Learner with Searchable Dropdown */}
              <div className="dropdown-field" ref={learnerDropdownRef}>
                <label className="app-modal-form-label">
                  Select Learner <span className="text-required">*</span>
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
                  className="app-modal-form-input"
                  required={!formData.learner_id}
                />
                {showDropdown.learner && (
                  <div className="dropdown-menu">
                    {filteredLearners.length > 0 ? (
                      filteredLearners.map((learner) => (
                        <div
                          key={learner.id}
                          onClick={() => handleLearnerSelect(learner.user_id)}
                          className={`dropdown-item ${
                            formData.learner_id === learner.user_id
                              ? "dropdown-item-selected"
                              : ""
                          }`}
                        >
                          {learner.name}{" "}
                          <span className="dropdown-item-meta">
                            (ID: {learner.user_id})
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
                {/* {formData.learner_id && !showDropdown.learner && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, learner_id: "" });
                      setSearchTerm({ ...searchTerm, learner: "" });
                    }}
                    className="dropdown-clear"
                  >
                    ✕
                  </button>
                )} */}
              </div>
            </div>

            <div className="app-modal-form-grid app-modal-form-grid app-modal-form-grid--2">
              {/* Date & Time */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">
                  Date & Time <span className="text-required">*</span>
                </label>

                {/* Flex container to hold input and button */}
                <div className="input-group">
                  <input
                    type="datetime-local"
                    value={tempDate}
                    onChange={(e) => setTempDate(e.target.value)}
                    className="app-modal-form-input"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSetDate}
                    className="app-modal-btn app-modal-btn--primary"
                  >
                    Set
                  </button>
                </div>

                {/* Optional: Show the user what date is currently *confirmed* */}
                {formData.scheduled_date && (
                  <p className="form-helper-text">
                    Confirmed time:{" "}
                    {new Date(formData.scheduled_date).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Duration */}
              <div className="app-modal-form-field">
                <label className="app-modal-form-label">
                  Duration (minutes) <span className="text-required">*</span>
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData({ ...formData, duration: e.target.value })
                  }
                  className="app-modal-form-select"
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

            {/* Select Learning Goals */}
            <div className="section-container">
              <label className="section-label">
                Select Learning Goals (Optional)
              </label>
              <p className="section-description">
                Choose learning goals for this session
              </p>

              {/* Search Bar for Goals */}
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
                <p className="empty-state">
                  No learning goals available
                </p>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead className="table-header">
                      <tr>
                        <th className="checkbox-col">
                          Select
                        </th>
                        <th>
                          Goal
                        </th>
                        <th>
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="table-body">
                      {filteredGoals.length > 0 ? (
                        filteredGoals.map((goal) => (
                          <tr
                            key={goal.id}
                            onClick={() => handleGoalToggle(goal.id)}
                            className={formData.goal_ids.includes(goal.id) ? "row-selected" : ""}
                          >
                            <td className="cell-center">
                              <input
                                type="checkbox"
                                checked={formData.goal_ids.includes(goal.id)}
                                onChange={() => {}}
                                className="custom-checkbox"
                              />
                            </td>
                            <td>
                              <div className="cell-text-primary">
                                {goal.goal}
                              </div>
                            </td>
                            <td>
                              <div className="cell-text-secondary">
                                {goal.goal_description}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="table-empty">
                            No goals match your search
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="section-footer">
                {formData.goal_ids.length} goal(s) selected
              </p>
            </div>

            {/* Select Learning Content */}
            <div className="section-container">
              <label className="section-label">
                Select Learning Content (Optional)
              </label>
              <p className="section-description">
                Choose content that will be available during the session
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
                    onClick={() =>
                      setSearchTerm({ ...searchTerm, content: "" })
                    }
                    className="search-clear"
                    aria-label="Clear content search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {contents.length === 0 ? (
                <p className="empty-state">
                  No learning content available
                </p>
              ) : (
                <div className="content-grid-container">
                  {filteredContents.length > 0 ? (
                    filteredContents.map((content) => {
                      const getContentIcon = (type) => {
                        const icons = {
                          image: "🖼️",
                          pdf: "📄",
                          video: "🎥",
                          audio: "🎵",
                          document: "📝",
                        };
                        return icons[type] || "📁";
                      };

                      // Function to render thumbnail or icon
                      const renderThumbnail = () => {
                        if (
                          content.content_type === "image" ||
                          content.thumbnail_url
                        ) {
                          const imageUrl = learningContentService.getFileUrl(
                            content.content_type === "image"
                              ? content.file_url
                              : content.thumbnail_url
                          );
                          return (
                            <div className="content-thumbnail">
                              <img
                                src={imageUrl}
                                alt={content.title}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextElementSibling.style.display =
                                    "flex";
                                }}
                              />
                              <div className="img-fallback">
                                <span className="content-icon">
                                  {getContentIcon(content.content_type)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="content-icon-container">
                            <span className="content-icon">
                              {getContentIcon(content.content_type)}
                            </span>
                          </div>
                        );
                      };

                      return (
                        <div
                          key={content.id}
                          onClick={() => handleContentToggle(content.id)}
                          className={`content-card ${
                            formData.content_ids.includes(content.id)
                              ? "card-selected"
                              : ""
                          }`}
                        >
                          {/* Thumbnail */}
                          {renderThumbnail()}

                          {/* Content Info */}
                          <div className="content-info">
                            <h4
                              className="content-title"
                              title={content.title}
                            >
                              {content.title}
                            </h4>
                            <p className="content-type">
                              {content.content_type}
                            </p>
                          </div>

                          {/* Checkbox */}
                          <div className="content-checkbox">
                            <input
                              type="checkbox"
                              checked={formData.content_ids.includes(
                                content.id
                              )}
                              onChange={() => {}}
                              className="custom-checkbox-sm"
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="content-empty">
                      No content matches your search
                    </div>
                  )}
                </div>
              )}
              <p className="section-footer">
                {formData.content_ids.length} item(s) selected
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="form-actions">
              
              <button
                type="button"
                onClick={() => navigate("/head/dashboard")}
                className="app-modal-btn app-modal-btn--secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="app-modal-btn app-modal-btn--primary" disabled={loading}>
                {loading ? "Scheduling..." : "Schedule Session"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ScheduleSession;
