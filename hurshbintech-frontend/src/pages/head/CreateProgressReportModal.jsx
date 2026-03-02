import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import learnerProgressReportService from '../../api/services/learnerProgressReportService';
import headService from '../../api/services/headService';
import { generateLearnerProgressReportPDF } from '../../utils/pdfGenerator';
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
    date_of_birth: '',
    date_of_report: new Date().toISOString().split('T')[0],
    birth_history: '',
    attention_cooperation: '',
    sensory_integration_motor: '',
    speech_language_communication: '',
    play_leisure: '',
    social_interaction_group: '',
    emotional_regulation: '',
    independent_living: '',
    academic_readiness: '',
    professional_development: '',
    recommendation: '',
    conclusion: '',
    report_created_by: '',
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

    // Learner dropdown state
    const [learners, setLearners] = useState([]);
    const [learnerSearch, setLearnerSearch] = useState(learnerName);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

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

    // Fetch learners on mount
    useEffect(() => {
        headService.getAllLearners()
            .then(data => setLearners(data || []))
            .catch(() => { });
    }, []);

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
        setStep('preview');
    };

    const handleSubmit = async () => {
        try {
            setSaving(true);
            const payload = {
                ...form,
                learner_id: selectedLearnerId || learnerId || null,
                date_of_birth: form.date_of_birth || null,
                date_of_report: form.date_of_report,
            };
            // Strip empty strings to null for optional fields
            Object.keys(payload).forEach((k) => {
                if (payload[k] === '') payload[k] = null;
            });
            const created = await learnerProgressReportService.create(payload);
            toast.success('Progress report saved! Downloading PDF…');
            // Generate and download PDF in the exact HurshBin branded format
            const pdfBlob = await generateLearnerProgressReportPDF(form);
            // Upload PDF to S3 on deploy (USE_S3=true); silently skipped on local
            if (pdfBlob) {
                learnerProgressReportService.uploadPDF(created.id, pdfBlob);
            }
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
                            {/* Learner Name — searchable dropdown */}
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

                        {/* ── 9 Areas of Development ── */}
                        <SectionHeading title="9 Areas of Development" subtitle="Provide assessment notes for each area" />
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

                        {/* ── Summary ── */}
                        <SectionHeading title="Summary" />
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
                            DEVELOPMENTAL PROGRESS REPORT
                        </h1>
                        <p style={{ margin: '0.4rem 0 0', color: '#555', fontSize: '0.95rem' }}>HurshBinTech Learning Centre</p>
                    </div>

                    {/* Basic Details */}
                    <PreviewSection title="Basic Information">
                        <div style={gridStyle(2)}>
                            <PreviewField label="Name" value={form.name} />
                            <PreviewField label="Date of Report" value={fmt(form.date_of_report)} />
                            <PreviewField label="Date of Birth" value={fmt(form.date_of_birth)} />
                            <PreviewField label="Report Created By" value={form.report_created_by} />
                        </div>
                        {form.birth_history && <PreviewField label="Birth History" value={form.birth_history} block />}
                    </PreviewSection>

                    {/* 9 Areas */}
                    <PreviewSection title="9 Areas of Development">
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

                    {/* Summary */}
                    {(form.recommendation || form.conclusion) && (
                        <PreviewSection title="Summary">
                            {form.recommendation && <PreviewField label="Recommendation" value={form.recommendation} block />}
                            {form.conclusion && <PreviewField label="Conclusion" value={form.conclusion} block />}
                        </PreviewSection>
                    )}

                    {/* Signature */}
                    {form.report_created_by && (
                        <div style={{ marginTop: '2rem', textAlign: 'right', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                            <p style={{ fontSize: '0.9rem', color: '#555', margin: 0 }}>Report Prepared By</p>
                            <p style={{ fontWeight: 700, color: '#333', margin: '0.3rem 0 0', fontSize: '1rem' }}>
                                {form.report_created_by}
                            </p>
                        </div>
                    )}
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
    <div style={{ margin: '1.5rem 0 0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f3d98b' }}>
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
