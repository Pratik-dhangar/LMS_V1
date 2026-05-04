import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

const EditProgram = () => {
    const navigate = useNavigate();
    const { programId } = useParams();
    const learnerDropdownRef = useRef(null);

    const [loadingData, setLoadingData] = useState(true);
    const [savingProgram, setSavingProgram] = useState(false);

    const [learners, setLearners] = useState([]);
    const [learner, setLearner] = useState(null);
    const [learningGoals, setLearningGoals] = useState([]);
    const [learningSkills, setLearningSkills] = useState([]);
    const [contents, setContents] = useState([]);
    const [showLearnerDropdown, setShowLearnerDropdown] = useState(false);

    const [searchTerm, setSearchTerm] = useState({
        learner: "",
        goal: "",
        content: "",
    });

    const [formData, setFormData] = useState({
        name: "",
        skill: "",
        goal_ids: [],
        skills: [],
        content_ids: [],
        learner_id: null,
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
    }, [programId]);

    const fetchData = async () => {
        try {
            setLoadingData(true);

            // Fetch the program details
            const programData = await programService.getProgramById(parseInt(programId));

            // Fetch learning goals, contents, and learners in parallel
            const [goalsData, skillsData, contentsData, learnersData] = await Promise.all([
                learningGoalsService.head.getAll(),
                learningSkillsService.head.getAll(),
                learningContentService.head.getAll(),
                headService.getLearnersForSessionScheduling(),
            ]);

            // Find the learner name from the learners list
            const learnerInfo = learnersData.find(
                (l) => l.id === programData.learner_id
            );

            // Set learner info from program
            setLearner({
                id: programData.learner_id,
                name: learnerInfo?.name || `Unknown Learner`,
            });

            setLearners(learnersData || []);
            setLearningGoals(goalsData || []);
            setLearningSkills(skillsData || []);
            setContents(contentsData || []);

            // Populate form data with existing program data
            setFormData({
                name: programData.name || "",
                skill: programData.skill || programData.description || "",
                goal_ids: programData.goal_ids || [],
                skills: programData.skills || [],
                content_ids: programData.content_ids || [],
                learner_id: programData.learner_id,
            });
        } catch (error) {
            toast.error(
                error.response?.data?.detail || "Failed to load program data"
            );
            navigate("/head/manage-sessions");
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

    const filteredGoals = learningGoals.filter(
        (goal) =>
            goal.goal?.toLowerCase().includes(searchTerm.goal.toLowerCase()) ||
            goal.goal_description
                ?.toLowerCase()
                .includes(searchTerm.goal.toLowerCase())
    );

    const getSelectedLearnerName = () => {
        const learnerInfo = learners.find((l) => l.id === parseInt(formData.learner_id));
        return learnerInfo
            ? `${learnerInfo.name} (ID: ${learnerInfo.id}) - ${learnerInfo.remaining_sessions} sessions - ${learnerInfo.status_text}`
            : "";
    };

    const handleLearnerSelect = (learnerId) => {
        setFormData((prev) => ({
            ...prev,
            learner_id: learnerId,
        }));
        setShowLearnerDropdown(false);
        setSearchTerm((prev) => ({ ...prev, learner: "" }));
    };

    const handleContentToggle = (contentId) => {
        setFormData((prev) => ({
            ...prev,
            content_ids: prev.content_ids.includes(contentId)
                ? prev.content_ids.filter((id) => id !== contentId)
                : [...prev.content_ids, contentId],
        }));
    };

    const handleSkillToggle = (skillId, skillName) => {
        setFormData((prev) => {
            const skillExists = prev.skills.find((s) => Number(s.skill_id) === Number(skillId));
            if (skillExists) {
                return {
                    ...prev,
                    skills: prev.skills.filter((s) => Number(s.skill_id) !== Number(skillId)),
                };
            }
            return {
                ...prev,
                skills: [...prev.skills, { skill_id: skillId, skill_name: skillName, goal_ids: [] }],
            };
        });
    };

    const handleSkillSubProgramToggle = (skillId, goalId) => {
        setFormData((prev) => ({
            ...prev,
            skills: prev.skills.map((skill) => {
                if (Number(skill.skill_id) !== Number(skillId)) return skill;
                const goalIds = Array.isArray(skill.goal_ids) ? skill.goal_ids : [];
                return {
                    ...skill,
                    goal_ids: goalIds.includes(goalId)
                        ? goalIds.filter((id) => id !== goalId)
                        : [...goalIds, goalId],
                };
            }),
        }));
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

    const resolveGoalNameById = (goalId) => {
        const goal = learningGoals.find((item) => Number(item.id) === Number(goalId));
        return goal?.goal || goal?.name || goal?.title || `Goal #${goalId}`;
    };

    const renderProgramStructure = () => {
        const skills = Array.isArray(formData.skills) ? formData.skills : [];

        if (skills.length > 0) {
            return (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {skills.map((skill, skillIndex) => {
                        const skillName = (skill?.skill_name || "").trim() || `Skill ${skillIndex + 1}`;
                        const goalIds = Array.isArray(skill?.goal_ids) ? skill.goal_ids : [];
                        return (
                            <div key={`skill-${skill?.skill_id || skillIndex}`} style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.5rem", background: "#f9fafb" }}>
                                <div style={{ fontWeight: 600, color: "#92400e" }}>Skill - {skillName}</div>
                                {goalIds.length > 0 ? (
                                    goalIds.map((goalId, goalIndex) => (
                                        <div key={`skill-${skillIndex}-goal-${goalIndex}`} style={{ color: "#374151", fontSize: "0.875rem", marginTop: "0.2rem" }}>
                                            Sub-program - {resolveGoalNameById(goalId)}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: "#6b7280", fontSize: "0.875rem", fontStyle: "italic", marginTop: "0.2rem" }}>
                                        No sub-programs under this skill
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (formData.goal_ids.length > 0) {
            return (
                <div style={{ padding: "0.75rem", border: "1px solid #e5e7eb", borderRadius: "0.5rem", background: "#f9fafb" }}>
                    {formData.skill && (
                        <div style={{ fontWeight: 600, color: "#92400e" }}>Skill - {formData.skill}</div>
                    )}
                    {formData.goal_ids.map((goalId, idx) => (
                        <div key={`goal-${idx}`} style={{ color: "#374151", fontSize: "0.875rem", marginTop: "0.2rem" }}>
                            Sub-program - {resolveGoalNameById(goalId)}
                        </div>
                    ))}
                </div>
            );
        }

        return <p className="empty-state">No program structure available</p>;
    };

    const handleSaveProgram = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("Please enter a program name");
            return;
        }
        if (!formData.learner_id) {
            toast.error("Please select a learner");
            return;
        }
        if (formData.skills.length === 0) {
            toast.error("Please select at least one skill");
            return;
        }
        const hasSubPrograms = formData.skills.some((skill) => (skill.goal_ids || []).length > 0);
        if (!hasSubPrograms) {
            toast.error("Please select at least one sub-program for any selected skill");
            return;
        }
        if (formData.content_ids.length === 0) {
            toast.error("Please select at least one learning content");
            return;
        }

        try {
            setSavingProgram(true);
            const allGoalIds = Array.from(new Set(formData.skills.flatMap((skill) => skill.goal_ids || [])));
            const updated = await programService.updateProgram(parseInt(programId), {
                name: formData.name.trim(),
                learner_id: parseInt(formData.learner_id),
                skill: formData.skill.trim() || null,
                goal_ids: allGoalIds,
                skills: formData.skills,
                content_ids: formData.content_ids,
            });

            toast.success(`Program "${updated.name}" updated successfully`);
            navigate("/head/manage-sessions");
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to update program");
        } finally {
            setSavingProgram(false);
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
                            <h1 className="page-title">Edit Program</h1>
                            <p className="page-description">
                                Update program details and sub-programs
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSaveProgram} className="modern-form-card">
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
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, name: e.target.value }))
                                        }
                                        className="modern-form-input"
                                        placeholder="e.g. Program-A"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="modern-form-label">Skill</label>
                                    <input
                                        type="text"
                                        value={formData.skill}
                                        onChange={(e) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                skill: e.target.value,
                                            }))
                                        }
                                        className="modern-form-input"
                                        placeholder="Optional skill name"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modern-form-section" ref={learnerDropdownRef}>
                            <h2 className="modern-form-section-title">Select Learner</h2>
                            <p className="modern-form-section-description">
                                Update the learner for this program.
                            </p>
                            <div className="dropdown-field">
                                <input
                                    type="text"
                                    placeholder="Search learner by name or ID..."
                                    value={formData.learner_id ? getSelectedLearnerName() : searchTerm.learner}
                                    onChange={(e) => {
                                        if (formData.learner_id) {
                                            setFormData((prev) => ({ ...prev, learner_id: null }));
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
                            <h2 className="modern-form-section-title">Edit Skills & Sub-Programs</h2>
                            <p className="modern-form-section-description">
                                Add/remove skills and add/remove sub-programs under each selected skill.
                            </p>

                            <div className="search-container" style={{ marginBottom: "0.75rem" }}>
                                <Search className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search sub-programs by name or description..."
                                    value={searchTerm.goal}
                                    onChange={(e) => setSearchTerm((prev) => ({ ...prev, goal: e.target.value }))}
                                    className="search-input"
                                />
                            </div>

                            {learningSkills.length === 0 ? (
                                <p className="empty-state">No learning skills available</p>
                            ) : (
                                <div className="table-primary-container">
                                    {learningSkills.map((skill) => {
                                        const selectedSkill = formData.skills.find(
                                            (s) => Number(s.skill_id) === Number(skill.id)
                                        );
                                        return (
                                            <div
                                                key={skill.id}
                                                style={{
                                                    border: "1px solid #e5e7eb",
                                                    borderRadius: "0.5rem",
                                                    marginBottom: "0.75rem",
                                                    background: "#fff",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "0.75rem",
                                                        padding: "0.75rem",
                                                        borderBottom: selectedSkill ? "1px solid #f1f5f9" : "none",
                                                        background: selectedSkill ? "#fef3e2" : "#f8fafc",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selectedSkill}
                                                        onChange={() => handleSkillToggle(skill.id, skill.skill_name)}
                                                    />
                                                    <div style={{ fontWeight: 600, color: "#92400e" }}>
                                                        Skill - {skill.skill_name}
                                                    </div>
                                                </div>

                                                {selectedSkill && (
                                                    <div style={{ padding: "0.75rem" }}>
                                                        <div style={{ fontSize: "0.875rem", marginBottom: "0.5rem", color: "#475569" }}>
                                                            Select sub-programs for this skill:
                                                        </div>
                                                        <div style={{ display: "grid", gap: "0.5rem" }}>
                                                            {filteredGoals.length > 0 ? (
                                                                filteredGoals.map((goal) => {
                                                                    const checked = (selectedSkill.goal_ids || []).includes(goal.id);
                                                                    return (
                                                                        <label
                                                                            key={goal.id}
                                                                            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={checked}
                                                                                onChange={() =>
                                                                                    handleSkillSubProgramToggle(skill.id, goal.id)
                                                                                }
                                                                            />
                                                                            <div>
                                                                                <div style={{ color: "#1f2937", fontWeight: 500 }}>
                                                                                    Sub-program - {goal.goal}
                                                                                </div>
                                                                                <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                                                                                    {goal.goal_description || "-"}
                                                                                </div>
                                                                            </div>
                                                                        </label>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="empty-state">No sub-programs found for your search</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div style={{ marginTop: "0.75rem" }}>
                                <div className="modern-form-section-description" style={{ marginBottom: "0.25rem" }}>
                                    Selected structure preview:
                                </div>
                                {renderProgramStructure()}
                            </div>
                        </div>

                        <div className="modern-form-section" style={{ marginTop: "1.5rem" }}>
                            <h2 className="modern-form-section-title">Select Learning Content</h2>
                            <p className="modern-form-section-description">
                                Update learning content for this program.
                            </p>
                            <div className="search-container">
                                <Search className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search content by title or type..."
                                    value={searchTerm.content}
                                    onChange={(e) =>
                                        setSearchTerm((prev) => ({ ...prev, content: e.target.value }))
                                    }
                                    className="search-input"
                                />
                            </div>
                            <p
                                className="modern-form-section-description"
                                style={{ marginBottom: "0.75rem" }}
                            >
                                Showing {filteredContents.length} of {contents.length} items.
                                Selected: {formData.content_ids.length}
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
                                                        <div
                                                            className="content-title"
                                                            title={getContentTitle(content)}
                                                            style={{ whiteSpace: "normal", lineHeight: 1.35 }}
                                                        >
                                                            {getContentTitle(content)}
                                                        </div>
                                                        <div className="content-type">{getContentTypeLabel(content.content_type)}</div>
                                                        <div
                                                            className="cell-text-secondary"
                                                            style={{ marginTop: "0.4rem", fontSize: "0.78rem", lineHeight: 1.4 }}
                                                        >
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
                                                                    style={{
                                                                        fontSize: "0.78rem",
                                                                        color: "#7A2C2C",
                                                                        textDecoration: "underline",
                                                                    }}
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
                        </div>

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
                                disabled={savingProgram}
                            >
                                {savingProgram ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditProgram;
