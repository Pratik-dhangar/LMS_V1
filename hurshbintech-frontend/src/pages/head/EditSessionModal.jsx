import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Search } from 'lucide-react';
import learningGoalsService from '../../api/services/learningGoalsService';
import sessionService from '../../api/services/sessionService';
import learningContentService from '../../api/services/learningContentService';
import programService from '../../api/services/programService';
import '../../styles/components/common/Modal.css';


const EditSessionModal = ({ session, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [contents, setContents] = useState([]);
    const [learningGoals, setLearningGoals] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Program state
    const [programList, setProgramList] = useState([]);
    const [selectedProgramId, setSelectedProgramId] = useState(session.program?.id || null);
    const [programMode, setProgramMode] = useState(session.program ? 'existing' : 'none');
    const [programSearch, setProgramSearch] = useState(session.program?.name || '');
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramDescription, setNewProgramDescription] = useState('');
    const [creatingProgram, setCreatingProgram] = useState(false);
    const [loadingPrograms, setLoadingPrograms] = useState(false);
    const [programDropdownOpen, setProgramDropdownOpen] = useState(false);
    const programDropdownRef = useRef(null);

    const [formData, setFormData] = useState({
        title: session.title || '',
        description: session.description || '',
        scheduled_date: session.scheduled_date ? session.scheduled_date.slice(0, 16) : '',
        duration: session.duration || '',
        content_ids: session.learning_contents?.map(c => c.id) || [],
        goal_ids: session.learning_goals?.map(g => g.id) || []
    });

    const [searchTerm, setSearchTerm] = useState({
        goal: '',
        content: ''
    });

    const [tempDate, setTempDate] = useState(formData.scheduled_date || '');
    const CONTENT_PAGE_SIZE = 12;
    const [contentVisibleCount, setContentVisibleCount] = useState(CONTENT_PAGE_SIZE);

    useEffect(() => {
        fetchData();
    }, []);

    // Reset visible count when content search changes
    useEffect(() => {
        setContentVisibleCount(CONTENT_PAGE_SIZE);
    }, [searchTerm.content]);

    const fetchData = async () => {
        try {
            setLoadingData(true);
            const [contentsData, goalsData] = await Promise.all([
                learningContentService.head.getAll(),
                learningGoalsService.head.getAll()
            ]);
            setContents(contentsData);
            setLearningGoals(goalsData);
            // Load programs for this session's learner
            if (session.learner_id) {
                setLoadingPrograms(true);
                try {
                    const programs = await programService.getPrograms(session.learner_id);
                    setProgramList(programs || []);
                } catch {
                    // Non-fatal
                } finally {
                    setLoadingPrograms(false);
                }
            }
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoadingData(false);
        }
    };

    const handleGoalToggle = (goalId) => {
        setFormData(prev => {
            const newGoalIds = prev.goal_ids.includes(goalId)
                ? prev.goal_ids.filter(id => id !== goalId)
                : [...prev.goal_ids, goalId];
            return {
                ...prev,
                goal_ids: newGoalIds
            };
        });
    };

    const handleContentToggle = (contentId) => {
        setFormData(prev => {
            const newContentIds = prev.content_ids.includes(contentId)
                ? prev.content_ids.filter(id => id !== contentId)
                : [...prev.content_ids, contentId];
            return {
                ...prev,
                content_ids: newContentIds
            };
        });
    };

    const handleContentGridScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 150) {
            setContentVisibleCount((prev) => prev + CONTENT_PAGE_SIZE);
        }
    };

    const handleSetDate = () => {
        setFormData({ ...formData, scheduled_date: tempDate });
        console.log("Date set:", tempDate);
    };

    // ── Program handlers ──────────────────────────────────────────────────────
    const handleProgramModeChange = (mode) => {
        setProgramMode(mode);
        if (mode !== 'existing') {
            setSelectedProgramId(null);
            setProgramSearch('');
            setFormData(prev => ({ ...prev, goal_ids: [], content_ids: [] }));
        }
    };

    const handleSelectExistingProgram = (program) => {
        setSelectedProgramId(program.id);
        setProgramSearch(program.name);
        setProgramDropdownOpen(false);
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
                skill: newProgramDescription.trim() || null,
                learner_id: session.learner_id,
                goal_ids: formData.goal_ids,
                content_ids: formData.content_ids,
            });
            toast.success(`Program "${created.name}" created`);
            setSelectedProgramId(created.id);
            setProgramMode('existing');
            setProgramSearch(created.name);
            setNewProgramName('');
            setNewProgramDescription('');
            const programs = await programService.getPrograms(session.learner_id);
            setProgramList(programs || []);
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to create program');
        } finally {
            setCreatingProgram(false);
        }
    };
    // ────────────────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title || !formData.scheduled_date || !formData.duration) {
            toast.error('Please fill in all required fields');
            return;
        }

        // Validate scheduled_date
        const dateObj = new Date(formData.scheduled_date);
        if (isNaN(dateObj.getTime())) {
            toast.error('Please select a valid date and time.');
            return;
        }

        const scheduled_date = formData.scheduled_date + ':00';

        const sessionPayload = {
            title: formData.title,
            description: formData.description || null,
            scheduled_date,
            duration: parseInt(formData.duration),
            content_ids: formData.content_ids.map(Number),
            goal_ids: formData.goal_ids.map(Number),
            ...(selectedProgramId ? { program_id: selectedProgramId } : {}),
        };

        try {
            setLoading(true);
            await sessionService.updateSession(session.session_id, sessionPayload);
            toast.success('Session updated successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    const errorMessages = error.response.data.detail.map(err =>
                        `${err.loc.join('.')}: ${err.msg}`
                    ).join(', ');
                    toast.error(`Validation error: ${errorMessages}`);
                } else {
                    toast.error(error.response.data.detail);
                }
            } else {
                toast.error('Failed to update session');
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredGoals = learningGoals.filter(goal =>
        goal.goal?.toLowerCase().includes(searchTerm.goal.toLowerCase()) ||
        goal.goal_description?.toLowerCase().includes(searchTerm.goal.toLowerCase())
    );

    const filteredContents = contents.filter(content =>
        content.title?.toLowerCase().includes(searchTerm.content.toLowerCase()) ||
        content.content_type?.toLowerCase().includes(searchTerm.content.toLowerCase())
    );

    // Programs filtered by search
    const filteredPrograms = programList.filter(p =>
        p.name?.toLowerCase().includes(programSearch.toLowerCase())
    );
    const selectedProgram = selectedProgramId
        ? programList.find(p => p.id === selectedProgramId) || null
        : null;
    const lockedGoals = selectedProgram
        ? learningGoals.filter(g => (selectedProgram.goal_ids || []).includes(g.id))
        : [];

    const getProgramMetaText = (prog) => {
        const skills = Array.isArray(prog?.skills) ? prog.skills : [];
        const skillNames = skills
            .map((skill) => (skill?.skill_name || '').trim())
            .filter(Boolean);
        const skillCount = skills.length;
        const subProgramCount = (prog?.goal_ids || []).length;
        const contentCount = (prog?.content_ids || []).length;

        if (skillCount > 0) {
            const skillLabel = skillNames.length > 0 ? skillNames.join(', ') : `${skillCount} skill(s)`;
            return ` | Skill: ${skillLabel} — Sub-programs: ${subProgramCount}, Learning-Content: ${contentCount}`;
        }

        if (prog?.skill) {
            return ` | Skill: ${prog.skill} — Sub-programs: ${subProgramCount}, Learning-Content: ${contentCount}`;
        }

        return ` — Sub-programs: ${subProgramCount}, Learning-Content: ${contentCount}`;
    };

    const renderSelectedProgramStructure = (prog) => {
        if (!prog) return null;

        const skills = Array.isArray(prog.skills) ? prog.skills : [];

        if (skills.length > 0) {
            return (
                <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                    {skills.map((skill, index) => {
                        const skillName = (skill?.skill_name || '').trim() || `Skill ${index + 1}`;
                        const goalIds = Array.isArray(skill?.goal_ids) ? skill.goal_ids : [];
                        const skillGoals = learningGoals
                            .filter((goal) => goalIds.includes(goal.id))
                            .map((goal) => goal.goal || goal.name || goal.title || `Goal #${goal.id}`);

                        return (
                            <div key={`${prog.id}-skill-${skill.skill_id || index}`} style={{ marginBottom: '0.35rem' }}>
                                <div style={{ fontWeight: 600, color: '#92400e' }}>Skill - {skillName}</div>
                                {skillGoals.length > 0 ? (
                                    skillGoals.map((goalText, goalIndex) => (
                                        <div key={`${prog.id}-skill-${index}-sub-${goalIndex}`} style={{ color: '#374151', fontSize: '0.875rem' }}>
                                            Sub-program - {goalText}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                        No sub-programs under this skill
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (prog.skill || lockedGoals.length > 0) {
            return (
                <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                    {prog.skill && (
                        <div style={{ fontWeight: 600, color: '#92400e' }}>Skill - {prog.skill}</div>
                    )}
                    {lockedGoals.length > 0 ? (
                        lockedGoals.map((goal, index) => (
                            <div key={`${prog.id}-fallback-sub-${index}`} style={{ color: '#374151', fontSize: '0.875rem' }}>
                                Sub-program - {goal.goal || goal.name || goal.title || `Goal #${goal.id}`}
                            </div>
                        ))
                    ) : (
                        <div style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>
                            No sub-programs assigned
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    if (loadingData) {
        return (
            <div className="app-modal-overlay">
                <div className="app-modal-container" style={{ maxWidth: '1024px' }}>
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-modal-overlay">
            <div className="app-modal-container" style={{ maxWidth: '1024px', maxHeight: '90vh', overflowY: 'auto' }}>
                {/* Header */}
                <div className="app-modal-header app-modal-header--primary">
                    <div>
                        <h2 className="app-modal-title">Edit Session</h2>
                        <p className="app-modal-subtitle">{session.learner_name} - {session.trainer_name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="app-modal-close"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="app-modal-content">
                    <form onSubmit={handleSubmit}>
                        {/* Title */}
                        <div className="app-modal-form-field">
                            <label className="app-modal-form-label">
                                Session Title <span className="text-required">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="app-modal-form-textarea"
                                rows="3"
                                placeholder="Session description (optional)"
                            />
                        </div>

                        <div className="app-modal-form-grid app-modal-form-grid app-modal-form-grid--2">
                            {/* Scheduled Date/Time */}
                            <div className="app-modal-form-field">
                                <label className="app-modal-form-label">
                                    Date & Time <span className="text-required">*</span>
                                </label>
                                <div className="app-modal-input-group">
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
                                        style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', flexShrink: 0, minWidth: 'auto' }}
                                    >
                                        Set
                                    </button>
                                </div>
                                {formData.scheduled_date && (
                                    <p className="form-helper-text">
                                        Confirmed time: {new Date(formData.scheduled_date).toLocaleString()}
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
                                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
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

                        {/* Select Program — parent section containing goals + content */}
                        <div className="app-modal-form-field">
                            <label className="app-modal-form-label">Select Program</label>
                            <p className="form-helper-text" style={{ marginBottom: '0.75rem' }}>
                                Link this session to a program, or adjust goals/content directly.
                            </p>

                            {/* Program mode switcher */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                {['none', 'existing', 'new'].map((mode) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => handleProgramModeChange(mode)}
                                        className={`app-modal-btn ${programMode === mode ? 'app-modal-btn--primary' : 'app-modal-btn--secondary'
                                            }`}
                                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}
                                    >
                                        {mode === 'none' && 'No Program'}
                                        {mode === 'existing' && 'Select Existing'}
                                        {mode === 'new' && '+ Create New'}
                                    </button>
                                ))}
                            </div>

                            {/* Existing program picker */}
                            {programMode === 'existing' && (
                                <div ref={programDropdownRef} style={{ position: 'relative', marginBottom: '1rem' }}>
                                    {loadingPrograms ? (
                                        <p className="form-helper-text">Loading programs...</p>
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
                                                className="app-modal-form-input"
                                            />
                                            {programDropdownOpen && (
                                                <div className="dropdown-menu" style={{ position: 'absolute', zIndex: 50, width: '100%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.14)', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                                    {filteredPrograms.length > 0 ? (
                                                        filteredPrograms.map(prog => (
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
                                                            {programList.length === 0 ? 'No programs found for this learner' : 'No programs match'}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {selectedProgram && (
                                                <div className="form-helper-text" style={{ marginTop: '0.4rem' }}>
                                                    <p>
                                                        ✅ Program &quot;<strong>{selectedProgram.name}</strong>&quot; selected.
                                                    </p>
                                                    {renderSelectedProgramStructure(selectedProgram)}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Create new program */}
                            {programMode === 'new' && (
                                <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#f9fafb', marginBottom: '1rem' }}>
                                    <p className="form-helper-text" style={{ marginBottom: '0.75rem' }}>
                                        Select goals and content below, then click <strong>Create Program</strong>.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                        <div style={{ flex: '1 1 180px' }}>
                                            <label className="app-modal-form-label">Program Name *</label>
                                            <input
                                                type="text"
                                                value={newProgramName}
                                                onChange={(e) => setNewProgramName(e.target.value)}
                                                className="app-modal-form-input"
                                                placeholder="e.g. Program-A"
                                            />
                                        </div>
                                        <div style={{ flex: '1 1 180px' }}>
                                            <label className="app-modal-form-label">Description</label>
                                            <input
                                                type="text"
                                                value={newProgramDescription}
                                                onChange={(e) => setNewProgramDescription(e.target.value)}
                                                className="app-modal-form-input"
                                                placeholder="Optional"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleCreateNewProgram}
                                            disabled={creatingProgram}
                                            className="app-modal-btn app-modal-btn--primary"
                                            style={{ whiteSpace: 'nowrap' }}
                                        >
                                            {creatingProgram ? 'Creating...' : 'Create Program'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Goals subsection ───────────────────────────────────────── */}
                            <div className="app-modal-form-field" style={{ marginTop: '1.25rem' }}>
                                <label className="app-modal-form-label">
                                    Select Learning Goals
                                </label>

                                <>
                                    {selectedProgramId ? (
                                        <p className="form-helper-text" style={{ marginBottom: '0.5rem' }}>
                                            Goals are pre-loaded from the selected program and can be edited.
                                        </p>
                                    ) : (
                                        <p className="form-helper-text">Choose learning goals for this session</p>
                                    )}
                                    <div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="Search goals..."
                                                    value={searchTerm.goal}
                                                    onChange={(e) => setSearchTerm({ ...searchTerm, goal: e.target.value })}
                                                    className="app-modal-form-input"
                                                    style={{ paddingLeft: '40px', paddingRight: '40px' }}
                                                />
                                                {searchTerm.goal && (
                                                    <button type="button" onClick={() => setSearchTerm({ ...searchTerm, goal: '' })} className="btn-icon-secondary" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}>✕</button>
                                                )}
                                            </div>
                                        </div>
                                        {learningGoals.length === 0 ? (
                                            <p className="text-gray-500 text-center py-4 border rounded">No learning goals available</p>
                                        ) : (
                                            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-64 overflow-y-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-[#34495e] text-white sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider w-12">Select</th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Goal</th>
                                                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {filteredGoals.length > 0 ? (
                                                            filteredGoals.map((goal) => (
                                                                <tr key={goal.id} onClick={() => handleGoalToggle(goal.id)} className={`cursor-pointer hover:bg-gray-50 transition-colors ${formData.goal_ids.includes(goal.id) ? 'bg-[#fef3e2]' : ''}`}>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <input type="checkbox" checked={formData.goal_ids.includes(goal.id)} onChange={() => { }} className="h-4 w-4 text-[#DB9D32] rounded" />
                                                                    </td>
                                                                    <td className="px-4 py-3"><div className="text-sm font-medium text-gray-900">{goal.goal}</div></td>
                                                                    <td className="px-4 py-3"><div className="text-sm text-gray-500">{goal.goal_description}</div></td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr><td colSpan="3" className="px-4 py-3 text-center text-gray-500 text-sm">No goals match your search</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-2">{formData.goal_ids.length} goal(s) selected</p>
                                </>
                            </div>

                            {/* ── Content subsection ─────────────────────────────────────── */}
                            <div className="app-modal-form-field" style={{ marginTop: '1.25rem' }}>
                                <label className="app-modal-form-label">Select Learning Content (Optional)</label>
                                <p className="form-helper-text">
                                    {selectedProgramId
                                        ? `Content pre-loaded from program "${selectedProgram?.name}". You can add or remove items.`
                                        : 'Choose content that will be available during the session'}
                                </p>
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search content by title or type..."
                                            value={searchTerm.content}
                                            onChange={(e) => setSearchTerm({ ...searchTerm, content: e.target.value })}
                                            className="app-modal-form-input"
                                            style={{ paddingLeft: '40px', paddingRight: '40px' }}
                                        />
                                        {searchTerm.content && (
                                            <button type="button" onClick={() => setSearchTerm({ ...searchTerm, content: '' })} className="btn-icon-secondary" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}>✕</button>
                                        )}
                                    </div>
                                </div>
                                {contents.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4 border rounded">No learning content available</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto border rounded p-2" onScroll={handleContentGridScroll}>
                                        {filteredContents.length > 0 ? (
                                            <>
                                                {filteredContents.slice(0, contentVisibleCount).map(content => {
                                                    const getContentIcon = (type) => {
                                                        const icons = { image: '🖼️', pdf: '📄', video: '🎥', audio: '🎵', document: '📝' };
                                                        return icons[type] || '📁';
                                                    };
                                                    const renderThumbnail = () => {
                                                        if (content.content_type === 'image' || content.thumbnail_url) {
                                                            const imageUrl = learningContentService.getFileUrl(content.content_type === 'image' ? content.file_url : content.thumbnail_url);
                                                            return (
                                                                <div className="relative w-full h-16 bg-gray-100 rounded overflow-hidden">
                                                                    <img src={imageUrl} alt={content.title} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} />
                                                                    <div className="hidden absolute inset-0 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200"><span className="text-2xl">{getContentIcon(content.content_type)}</span></div>
                                                                </div>
                                                            );
                                                        }
                                                        return (<div className="w-full h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center"><span className="text-2xl">{getContentIcon(content.content_type)}</span></div>);
                                                    };
                                                    return (
                                                        <div key={content.id} onClick={() => handleContentToggle(content.id)} className={`p-2 border rounded cursor-pointer transition-all relative ${formData.content_ids.includes(content.id) ? 'border-[#DB9D32] bg-[#fef3e2] shadow-md' : 'border-gray-300 hover:border-[#DB9D32] hover:shadow'}`}>
                                                            {renderThumbnail()}
                                                            <div className="mt-1.5">
                                                                <h4 className="font-medium text-xs line-clamp-1" title={content.title}>{content.title}</h4>
                                                                <p className="text-[10px] text-gray-500 uppercase mt-0.5">{content.content_type}</p>
                                                            </div>
                                                            <div className="absolute top-1 right-1">
                                                                <input type="checkbox" checked={formData.content_ids.includes(content.id)} onChange={() => { }} className="h-3.5 w-3.5 text-[#DB9D32] rounded" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {filteredContents.length > contentVisibleCount && (
                                                    <div className="col-span-full flex justify-center items-center py-3 text-sm text-gray-400 gap-2">
                                                        <svg className="animate-spin h-4 w-4 text-[#DB9D32]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                        </svg>
                                                        Loading more...
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="col-span-full text-center text-gray-500 py-8">No content matches your search</div>
                                        )}
                                    </div>
                                )}
                                <p className="text-sm text-gray-500 mt-2">{formData.content_ids.length} item(s) selected</p>
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="app-modal-footer">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading}
                            >
                                {loading ? 'Updating...' : 'Save Changes'}
                            </button>

                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EditSessionModal;
