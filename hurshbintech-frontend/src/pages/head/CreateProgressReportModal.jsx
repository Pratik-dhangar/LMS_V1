import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import headService from '../../api/services/headService';
import coachService from '../../api/services/coachService';
import '../../styles/components/common/Modal.css';

const DEVELOPMENT_AREAS = [
    { key: 'attention_cooperation', label: 'Attention & Co-Operation' },
    { key: 'sensory_integration_motor', label: 'Sensory Integration & Motor Coordination' },
    { key: 'speech_language_communication', label: 'Speech, Language & Communication' },
    { key: 'play_leisure', label: 'Play & Leisure' },
    { key: 'social_interaction_group', label: 'Social Interaction and Group Behaviour' },
    { key: 'emotional_regulation', label: 'Emotional Regulation' },
    { key: 'independent_living', label: 'Independent Living' },
    { key: 'academic_readiness', label: 'Academic Readiness' },
    { key: 'professional_development', label: 'Professional Development' },
];

const EMPTY_FORM = {
    name: '',
    referred_by: '',
    date_of_birth: '',
    date_of_report: new Date().toISOString().split('T')[0],
    birth_history: '',
    development_history: '',
    learning_history: '',
    attention_cooperation: '',
    sensory_integration_motor: '',
    speech_language_communication: '',
    play_leisure: '',
    social_interaction_group: '',
    emotional_regulation: '',
    independent_living: '',
    academic_readiness: '',
    professional_development: '',
    intervention_plan: '',
    recommendation: '',
    conclusion: '',
    report_created_by: '',
    digital_signature: '',
};

/**
 * CreateProgressReportModal
 * Props:
 *   learnerId  - optional, pre-fills learner_id
 *   learnerName - optional, pre-fills the name field
 *   onClose    - callback to close the modal
 *   onCreated  - callback after successful creation
 */
