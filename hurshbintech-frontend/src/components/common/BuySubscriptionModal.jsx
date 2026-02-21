/**
 * BuySubscriptionModal.jsx
 * Landing-page subscription purchase inquiry form.
 * Multi-step form: Personal Info → Package & Payment → Review & Submit
 * No authentication required.
 */

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import publicSubscriptionService from '../../api/services/publicSubscriptionService';
import '../../styles/components/common/BuySubscriptionModal.css';

// ── constants ──────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3;

const INITIAL_FORM = {
    learner_name: '',
    email: '',
    contact_number: '',
    age: '',
    date_of_birth: '',
    date_of_assessment: '',
    package_id: '',
    package_name: '',
    package_price: '',
    payment_method: '',
};

// Bank transfer details – update with your actual account info
const BANK_DETAILS = {
    bank_name: 'State Bank of India',
    account_name: 'Hurshbin Child Development Services',
    account_number: 'XXXX XXXX XXXX',
    ifsc: 'SBINXXXXXXX',
    branch: 'Your Branch Name',
};

// ──────────────────────────────────────────────────────────────────────────────

const BuySubscriptionModal = ({ onClose }) => {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({ ...INITIAL_FORM });
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [packages, setPackages] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errors, setErrors] = useState({});
    const [editStep, setEditStep] = useState(null); // for inline edit on review step
    const overlayRef = useRef(null);

    // ── fetch packages on mount ────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const pkgs = await publicSubscriptionService.getPublicPackages();
            setPackages(pkgs);
            setLoadingPackages(false);
        })();
    }, []);

    // ── close on Escape ───────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // ── helpers ───────────────────────────────────────────────────────────────
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    // ── auto-calculate age from DOB ────────────────────────────────────────────
    const calculateAgeFromDOB = (dobString) => {
        if (!dobString) return '';
        try {
            const dob = new Date(dobString);
            const today = new Date();
            let calculatedAge = today.getFullYear() - dob.getFullYear();
            const monthDiff = today.getMonth() - dob.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                calculatedAge--;
            }
            return Math.max(0, calculatedAge);
        } catch {
            return '';
        }
    };

    const handleDOBChange = (e) => {
        const { value } = e.target;
        const calculatedAge = calculateAgeFromDOB(value);
        setForm((prev) => ({
            ...prev,
            date_of_birth: value,
            age: calculatedAge !== '' ? String(calculatedAge) : '',
        }));
        setErrors((prev) => ({ ...prev, date_of_birth: '' }));
    };

    const handlePackageSelect = (e) => {
        const pkgId = e.target.value;
        if (!pkgId) {
            setForm((prev) => ({ ...prev, package_id: '', package_name: '', package_price: '' }));
            return;
        }
        const pkg = packages.find((p) => String(p.id) === String(pkgId));
        if (pkg) {
            setForm((prev) => ({
                ...prev,
                package_id: pkg.id,
                package_name: pkg.package_name,
                package_price: String(pkg.price),
            }));
        }
    };

    const handleReceiptChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be under 10 MB');
            return;
        }
        setReceiptFile(file);
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => setReceiptPreview(ev.target.result);
            reader.readAsDataURL(file);
        } else {
            setReceiptPreview(null);
        }
    };

    // ── validation ────────────────────────────────────────────────────────────
    const validateStep1 = () => {
        const errs = {};
        if (!form.learner_name.trim()) errs.learner_name = 'Name is required';
        if (!form.email.trim()) {
            errs.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
            errs.email = 'Enter a valid email address';
        }
        if (!form.contact_number.trim()) errs.contact_number = 'Contact number is required';
        return errs;
    };

    const validateStep2 = () => {
        const errs = {};
        if (!form.package_id) errs.package_id = 'Please select a package';
        if (!form.payment_method) errs.payment_method = 'Please select a payment method';
        return errs;
    };

    // ── navigation ────────────────────────────────────────────────────────────
    const goNext = () => {
        let errs = {};
        if (step === 1) errs = validateStep1();
        if (step === 2) errs = validateStep2();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        setErrors({});
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    };

    const goBack = () => {
        setErrors({});
        setStep((s) => Math.max(s - 1, 1));
    };

    // ── submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            await publicSubscriptionService.submitInquiry(
                { ...form, age: form.age !== '' ? parseInt(form.age, 10) : undefined },
                receiptFile,
            );
            setSubmitted(true);
        } catch (err) {
            console.error('Inquiry submission failed:', err);
            toast.error(
                err?.response?.data?.detail || 'Submission failed. Please try again.',
                { position: 'top-center' },
            );
        } finally {
            setSubmitting(false);
        }
    };

    // ── format helpers ────────────────────────────────────────────────────────
    const displayDate = (val) => {
        if (!val) return '—';
        try {
            return new Date(val).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
            });
        } catch { return val; }
    };

    const paymentMethodLabel = (val) => {
        if (val === 'UPI') return 'UPI (QR Code)';
        if (val === 'BANK_TRANSFER') return 'Bank Transfer';
        return val || '—';
    };

    // ══════════════════════════════════════════════════════════════════════════
    //  SUCCESS SCREEN
    // ══════════════════════════════════════════════════════════════════════════
    if (submitted) {
        return (
            <div className="bsm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
                <div className="bsm-container bsm-success-container">
                    <div className="bsm-success-icon">✓</div>
                    <h2 className="bsm-success-title">Inquiry Submitted!</h2>
                    <p className="bsm-success-msg">
                        Thank you, <strong>{form.learner_name}</strong>!<br />
                        Our team will review your inquiry and get back to you at{' '}
                        <strong>{form.email}</strong> soon.
                    </p>
                    <button className="bsm-btn bsm-btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  MAIN MODAL
    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="bsm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="bsm-container" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ──────────────────────────────────────────────────────── */}
                <div className="bsm-header">
                    <div>
                        <h2 className="bsm-header-title">Buy Subscription</h2>
                        <p className="bsm-header-subtitle">
                            Step {step} of {TOTAL_STEPS} —{' '}
                            {step === 1 && 'Learner Information'}
                            {step === 2 && 'Package & Payment Details'}
                            {step === 3 && 'Review & Submit'}
                        </p>
                    </div>
                    <button className="bsm-close-btn" onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                {/* ── Step Indicator ──────────────────────────────────────────────── */}
                <div className="bsm-steps">
                    {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                        <React.Fragment key={s}>
                            <div className={`bsm-step-dot ${s < step ? 'done' : ''} ${s === step ? 'active' : ''}`}>
                                {s < step ? '✓' : s}
                            </div>
                            {s < TOTAL_STEPS && <div className={`bsm-step-line ${s < step ? 'done' : ''}`} />}
                        </React.Fragment>
                    ))}
                </div>

                {/* ── Body ────────────────────────────────────────────────────────── */}
                <div className="bsm-body">

                    {/* =========================================================== */}
                    {/* STEP 1 – Learner Information                                  */}
                    {/* =========================================================== */}
                    {step === 1 && (
                        <div className="bsm-form-grid">
                            {/* Name */}
                            <div className="bsm-field bsm-field-full">
                                <label className="bsm-label">Name of Learner <span className="bsm-required">*</span></label>
                                <input
                                    className={`bsm-input ${errors.learner_name ? 'bsm-input-error' : ''}`}
                                    name="learner_name"
                                    value={form.learner_name}
                                    onChange={handleChange}
                                    placeholder="Full name of the learner"
                                />
                                {errors.learner_name && <p className="bsm-error-msg">{errors.learner_name}</p>}
                            </div>

                            {/* Email */}
                            <div className="bsm-field">
                                <label className="bsm-label">Email <span className="bsm-required">*</span></label>
                                <input
                                    className={`bsm-input ${errors.email ? 'bsm-input-error' : ''}`}
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="example@email.com"
                                />
                                {errors.email && <p className="bsm-error-msg">{errors.email}</p>}
                            </div>

                            {/* Contact */}
                            <div className="bsm-field">
                                <label className="bsm-label">Contact Number <span className="bsm-required">*</span></label>
                                <input
                                    className={`bsm-input ${errors.contact_number ? 'bsm-input-error' : ''}`}
                                    type="tel"
                                    name="contact_number"
                                    value={form.contact_number}
                                    onChange={handleChange}
                                    placeholder="+91 XXXXX XXXXX"
                                />
                                {errors.contact_number && <p className="bsm-error-msg">{errors.contact_number}</p>}
                            </div>

                            {/* Date of Birth */}
                            <div className="bsm-field">
                                <label className="bsm-label">Date of Birth (DOB)</label>
                                <input
                                    className="bsm-input"
                                    type="date"
                                    name="date_of_birth"
                                    value={form.date_of_birth}
                                    onChange={handleDOBChange}
                                />
                                <small style={{ color: '#9ca3af', marginTop: '0.25rem', display: 'block' }}>
                                    Age will auto-calculate
                                </small>
                            </div>

                            {/* Age */}
                            <div className="bsm-field">
                                <label className="bsm-label">Age</label>
                                <input
                                    className="bsm-input"
                                    type="number"
                                    name="age"
                                    value={form.age}
                                    onChange={handleChange}
                                    placeholder="Age in years"
                                    min="0"
                                    max="150"
                                />
                            </div>



                            {/* Date of Assessment */}
                            <div className="bsm-field">
                                <label className="bsm-label">Date of Assessment</label>
                                <input
                                    className="bsm-input"
                                    type="date"
                                    name="date_of_assessment"
                                    value={form.date_of_assessment}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {/* =========================================================== */}
                    {/* STEP 2 – Package & Payment Details                            */}
                    {/* =========================================================== */}
                    {step === 2 && (
                        <div className="bsm-form-grid">

                            {/* ── Package selection ── */}
                            <div className="bsm-section-heading bsm-field-full">Package & Payment Details</div>

                            <div className="bsm-field bsm-field-full">
                                <label className="bsm-label">
                                    Select Package <span className="bsm-required">*</span>
                                </label>
                                {loadingPackages ? (
                                    <p className="bsm-loading-text">Loading packages…</p>
                                ) : packages.length === 0 ? (
                                    <p className="bsm-info-text">No packages available at the moment.</p>
                                ) : (
                                    <select
                                        className={`bsm-input ${errors.package_id ? 'bsm-input-error' : ''}`}
                                        name="package_id"
                                        value={form.package_id}
                                        onChange={handlePackageSelect}
                                    >
                                        <option value="">— Choose a package —</option>
                                        {packages.map((pkg) => (
                                            <option key={pkg.id} value={pkg.id}>
                                                {pkg.package_name} — {pkg.sessions_count} sessions / {pkg.validity_days} days
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {errors.package_id && <p className="bsm-error-msg">{errors.package_id}</p>}
                            </div>

                            {/* Package Price (auto-filled) */}
                            <div className="bsm-field bsm-field-full">
                                <label className="bsm-label">Package Price</label>
                                <div className="bsm-price-display">
                                    {form.package_price
                                        ? `₹ ${parseFloat(form.package_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                        : 'Select a package to see the price'}
                                </div>
                            </div>

                            {/* ── Payment Method ── */}
                            <div className="bsm-field bsm-field-full">
                                <label className="bsm-label">
                                    Payment Method <span className="bsm-required">*</span>
                                </label>
                                <div className="bsm-payment-methods">
                                    <label
                                        className={`bsm-payment-option ${form.payment_method === 'UPI' ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment_method"
                                            value="UPI"
                                            checked={form.payment_method === 'UPI'}
                                            onChange={handleChange}
                                        />
                                        <span className="bsm-payment-icon">📱</span>
                                        <span>UPI (QR Code)</span>
                                    </label>
                                    <label
                                        className={`bsm-payment-option ${form.payment_method === 'BANK_TRANSFER' ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="payment_method"
                                            value="BANK_TRANSFER"
                                            checked={form.payment_method === 'BANK_TRANSFER'}
                                            onChange={handleChange}
                                        />
                                        <span className="bsm-payment-icon">🏦</span>
                                        <span>Bank Transfer</span>
                                    </label>
                                </div>
                                {errors.payment_method && (
                                    <p className="bsm-error-msg">{errors.payment_method}</p>
                                )}
                            </div>

                            {/* ── UPI Details ── */}
                            {form.payment_method === 'UPI' && (
                                <div className="bsm-field bsm-field-full bsm-payment-detail-box">
                                    <p className="bsm-payment-detail-title">Scan QR Code to Pay</p>
                                    <div className="bsm-qr-wrapper">
                                        <img
                                            src="/upi-qr.jpeg"
                                            alt="UPI QR Code"
                                            className="bsm-qr-img"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                const placeholder = e.target.nextElementSibling;
                                                if (placeholder) placeholder.style.display = 'flex';
                                            }}
                                        />
                                        <div className="bsm-qr-placeholder">
                                            <p>📱</p>
                                            <span>QR Code file not found</span>
                                        </div>
                                    </div>
                                    <p className="bsm-payment-note">
                                        After payment, upload your payment screenshot below.
                                    </p>
                                </div>
                            )}

                            {/* ── Bank Transfer Details ── */}
                            {form.payment_method === 'BANK_TRANSFER' && (
                                <div className="bsm-field bsm-field-full bsm-payment-detail-box">
                                    <p className="bsm-payment-detail-title">Bank Transfer Details</p>
                                    <table className="bsm-bank-table">
                                        <tbody>
                                            <tr><td className="bsm-bank-label">Bank Name</td><td>{BANK_DETAILS.bank_name}</td></tr>
                                            <tr><td className="bsm-bank-label">Account Name</td><td>{BANK_DETAILS.account_name}</td></tr>
                                            <tr><td className="bsm-bank-label">Account Number</td><td>{BANK_DETAILS.account_number}</td></tr>
                                            <tr><td className="bsm-bank-label">IFSC Code</td><td>{BANK_DETAILS.ifsc}</td></tr>
                                            <tr><td className="bsm-bank-label">Branch</td><td>{BANK_DETAILS.branch}</td></tr>
                                        </tbody>
                                    </table>
                                    <p className="bsm-payment-note">
                                        After transferring, upload your payment receipt below.
                                    </p>
                                </div>
                            )}

                            {/* ── Upload Payment Receipt ── */}
                            {form.payment_method && (
                                <div className="bsm-field bsm-field-full">
                                    <label className="bsm-label">Upload Payment Receipt</label>
                                    <div className="bsm-file-upload-area">
                                        <input
                                            id="receipt-file-input"
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="bsm-file-input-hidden"
                                            onChange={handleReceiptChange}
                                        />
                                        <label htmlFor="receipt-file-input" className="bsm-file-label">
                                            {receiptFile ? (
                                                <span className="bsm-file-chosen">📎 {receiptFile.name}</span>
                                            ) : (
                                                <>
                                                    <span className="bsm-file-icon">⬆</span>
                                                    <span>Click to upload receipt (image or PDF, max 10 MB)</span>
                                                </>
                                            )}
                                        </label>
                                        {receiptPreview && (
                                            <div className="bsm-receipt-preview">
                                                <img src={receiptPreview} alt="Receipt preview" className="bsm-receipt-img" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* =========================================================== */}
                    {/* STEP 3 – Review & Submit                                      */}
                    {/* =========================================================== */}
                    {step === 3 && (
                        <div className="bsm-review">
                            <p className="bsm-review-intro">
                                Please review your information before submitting. Click <strong>Edit</strong> to
                                go back and make changes.
                            </p>

                            {/* ── Personal Details ── */}
                            <div className="bsm-review-section">
                                <div className="bsm-review-section-header">
                                    <span>Learner Information</span>
                                    <button className="bsm-edit-link" onClick={() => setStep(1)}>Edit</button>
                                </div>
                                <div className="bsm-review-grid">
                                    <ReviewRow label="Name" value={form.learner_name} />
                                    <ReviewRow label="Email" value={form.email} />
                                    <ReviewRow label="Contact Number" value={form.contact_number} />
                                    <ReviewRow label="Age" value={form.age || '—'} />
                                    <ReviewRow label="Date of Birth" value={displayDate(form.date_of_birth)} />
                                    <ReviewRow label="Date of Assessment" value={displayDate(form.date_of_assessment)} />
                                </div>
                            </div>

                            {/* ── Package & Payment ── */}
                            <div className="bsm-review-section">
                                <div className="bsm-review-section-header">
                                    <span>Package & Payment Details</span>
                                    <button className="bsm-edit-link" onClick={() => setStep(2)}>Edit</button>
                                </div>
                                <div className="bsm-review-grid">
                                    <ReviewRow label="Package" value={form.package_name || '—'} />
                                    <ReviewRow
                                        label="Package Price"
                                        value={
                                            form.package_price
                                                ? `₹ ${parseFloat(form.package_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                                : '—'
                                        }
                                    />
                                    <ReviewRow label="Payment Method" value={paymentMethodLabel(form.payment_method)} />
                                    <ReviewRow
                                        label="Receipt Attached"
                                        value={receiptFile ? `✅ ${receiptFile.name}` : 'Not uploaded'}
                                    />
                                </div>
                            </div>

                            <p className="bsm-review-consent">
                                By submitting, you confirm that the information provided is accurate.
                                Our team will contact you to complete the enrollment process.
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Footer / Navigation ─────────────────────────────────────────── */}
                <div className="bsm-footer">
                    {step > 1 && (
                        <button className="bsm-btn bsm-btn-secondary" onClick={goBack} disabled={submitting}>
                            ← Back
                        </button>
                    )}
                    <div className="bsm-footer-spacer" />
                    {step < TOTAL_STEPS ? (
                        <button className="bsm-btn bsm-btn-primary" onClick={goNext}>
                            Next →
                        </button>
                    ) : (
                        <button
                            className="bsm-btn bsm-btn-submit"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? 'Submitting…' : '✓ Submit Inquiry'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Small helper component for review rows
const ReviewRow = ({ label, value }) => (
    <div className="bsm-review-row">
        <span className="bsm-review-label">{label}</span>
        <span className="bsm-review-value">{value}</span>
    </div>
);

export default BuySubscriptionModal;
