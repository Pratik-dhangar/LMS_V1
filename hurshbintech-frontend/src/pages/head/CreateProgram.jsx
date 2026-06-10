import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Search } from "lucide-react";
import headService from "../../api/services/headService";
import learningGoalsService from "../../api/services/learningGoalsService";
import learningSkillsService from "../../api/services/learningSkillsService";
import learningContentService from "../../api/services/learningContentService";
import programService from "../../api/services/programService";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Table.css";
import "../../styles/head/ScheduleSession.css";

const SUB_PROGRAMS_PER_PAGE = 5;

const CreateProgram = () => {
    const navigate = useNavigate();
    const learnerDropdownRef = useRef(null);

    const [loadingData, setLoadingData] = useState(true);
    const [creatingProgram, setCreatingProgram] = useState(false);

    const [learners, setLearners] = useState([]);
    const [learningGoals, setLearningGoals] = useState([]);
    const [learningSkills, setLearningSkills] = useState([]);
    const [contents, setContents] = useState([]);

    const [searchTerm, setSearchTerm] = useState({
        learner: "",
        content: "",
    });
    const [subProgramSearchTerms, setSubProgramSearchTerms] = useState({});
    const [subProgramPages, setSubProgramPages] = useState({});
    const [showLearnerDropdown, setShowLearnerDropdown] = useState(false);

    const [formData, setFormData] = useState({
        learner_id: "",
        goal_ids: [],
        content_ids: [],
        name: "",
        skill: "",
        skills: [], // Array of {skill_id, skill_name, goal_ids}
    });

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                learnerDropdownRef.current &&
                !learnerDropdownRef.current.contains(event.target)
            ) {
                setShowLearnerDropdown(false);
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
            const [learnersData, goalsData, skillsData, contentsData] = await Promise.all([
                headService.getLearnersForSessionScheduling(),
                learningGoalsService.head.getAll(),
                learningSkillsService.head.getAll(),
                learningContentService.head.getAll(),
            ]);
            setLearners(learnersData || []);
            setLearningGoals(goalsData || []);
            setLearningSkills(skillsData || []);
            setContents(contentsData || []);
        } catch {
            toast.error("Failed to load create program data");
        } finally {
            setLoadingData(false);
        }
    };

    const filteredLearners = learners.filter(
        (learner) =>
            learner.name?.toLowerCase().includes(searchTerm.learner.toLowerCase()) ||
            learner.id?.toString().includes(searchTerm.learner)
    );

    const filteredContents = contents.filter(
        (content) =>
            content.title?.toLowerCase().includes(searchTerm.content.toLowerCase()) ||
            content.description?.toLowerCase().includes(searchTerm.content.toLowerCase()) ||
            content.content_type
                ?.toLowerCase()
                .includes(searchTerm.content.toLowerCase())
    );

    const getSelectedLearnerName = () => {
        const learner = learners.find((l) => l.id === parseInt(formData.learner_id));
        return learner
            ? `${learner.name} (ID: ${learner.id}) - ${learner.remaining_sessions} sessions - ${learner.status_text}`
            : "";
    };

    const handleLearnerSelect = (learnerId) => {
        setFormData((prev) => ({
            ...prev,
            learner_id: String(learnerId),
        }));
        setShowLearnerDropdown(false);
        setSearchTerm((prev) => ({ ...prev, learner: "" }));
    };

    const handleGoalToggle = (goalId) => {
        setFormData((prev) => ({
            ...prev,
            goal_ids: prev.goal_ids.includes(goalId)
                ? prev.goal_ids.filter((id) => id !== goalId)
                : [...prev.goal_ids, goalId],
        }));
    };

    const handleContentToggle = (contentId) => {
        setFormData((prev) => ({
            ...prev,
            content_ids: prev.content_ids.includes(contentId)
                ? prev.content_ids.filter((id) => id !== contentId)
                : [...prev.content_ids, contentId],
        }));
    };

    // Handle multi-skill structure
    const handleSkillToggle = (skillId, skillName) => {
        setFormData((prev) => {
            const skillExists = prev.skills.find(s => s.skill_id === skillId);
            if (skillExists) {
                // Remove skill
                return {
                    ...prev,
                    skills: prev.skills.filter(s => s.skill_id !== skillId),
                };
            } else {
                // Add skill
                return {
                    ...prev,
                    skills: [...prev.skills, { skill_id: skillId, skill_name: skillName, goal_ids: [] }],
                };
            }
        });

        setSubProgramSearchTerms((prev) => {
            if (formData.skills.some((skill) => skill.skill_id === skillId)) {
                const next = { ...prev };
                delete next[skillId];
                return next;
            }
            return prev;
        });

        setSubProgramPages((prev) => {
            if (formData.skills.some((skill) => skill.skill_id === skillId)) {
                const next = { ...prev };
                delete next[skillId];
                return next;
            }
            return prev;
        });
    };

    const handleSkillSubProgramToggle = (skillId, goalId) => {
        setFormData((prev) => {
            const updatedSkills = prev.skills.map(skill => {
                if (skill.skill_id === skillId) {
                    return {
                        ...skill,
                        goal_ids: skill.goal_ids.includes(goalId)
                            ? skill.goal_ids.filter(id => id !== goalId)
                            : [...skill.goal_ids, goalId],
                    };
                }
                return skill;
            });
            return {
                ...prev,
                skills: updatedSkills,
            };
        });
    };

    const getSubProgramPage = (skillId) => subProgramPages[skillId] || 1;

    const getSubProgramSearchTerm = (skillId) => subProgramSearchTerms[skillId] || "";

    const setSubProgramPage = (skillId, page) => {
        setSubProgramPages((prev) => ({
            ...prev,
            [skillId]: page,
        }));
    };

    const setSubProgramSearchTerm = (skillId, query) => {
        setSubProgramSearchTerms((prev) => ({
            ...prev,
            [skillId]: query,
        }));
        setSubProgramPage(skillId, 1);
    };

    const getContentTitle = (content) => {
        return content.title || content.name || `Content #${content.id}`;
    };

    const getContentTypeLabel = (contentType) => {
        if (!contentType) return "Unknown";
        return String(contentType).toUpperCase();
    };

    const getContentDescription = (content) => {
        if (content.description && String(content.description).trim()) {
            return String(content.description).trim();
        }
        return "No description available";
    };

    const getContentUrl = (content) => {
        if (content.youtube_url) return content.youtube_url;
        if (content.file_url) return learningContentService.getFileUrl(content.file_url);
        return "";
    };

    const getThumbnailUrl = (content) => {
        if (content.thumbnail_url) return learningContentService.getFileUrl(content.thumbnail_url);
        return "";
    };

    const extractYouTubeId = (url) => {
        if (!url) return "";
        const text = String(url).trim();

        const shortMatch = text.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
        if (shortMatch?.[1]) return shortMatch[1];

        const watchMatch = text.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
        if (watchMatch?.[1]) return watchMatch[1];

        const embedMatch = text.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
        if (embedMatch?.[1]) return embedMatch[1];

        return "";
    };

    const getYoutubeThumbnailUrl = (content) => {
        const id = content.youtube_video_id || extractYouTubeId(content.youtube_url);
        if (!id) return "";
        return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    };

    const handleCreateProgram = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Please enter a program name");
            return;
        }
        if (!formData.learner_id) {
            toast.error("Please select a learner first");
            return;
        }
        if (formData.skills.length === 0) {
            toast.error("Please select at least one skill before creating a program");
            return;
        }
        // Check that at least one skill has sub-programs selected
        const hasSubPrograms = formData.skills.some(skill => skill.goal_ids.length > 0);
        if (!hasSubPrograms) {
            toast.error("Please select at least one sub-program for any skill");
            return;
        }
        if (formData.content_ids.length === 0) {
            toast.error("Please select at least one learning content before creating a program");
            return;
        }

        try {
            setCreatingProgram(true);
            // Collect all goal_ids from all skills - these are the flat goal_ids
            const allGoalIds = Array.from(new Set(formData.skills.flatMap(skill => skill.goal_ids)));

            const created = await programService.createProgram({
                name: formData.name.trim(),
                skill: formData.skill.trim() || null,
                learner_id: parseInt(formData.learner_id),
                goal_ids: allGoalIds,
                content_ids: formData.content_ids,
                skills: formData.skills, // Send the multi-skill structure
            });

            toast.success(`Program "${created.name}" created successfully`);
            navigate("/head/manage-sessions");
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to create program");
        } finally {
            setCreatingProgram(false);
        }
    };

    if (loadingData) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
            </div>
        );
    }

    return (
        <div className="page-container schedule-session">
            <div className="page-main">
                <div className="page-content">
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
                            <h1 className="page-title">Create New Program</h1>
                            <p className="page-description">
                                Create a program by selecting learner, multiple skills with sub-programs, and learning content
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleCreateProgram} className="modern-form-card">
                        <div className="modern-form-section">
                            <h2 className="modern-form-section-title">Program Details</h2>
                            <div className="modern-form-grid-two-col">
                                <div>
                                    <label className="modern-form-label">
                                        Program Name <span className="required-indicator">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                                        className="modern-form-input"
                                        placeholder="e.g. Program-A"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modern-form-section" ref={learnerDropdownRef}>
                            <h2 className="modern-form-section-title">Select Learner</h2>
                            <p className="modern-form-section-description">
                                Select learner first before choosing goals and content.
                            </p>
                            <div className="dropdown-field">
                                <input
                                    type="text"
                                    placeholder="Search learner by name or ID..."
                                    value={formData.learner_id ? getSelectedLearnerName() : searchTerm.learner}
                                    onChange={(e) => {
                                        if (formData.learner_id) {
                                            setFormData((prev) => ({ ...prev, learner_id: "" }));
                                        }
                                        setSearchTerm((prev) => ({ ...prev, learner: e.target.value }));
                                        setShowLearnerDropdown(true);
                                    }}
                                    onFocus={() => setShowLearnerDropdown(true)}
                                    className="modern-form-input"
                                    required={!formData.learner_id}
                                />
                                {showLearnerDropdown && (
                                    <div className="dropdown-menu">
                                        {filteredLearners.length > 0 ? (
                                            filteredLearners.map((learner) => (
                                                <div
                                                    key={learner.id}
                                                    onClick={() => handleLearnerSelect(learner.id)}
                                                    className="dropdown-item"
                                                >
                                                    {learner.name} (ID: {learner.id}) - {learner.remaining_sessions} sessions - {learner.status_text}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="dropdown-item dropdown-item-empty">No learners found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="modern-form-section" style={{ marginTop: "1.5rem" }}>
                            <h2 className="modern-form-section-title">Select Skills & Sub-Programs</h2>
                            <p className="modern-form-section-description">
                                Select one or more skills, and for each skill choose one or more sub-programs.
                            </p>

                            {learningSkills.length === 0 ? (
                                <p className="empty-state">No learning skills available</p>
                            ) : (
                                <div className="skills-accordion-list">
                                    {learningSkills.map((skill) => {
                                        const skillSelected = formData.skills.find(s => s.skill_id === skill.id);
                                        const searchQuery = getSubProgramSearchTerm(skill.id);
                                        const filteredSubPrograms = learningGoals.filter(
                                            (goal) =>
                                                goal.goal?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                goal.goal_description?.toLowerCase().includes(searchQuery.toLowerCase())
                                        );
                                        const currentPage = getSubProgramPage(skill.id);
                                        const totalPages = Math.max(1, Math.ceil(filteredSubPrograms.length / SUB_PROGRAMS_PER_PAGE));
                                        const paginatedSubPrograms = filteredSubPrograms.slice(
                                            (currentPage - 1) * SUB_PROGRAMS_PER_PAGE,
                                            currentPage * SUB_PROGRAMS_PER_PAGE
                                        );
                                        const startItem = filteredSubPrograms.length === 0 ? 0 : (currentPage - 1) * SUB_PROGRAMS_PER_PAGE + 1;
                                        const endItem = Math.min(currentPage * SUB_PROGRAMS_PER_PAGE, filteredSubPrograms.length);

                                        return (
                                            <div
                                                key={skill.id}
                                                className={`skill-card ${skillSelected ? "skill-card--selected" : ""}`}
                                            >
                                                <div
                                                    className="skill-card-header"
                                                    onClick={() => handleSkillToggle(skill.id, skill.skill_name)}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!!skillSelected}
                                                        onChange={() => handleSkillToggle(skill.id, skill.skill_name)}
                                                        className="skill-card-checkbox"
                                                    />
                                                    <div className="skill-card-title-group">
                                                        <label className="skill-card-title">{skill.skill_name}</label>
                                                        <span className="skill-card-subtitle">
                                                            {skillSelected ? `${skillSelected.goal_ids.length} sub-program${skillSelected.goal_ids.length === 1 ? "" : "s"} selected` : "Select this skill to expand"}
                                                        </span>
                                                    </div>
                                                    <span className={`skill-card-chevron ${skillSelected ? "skill-card-chevron--open" : ""}`}>
                                                        ▾
                                                    </span>
                                                </div>

                                                {skillSelected && (
                                                    <div className="skill-card-body">
                                                        <div className="search-container skill-search-container">
                                                            <Search className="search-icon" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search sub-programs by name or description..."
                                                                value={searchQuery}
                                                                onChange={(e) => setSubProgramSearchTerm(skill.id, e.target.value)}
                                                                className="search-input skill-search-input"
                                                            />
                                                        </div>
                                                        <div className="skill-card-meta">
                                                            <span>
                                                                Showing {filteredSubPrograms.length} of {learningGoals.length} sub-programs
                                                            </span>
                                                            <span>
                                                                Select sub-programs for <strong>{skill.skill_name}</strong>
                                                            </span>
                                                        </div>
                                                        {filteredSubPrograms.length === 0 ? (
                                                            <p className="empty-state skill-empty-state">
                                                                No sub-programs found for your search
                                                            </p>
                                                        ) : (
                                                            <div>
                                                                <div className="skill-subprogram-grid">
                                                                    {paginatedSubPrograms.map((goal) => {
                                                                        const isChecked = skillSelected?.goal_ids?.includes(goal.id) || false;
                                                                        return (
                                                                            <div
                                                                                key={goal.id}
                                                                                className={`skill-subprogram-card ${isChecked ? "skill-subprogram-card--selected" : ""}`}
                                                                                onClick={() => handleSkillSubProgramToggle(skill.id, goal.id)}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    onChange={() => handleSkillSubProgramToggle(skill.id, goal.id)}
                                                                                    className="skill-subprogram-checkbox"
                                                                                />
                                                                                <div className="skill-subprogram-copy">
                                                                                    <div className="skill-subprogram-title">
                                                                                        {goal.goal}
                                                                                    </div>
                                                                                    {goal.goal_description && (
                                                                                        <div className="skill-subprogram-description">
                                                                                            {goal.goal_description}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>

                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Summary of selected skills and sub-programs */}
                            {formData.skills.length > 0 && (
                                <div
                                    style={{
                                        marginTop: "1.5rem",
                                        padding: "1rem",
                                        backgroundColor: "#f0f8ff",
                                        borderRadius: "8px",
                                        border: "1px solid #b3d9ff",
                                    }}
                                >
                                    <h3 style={{ marginTop: 0, marginBottom: "0.75rem", color: "#333" }}>
                                        Selected Structure:
                                    </h3>
                                    {formData.skills.map((skill) => (
                                        <div key={skill.skill_id} style={{ marginBottom: "0.75rem" }}>
                                            <strong>{skill.skill_name}:</strong>{" "}
                                            {skill.goal_ids.length > 0
                                                ? learningGoals
                                                    .filter(g => skill.goal_ids.includes(g.id))
                                                    .map(g => g.goal)
                                                    .join(", ")
                                                : <span style={{ color: "#999", fontStyle: "italic" }}>No sub-programs selected</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="modern-form-section" style={{ marginTop: "1.5rem" }}>
                            <h2 className="modern-form-section-title">Select Learning Content</h2>
                            <p className="modern-form-section-description">
                                Choose one or more learning content items for this program.
                            </p>
                            <div className="search-container">
                                <Search className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search content by title or type..."
                                    value={searchTerm.content}
                                    onChange={(e) => setSearchTerm((prev) => ({ ...prev, content: e.target.value }))}
                                    className="search-input"
                                />
                            </div>
                            <p className="modern-form-section-description" style={{ marginBottom: "0.75rem" }}>
                                Showing {filteredContents.length} of {contents.length} items. Selected: {formData.content_ids.length}
                            </p>
                            {contents.length === 0 ? (
                                <p className="empty-state">No learning content available</p>
                            ) : (
                                <div className="content-grid-container">
                                    {filteredContents.length > 0 ? (
                                        filteredContents.map((content) => {
                                            const checked = formData.content_ids.includes(content.id);
                                            return (
                                                <div
                                                    key={content.id}
                                                    className={`content-card ${checked ? "card-selected" : ""}`}
                                                    onClick={() => handleContentToggle(content.id)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            handleContentToggle(content.id);
                                                        }
                                                    }}
                                                >
                                                    {content.content_type === "image" && content.file_url && (
                                                        <div className="content-thumbnail" style={{ marginBottom: "0.6rem" }}>
                                                            <img
                                                                src={learningContentService.getFileUrl(content.file_url)}
                                                                alt={getContentTitle(content)}
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    )}
                                                    {(content.content_type === "video" || content.content_type === "youtube") && (
                                                        <div className="content-thumbnail" style={{ marginBottom: "0.6rem" }}>
                                                            {getThumbnailUrl(content) ? (
                                                                <img
                                                                    src={getThumbnailUrl(content)}
                                                                    alt={`${getContentTitle(content)} thumbnail`}
                                                                    loading="lazy"
                                                                />
                                                            ) : (content.content_type === "youtube" && getYoutubeThumbnailUrl(content)) ? (
                                                                <img
                                                                    src={getYoutubeThumbnailUrl(content)}
                                                                    alt={`${getContentTitle(content)} thumbnail`}
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                content.file_url ? (
                                                                    <video
                                                                        src={learningContentService.getFileUrl(content.file_url)}
                                                                        muted
                                                                        preload="metadata"
                                                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                                                    />
                                                                ) : null
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="content-info">
                                                        <div className="content-title" title={getContentTitle(content)} style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                                                            {getContentTitle(content)}
                                                        </div>
                                                        <div className="content-type">{getContentTypeLabel(content.content_type)}</div>
                                                        <div className="cell-text-secondary" style={{ marginTop: "0.4rem", fontSize: "0.78rem", lineHeight: 1.4 }}>
                                                            {getContentDescription(content)}
                                                        </div>
                                                        {getContentUrl(content) && (
                                                            <div style={{ marginTop: "0.55rem" }}>
                                                                <a
                                                                    href={getContentUrl(content)}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="modern-form-helper-text"
                                                                    style={{ fontSize: "0.78rem", color: "#7A2C2C", textDecoration: "underline" }}
                                                                >
                                                                    Open actual content
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="content-checkbox" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => handleContentToggle(content.id)}
                                                            className="custom-checkbox-sm"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="content-empty">No content found for your search</div>
                                    )}
                                </div>
                            )}

                            <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                                <button
                                    type="button"
                                    onClick={() => navigate("/head/manage-sessions")}
                                    className="modern-form-btn modern-form-btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="modern-form-btn modern-form-btn-primary"
                                    disabled={creatingProgram}
                                >
                                    {creatingProgram ? "Creating..." : "Create Program"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateProgram;