const CreateProgressReportModal = ({ learnerId = null, learnerName = '', onClose, onCreated }) => {
    const { user } = useAuth();
    const [form, setForm] = useState({ ...EMPTY_FORM, name: learnerName });
    const [step, setStep] = useState('form'); // 'form' | 'preview'
    const [saving, setSaving] = useState(false);
    const [selectedLearnerId, setSelectedLearnerId] = useState(learnerId);
    const DEFAULT_SIGNATURE_IMG = '/sign/sign.jpeg'; // Default signature image from public folder

    // Coach Q&A state
    const [coachQaPairs, setCoachQaPairs] = useState([]);

    // Learner dropdown state
    const [learners, setLearners] = useState([]);
    const [learnerSearch, setLearnerSearch] = useState(learnerName);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Check if user is coach
    const isCoach = user?.role?.toLowerCase() === 'coach';

    // Auto-fill Report Created By from logged-in user
    useEffect(() => {
        if (user?.name) {
            const role = user.role
                ? user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
                : '';
            const label = role ? `${user.name} (${role})` : user.name;
            setForm(prev => ({ ...prev, report_created_by: label }));
        }
    }, [user]);

    // Fetch learners on mount — HEAD uses headService, COACH uses coachService
    useEffect(() => {
        if (user?.role?.toLowerCase() === 'coach') {
            coachService.getAvailableLearners()
                .then(data => {
                    // Normalize coach learner data to match head format; preserve all fields
                    const normalized = (data || []).map(l => ({
                        ...l,  // Keep all original fields
                        id: l.id || l.user_id,
                        user_id: l.user_id || l.id,
                        name: l.name,
                        dob: l.dob || l.date_of_birth,
                        date_of_birth: l.date_of_birth || l.dob,
                    }));
                    setLearners(normalized);
                })
                .catch(() => { });
        } else {
            headService.getAllLearners()
                .then(data => setLearners(data || []))
                .catch(() => { });
        }
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredLearners = learners.filter(l =>
        l.name?.toLowerCase().includes(learnerSearch.toLowerCase())
    );

    const handleSelectLearner = (learner) => {
        const dob = learner.dob || learner.date_of_birth || '';
        setSelectedLearnerId(learner.user_id || learner.id || null);
        setLearnerSearch(learner.name);
        setForm(prev => ({
            ...prev,
            name: learner.name,
            date_of_birth: dob ? dob.split('T')[0] : '',
        }));
        setShowDropdown(false);
    };

    // Coach Q&A Handlers
    const handleAddQAPair = () => {
        setCoachQaPairs(prev => [...prev, { number: '.', heading: '', answer: '' }]);
    };

    const handleRemoveQAPair = (idx) => {
        setCoachQaPairs(prev => prev.filter((_, i) => i !== idx));
    };

    const handleUpdateQAPair = (idx, field, value) => {
        setCoachQaPairs(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    const handleChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handlePreview = (e) => {
        e.preventDefault();
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (!form.date_of_report) {
            toast.error('Date of Report is required');
            return;
        }
        if (isCoach && coachQaPairs.length === 0) {
            toast.error('Please add at least one question-answer pair');
            return;
        }
        setStep('preview');
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);

            // For Coach reports, validate Q&A pairs exist
            if (isCoach && coachQaPairs.length === 0) {
                toast.error('Please add at least one question-answer pair');
                setSaving(false);
                return;
            }

            const payload = {
                ...form,
                learner_id: selectedLearnerId || learnerId || null,
                date_of_birth: form.date_of_birth || null,
                date_of_report: form.date_of_report,
                report_type: isCoach ? 'coach' : 'head',
            };

            // For coach, set Q&A data and clear the 9 fields
            if (isCoach) {
                payload.coach_qna_data = coachQaPairs;
                // Clear all development area fields for coach reports
                DEVELOPMENT_AREAS.forEach(area => {
                    payload[area.key] = null;
                });
            }

            // Strip empty strings to null for optional fields
            Object.keys(payload).forEach((k) => {
                if (payload[k] === '') payload[k] = null;
            });

            const created = await learnerProgressReportService.create(payload);
            toast.success('Progress report created successfully!');
            onCreated && onCreated(created);
            onClose();
        } catch (error) {
            console.error('Error creating report:', error);
            const msg = error.response?.data?.detail || 'Failed to create report';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const fmt = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    /* ─────────────────────── FORM VIEW ─────────────────────── */
    if (step === 'form') {
        return (
            <div className="app-modal-overlay" onClick={onClose}>
                <div
                    className="app-modal-container app-modal-container--xl"
                    style={{ maxHeight: '90vh', overflowY: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="app-modal-header app-modal-header--primary modal-header-gold"
                        style={{ background: 'linear-gradient(135deg, #7c1c1c, #a83232)', color: 'white', padding: '1.25rem 1.5rem', borderRadius: '0.75rem 0.75rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>📋 Create Progress Report</h2>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                                Fill in the developmental assessment form
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'white', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handlePreview} style={{ padding: '1.5rem' }}>

                        {/* ── Basic Info ── */}
                        <SectionHeading title="Basic Information" />
                        <div style={gridStyle(2)}>
                            {/* Learner Name — searchable dropdown for both Head and Coach */}
                            <Field label="Name *">
                                <div ref={dropdownRef} style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        value={learnerSearch}
                                        onChange={(e) => {
                                            setLearnerSearch(e.target.value);
                                            handleChange('name', e.target.value);
                                            setShowDropdown(true);
                                            if (!e.target.value) setSelectedLearnerId(null);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder="Search or type learner name..."
                                        required
                                        style={inputStyle}
                                        autoComplete="off"
                                    />
                                    {showDropdown && (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0,
                                            background: 'white', border: '1px solid #d1d5db',
                                            borderRadius: '0 0 0.375rem 0.375rem',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                            zIndex: 9999, maxHeight: '200px', overflowY: 'auto',
                                        }}>
                                            {filteredLearners.length === 0 ? (
                                                <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                                                    No learners found
                                                </div>
                                            ) : (
                                                filteredLearners.map(l => (
                                                    <div
                                                        key={l.id || l.user_id}
                                                        onMouseDown={() => handleSelectLearner(l)}
                                                        style={{
                                                            padding: '0.5rem 0.75rem', cursor: 'pointer',
                                                            fontSize: '0.88rem', borderBottom: '1px solid #f3f4f6',
                                                            display: 'flex', flexDirection: 'column',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                    >
                                                        <span style={{ fontWeight: 600, color: '#111' }}>{l.name}</span>
                                                        {(l.dob || l.date_of_birth) && (
                                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                                DOB: {new Date(l.dob || l.date_of_birth).toLocaleDateString('en-IN')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Field>
                            <Field label="Refered by:">
                                <input
                                    type="text"
                                    value={form.referred_by}
                                    onChange={(e) => handleChange('referred_by', e.target.value)}
                                    placeholder="Enter referrer name or source..."
                                    style={inputStyle}
                                />
                            </Field>
                            <Field label="Date of Report *">
                                <input
                                    type="date"
                                    value={form.date_of_report}
                                    onChange={(e) => handleChange('date_of_report', e.target.value)}
                                    required
                                    style={inputStyle}
                                />
                            </Field>
                            <Field label="Date of Birth">
                                <input
                                    type="date"
                                    value={form.date_of_birth}
                                    onChange={(e) => handleChange('date_of_birth', e.target.value)}
                                    style={inputStyle}
                                />
                            </Field>
                            <Field label="Report Created By">
                                <div style={{ ...inputStyle, background: '#f3f4f6', color: '#374151', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.85rem' }}>
                                        {form.report_created_by || '—'}
                                    </span>

                                </div>
                            </Field>
                        </div>

                        <Field label="Birth History">
                            <textarea
                                value={form.birth_history}
                                onChange={(e) => handleChange('birth_history', e.target.value)}
                                placeholder="Describe birth history..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </Field>

                        <Field label="Development History">
                            <textarea
                                value={form.development_history}
                                onChange={(e) => handleChange('development_history', e.target.value)}
                                placeholder="Describe developmental history..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </Field>

                        <Field label="Learning History">
                            <textarea
                                value={form.learning_history}
                                onChange={(e) => handleChange('learning_history', e.target.value)}
                                placeholder="Describe learning history..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </Field>

                        {/* COACH Q&A SECTION */}
                        {isCoach && (
                            <>
                                <SectionHeading title="Assessment Questions & Answers" subtitle="Add numbered question-answer pairs" />
                                {coachQaPairs.map((pair, idx) => (
                                    <div key={idx} style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        padding: '1rem',
                                        marginBottom: '1rem',
                                        background: '#fafafa',
                                        position: 'relative'
                                    }}>
                                        {/* Remove Button - Top Right */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveQAPair(idx)}
                                            style={{
                                                position: 'absolute',
                                                top: '0.55rem',
                                                right: '0.75rem',
                                                background: '#fee2e2',
                                                color: '#dc2626',
                                                border: '1px solid #fecaca',
                                                borderRadius: '0.375rem',
                                                padding: '0.2rem 0.4rem',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            ✕ Remove
                                        </button>

                                        {/* Item Number - Header */}
                                        {/* <div style={{ marginBottom: '0.75rem', marginRight: '5rem' }}>
                                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#7c1c1c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>
                                                Question {idx + 1}
                                            </label>
                                        </div> */}

                                        {/* Number and Heading Row */}

                                        <Field label="Heading">
                                            <input
                                                type="text"
                                                value={pair.heading}
                                                onChange={(e) => handleUpdateQAPair(idx, 'heading', e.target.value)}
                                                placeholder="e.g., Attention & Focus"
                                                style={inputStyle}
                                            />
                                        </Field>

                                        {/* Answer - Full Width */}
                                        <Field label="Answer">
                                            <textarea
                                                value={pair.answer}
                                                onChange={(e) => handleUpdateQAPair(idx, 'answer', e.target.value)}
                                                placeholder="Enter detailed answer..."
                                                rows={3}
                                                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                                            />
                                        </Field>
                                    </div>
                                ))}
                                <div style={{ marginTop: '1rem' }}>
                                    <button
                                        type="button"
                                        onClick={handleAddQAPair}
                                        style={{
                                            background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.5rem',
                                            padding: '0.5rem 1rem',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: 600,
                                        }}
                                    >
                                        + Add Question-Answer Pair
                                    </button>
                                </div>

                                {/* Summary Section for Coach */}
                                <SectionHeading title="Summary & Recommendations" />
                                <Field label="The Immediate Intervention Plan">
                                    <textarea
                                        value={form.intervention_plan}
                                        onChange={(e) => handleChange('intervention_plan', e.target.value)}
                                        placeholder="Describe the immediate intervention plan..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>
                                <Field label="Recommendation">
                                    <textarea
                                        value={form.recommendation}
                                        onChange={(e) => handleChange('recommendation', e.target.value)}
                                        placeholder="Recommendations for the learner..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>
                                <Field label="Conclusion">
                                    <textarea
                                        value={form.conclusion}
                                        onChange={(e) => handleChange('conclusion', e.target.value)}
                                        placeholder="Conclusion of the assessment..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>

                                {/* Digital Signature for Coach */}
                                <SectionHeading title="Signature" />
                                <Field label="Digital Signature">
                                    <div style={{
                                        width: '120px',
                                        height: '80px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f9fafb'
                                    }}>
                                        <img src={DEFAULT_SIGNATURE_IMG} alt="Digital Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>Default signature from public folder</p>
                                </Field>
                            </>
                        )}

                        {/* HEAD DEVELOPMENT AREAS SECTION */}
                        {!isCoach && (
                            <>
                                {/* ── FUNCTIONAL DEVELOPMENT OVERVIEW THROUGH OVERALL DEVELOPMENT ── */}
                                <SectionHeading title="FUNCTIONAL DEVELOPMENT OVERVIEW THROUGH OVERALL DEVELOPMENT" subtitle="Provide assessment notes for each area" />
                                {DEVELOPMENT_AREAS.map((area, idx) => (
                                    <Field key={area.key} label={`${idx + 1}. ${area.label}`}>
                                        <textarea
                                            value={form[area.key]}
                                            onChange={(e) => handleChange(area.key, e.target.value)}
                                            placeholder={`Assessment for ${area.label}...`}
                                            rows={3}
                                            style={{ ...inputStyle, resize: 'vertical' }}
                                        />
                                    </Field>
                                ))}

                                {/* ── Professional Development Section ── */}
                                <SectionHeading title="Additional Assessment Areas" />
                                <Field label="The Immediate Intervention Plan">
                                    <textarea
                                        value={form.intervention_plan}
                                        onChange={(e) => handleChange('intervention_plan', e.target.value)}
                                        placeholder="Describe the immediate intervention plan..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>

                                {/* ── Summary ── */}
                                <SectionHeading title="Summary & Signature" />
                                <Field label="Recommendation">
                                    <textarea
                                        value={form.recommendation}
                                        onChange={(e) => handleChange('recommendation', e.target.value)}
                                        placeholder="Recommendations for the learner..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>
                                <Field label="Conclusion">
                                    <textarea
                                        value={form.conclusion}
                                        onChange={(e) => handleChange('conclusion', e.target.value)}
                                        placeholder="Conclusion of the assessment..."
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </Field>
                                <Field label="Digital Signature">
                                    <div style={{
                                        width: '120px',
                                        height: '80px',
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '0.5rem',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#f9fafb'
                                    }}>
                                        <img src={DEFAULT_SIGNATURE_IMG} alt="Digital Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>Default signature from public folder</p>
                                </Field>
                            </>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button type="button" onClick={onClose} style={cancelBtnStyle}>Cancel</button>
                            <button type="submit" style={primaryBtnStyle}>
                                Preview Report →
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    /* ─────────────────────── PREVIEW VIEW ─────────────────────── */
    return (
        <div className="app-modal-overlay" onClick={() => setStep('form')}>
            <div
                className="app-modal-container app-modal-container--xl"
                style={{ maxHeight: '90vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Preview Header */}
                <div style={{ background: 'linear-gradient(135deg, #7c1c1c, #a83232)', color: 'white', padding: '1.25rem 1.5rem', borderRadius: '0.75rem 0.75rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>👁 Report Preview</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                            Review before generating the report
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'white', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        ×
                    </button>
                </div>

                {/* Preview Content */}
                <div id="report-preview-content" style={{ padding: '2rem', fontFamily: 'Georgia, "Times New Roman", serif', background: '#fff' }}>
                    {/* Report Title */}
                    <div style={{ textAlign: 'center', borderBottom: '3px solid #7c1c1c', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#7c1c1c', margin: 0 }}>
                            Comprehensive Skill Development Report
                        </h1>
                        <p style={{ margin: '0.4rem 0 0', color: '#555', fontSize: '0.95rem' }}>HurshBin Learning Centre</p>
                    </div>

                    {/* Basic Details */}
                    <PreviewSection title="Basic Information">
                        <div style={gridStyle(2)}>
                            <PreviewField label="Name" value={form.name} />
                            <PreviewField label="Refered by" value={form.referred_by} />
                            <PreviewField label="Date of Report" value={fmt(form.date_of_report)} />
                            <PreviewField label="Date of Birth" value={fmt(form.date_of_birth)} />
                            <PreviewField label="Report Created By" value={form.report_created_by} />
                        </div>
                        {form.birth_history && <PreviewField label="Birth History" value={form.birth_history} block />}
                        {form.development_history && <PreviewField label="Development History" value={form.development_history} block />}
                        {form.learning_history && <PreviewField label="Learning History" value={form.learning_history} block />}
                    </PreviewSection>

                    {/* COACH Q&A SECTION */}
                    {isCoach && coachQaPairs.length > 0 && (
                        <PreviewSection title="Assessment Questions & Answers">
                            {coachQaPairs.map((pair, idx) => (
                                <div key={idx} style={{ marginBottom: '1rem' }}>
                                    <p style={{ fontWeight: 700, color: '#000000', margin: '0 0 0.3rem', fontSize: '0.95rem' }}>
                                        {pair.heading || 'Question'}
                                    </p>
                                    <p style={{ margin: 0, color: '#333', lineHeight: 1.6, fontSize: '0.9rem', paddingLeft: '1rem', borderLeft: '3px solid #f3d98b' }}>
                                        {pair.answer || '—'}
                                    </p>
                                </div>
                            ))}
                        </PreviewSection>
                    )}

                    {/* COACH SUMMARY SECTION */}
                    {isCoach && (
                        <>
                            {/* Intervention Plan */}
                            {form.intervention_plan && (
                                <PreviewSection title="The Immediate Intervention Plan">
                                    <PreviewField label="" value={form.intervention_plan} block />
                                </PreviewSection>
                            )}

                            {/* Recommendation & Conclusion */}
                            {(form.recommendation || form.conclusion) && (
                                <PreviewSection title="Summary & Recommendations">
                                    {form.recommendation && <PreviewField label="Recommendation" value={form.recommendation} block />}
                                    {form.conclusion && <PreviewField label="Conclusion" value={form.conclusion} block />}
                                </PreviewSection>
                            )}
                        </>
                    )}

                    {/* HEAD DEVELOPMENT AREAS SECTION */}
                    {!isCoach && (
                        <>
                            {/* 9 Areas */}
                            <PreviewSection title="FUNCTIONAL DEVELOPMENT OVERVIEW THROUGH OVERALL DEVELOPMENT">
                                {DEVELOPMENT_AREAS.map((area, idx) => (
                                    form[area.key] ? (
                                        <div key={area.key} style={{ marginBottom: '1rem' }}>
                                            <p style={{ fontWeight: 700, color: '#7c1c1c', margin: '0 0 0.3rem', fontSize: '0.95rem' }}>
                                                {idx + 1}. {area.label}
                                            </p>
                                            <p style={{ margin: 0, color: '#333', lineHeight: 1.6, fontSize: '0.9rem', paddingLeft: '1rem', borderLeft: '3px solid #f3d98b' }}>
                                                {form[area.key]}
                                            </p>
                                        </div>
                                    ) : null
                                ))}
                            </PreviewSection>

                            {/* Intervention Plan */}
                            {form.intervention_plan && (
                                <PreviewSection title="Additional Assessment Areas">
                                    <PreviewField label="The Immediate Intervention Plan" value={form.intervention_plan} block />
                                </PreviewSection>
                            )}

                            {/* Summary & Conclusion */}
                            {(form.recommendation || form.conclusion) && (
                                <PreviewSection title="Summary & Recommendations">
                                    {form.recommendation && <PreviewField label="Recommendation" value={form.recommendation} block />}
                                    {form.conclusion && <PreviewField label="Conclusion" value={form.conclusion} block />}
                                </PreviewSection>
                            )}
                        </>
                    )}

                    {/* Signature & Disclaimer */}
                    <div style={{ marginTop: '2.5rem', borderTop: '2px solid #7c1c1c', paddingTop: '1.5rem' }}>
                        {form.report_created_by && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 0.5rem', fontWeight: 600 }}>Report Prepared By</p>
                                <p style={{ fontWeight: 700, color: '#333', margin: '0.2rem 0 0' }}>{form.report_created_by}</p>
                                {/* Signature Image */}
                                <div style={{
                                    width: '120px',
                                    height: '80px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#f9fafb',
                                    margin: '0.5rem 0 0'
                                }}>
                                    <img src={DEFAULT_SIGNATURE_IMG} alt="Digital Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                </div>
                                <p style={{ fontSize: '0.85rem', color: '#555', margin: '0.7rem 0 0', fontWeight: 600 }}>Ms.Binal Shah
                                    For HurshBin Child Development Learning & Behaviour Modification services</p>
                            </div>
                        )}

                        {/* Disclaimer */}
                        {!isCoach && (
                            <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '1rem', marginTop: '1rem' }}>
                                <p style={{ fontSize: '0.75rem', color: '#78350f', margin: 0, lineHeight: 1.6 }}>
                                    <strong>Disclaimer:</strong> This report has been prepared based on observations, assessments, interactions, tools and information provided by parents/caregivers at the time of evaluation.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', borderRadius: '0 0 0.75rem 0.75rem' }}>
                    <button onClick={() => setStep('form')} style={cancelBtnStyle}>
                        ← Back to Edit
                    </button>
                    <button onClick={handleSubmit} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving & Generating PDF…' : '⬇ Generate & Download Report'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Helpers ─────────────────────────────────────────── */

const SectionHeading = ({ title, subtitle }) => (
    <div style={{ margin: '1.5rem 0 0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f3d98b', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: '#7c1c1c', fontSize: '1rem', fontWeight: 700 }}>{title}</h3>
        {subtitle && <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#888' }}>{subtitle}</p>}
    </div>
);

const Field = ({ label, children }) => (
    <div style={{ marginBottom: '0.85rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>
            {label}
        </label>
        {children}
    </div>
);

const PreviewSection = ({ title, children }) => (
    <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#7c1c1c', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
            {title}
        </h3>
        {children}
    </div>
);

const PreviewField = ({ label, value, block }) => {
    if (!value) return null;
    if (block) {
        return (
            <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#555', margin: '0 0 0.2rem' }}>{label}</p>
                <p style={{ margin: 0, color: '#222', lineHeight: 1.6, fontSize: '0.9rem' }}>{value}</p>
            </div>
        );
    }
    return (
        <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#555' }}>{label}: </span>
            <span style={{ color: '#222', fontSize: '0.9rem' }}>{value}</span>
        </div>
    );
};

const gridStyle = (cols) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '0.75rem',
    marginBottom: '0.5rem',
});

const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
};

const primaryBtnStyle = {
    background: 'linear-gradient(135deg, #7c1c1c, #a83232)',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const cancelBtnStyle = {
    background: 'white',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    padding: '0.6rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

export default CreateProgressReportModal;
