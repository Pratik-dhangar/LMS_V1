import React, { useState } from "react";
import { toast } from "react-toastify";
import { FaPaperPlane, FaCheckCircle, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaWhatsapp, FaSeedling, FaInstagram, FaFacebook, FaYoutube, FaSpinner } from "react-icons/fa";
import confetti from "canvas-confetti";
import contactService from "../../api/services/contactService";
import "../../styles/components/common/Modal.css";
import "../../styles/admin/ContactUs.css";

const ASSESSMENT_DISORDERS = [
    "Specific Learning Disorder",
    "Obsessive Compulsive Disorder",
    "Post-Traumatic Stress Disorder",
    "Oppositional Deficit Disorder",
    "Specific Phobia Disorder",
    "Specific Emotional Behavioural Disorder",
];

const ASSESSMENT_SKILLS = [
    { key: "touch_sensitivity", label: "Likes/hates any particular touch too much" },
    { key: "sight_sensitivity", label: "Likes/hates any particular sight too much" },
    { key: "sound_sensitivity", label: "Likes/hates any particular sound too much" },
    { key: "taste_sensitivity", label: "Likes/hates any particular taste too much" },
    { key: "smell_sensitivity", label: "Likes/hates any particular smell too much" },
    { key: "fine_motor", label: "Does age appropriate activities involving hand and finger movement" },
    { key: "gross_motor", label: "Does age appropriate activities involving arms and legs movement" },
    { key: "oral_motor", label: "Does age appropriate activities involving mouth and tongue movement" },
    { key: "motor_coordination", label: "Does age appropriate activities related to motor coordination" },
    { key: "speech_clarity", label: "Speaks clearly with no difficulties in any letter sounds" },
    { key: "requesting", label: "Requests for things, activities, events, people using speech/gestures age appropriately" },
    { key: "vocal_response", label: "Responds age appropriately using vocals when questioned by a familiar person" },
    { key: "spontaneous_communication", label: "Initiates and maintains age appropriate communication spontaneously" },
    { key: "social_preference", label: "Likes to be with people" },
    { key: "instructs_others", label: "Tries to instruct others" },
    { key: "follows_daily_instructions", label: "Follows age appropriate instructions given during daily routine chores" },
    { key: "activity_transition", label: "Follows instructions to switch activities/accepts transition easily or with little effort" },
    { key: "follows_routine", label: "Follows daily routine as required" },
    { key: "routine_change_adjustment", label: "Adjusts changes in routine" },
    { key: "new_environment_adjustment", label: "Adjusts with new environment within some time or no time" },
    { key: "independent_play", label: "Engages in independent play when asked" },
    { key: "environment_exploration", label: "Explores the environment instead of being stuck with one kind of activity" },
    { key: "novel_play_learning", label: "Learns to play with an activity in a novel way when taught" },
    { key: "asks_for_help", label: "Asks for help in learning new toys/activities" },
    { key: "group_sitting", label: "Sits in the group for required time" },
    { key: "task_tolerance", label: "Displays age appropriate tasks/sitting tolerance" },
    { key: "group_attention", label: "Pays attention and learns in the group age appropriately" },
    { key: "concept_learning", label: "Learns age/grade appropriate concepts" },
    { key: "retention", label: "Learns in one or two trials, retains learned matter and displays knowledge when required" },
    { key: "curriculum_knowledge", label: "Knows at least 60% of taught concepts from grade appropriate curriculum" },
    { key: "yes_no_response", label: "Responds in yes or no" },
    { key: "eating_habits", label: "Displays age appropriate eating habits" },
    { key: "new_food_exploration", label: "Explores new food" },
    { key: "toileting_skills", label: "Displays age appropriate toileting skills" },
    { key: "dressing_skills", label: "Displays age appropriate dressing skills" },
];

const createInitialAssessmentData = () => ({
    child_name: "",
    child_age: "",
    date_of_assessment: "",
    mother_name: "",
    mother_age: "",
    mother_education: "",
    mother_profession: "",
    mother_contact: "",
    mother_email: "",
    father_name: "",
    father_age: "",
    father_education: "",
    father_profession: "",
    father_contact: "",
    father_email: "",
    address: "",
    siblings: "",
    sibling_age: "",
    selected_disorders: [],
    medical_baby_scream: "",
    medical_difficult_sleep: "",
    medical_routine_change: "",
    medical_food_habit_shift: "",
    medical_physical_milestones: "",
    medical_language_milestones: "",
    medical_major_illness: "",
    medical_specific_details: "",
    learning_school_years: "",
    learning_support: "",
    learning_current_grade: "",
    learning_scenario: "",
    intervention_history: "",
    skills: ASSESSMENT_SKILLS.reduce((acc, item) => {
        acc[item.key] = "";
        return acc;
    }, {}),
});

const ContactUs = () => {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isAssessmentFormOpen, setIsAssessmentFormOpen] = useState(false);
    const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
    const [assessmentData, setAssessmentData] = useState(createInitialAssessmentData);
    const [formData, setFormData] = useState({
        parent_name: "",
        child_name: "",
        child_age: "",
        address: "",
        email: "",
        phone: "",
        message: "",
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!formData.parent_name.trim()) {
            newErrors.parent_name = "Name is required";
        } else if (formData.parent_name.length < 2) {
            newErrors.parent_name = "Name must be at least 2 characters";
        }

        if (formData.child_name && formData.child_name.trim().length > 0 && formData.child_name.trim().length < 2) {
            newErrors.child_name = "Child name must be at least 2 characters";
        }

        if (formData.child_age && formData.child_age.trim().length > 20) {
            newErrors.child_age = "Child age is too long";
        }

        if (formData.address && formData.address.length > 1000) {
            newErrors.address = "Address must not exceed 1000 characters";
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!formData.message.trim()) {
            newErrors.message = "Message is required";
        } else if (formData.message.length < 5) {
            newErrors.message = "Message must be at least 5 characters";
        } else if (formData.message.length > 5000) {
            newErrors.message = "Message must not exceed 5000 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error("Please fix the errors in the form");
            return;
        }

        setLoading(true);

        try {
            // Submit the contact form
            await contactService.submitContact(formData);

            // Show success animation
            confetti({
                particleCount: 150,
                spread: 60,
                origin: { y: 0.8 },
                colors: ["#F28C28", "#8B4513"],
            });

            // Show success state
            setSubmitted(true);
            toast.success("Thank you! We'll get back to you soon.");

            // Reset form after 3 seconds
            setTimeout(() => {
                setFormData({
                    parent_name: "",
                    child_name: "",
                    child_age: "",
                    address: "",
                    email: "",
                    phone: "",
                    message: "",
                });
                setSubmitted(false);
            }, 3000);
        } catch (error) {
            console.error("Error submitting contact form:", error);
            const errorMessage =
                error.response?.data?.detail || "Failed to submit contact form. Please try again.";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleAssessmentInputChange = (e) => {
        const { name, value } = e.target;
        setAssessmentData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleDisorderToggle = (disorder) => {
        setAssessmentData((prev) => {
            const exists = prev.selected_disorders.includes(disorder);
            return {
                ...prev,
                selected_disorders: exists
                    ? prev.selected_disorders.filter((item) => item !== disorder)
                    : [...prev.selected_disorders, disorder],
            };
        });
    };

    const handleSkillRatingChange = (skillKey, value) => {
        setAssessmentData((prev) => ({
            ...prev,
            skills: {
                ...prev.skills,
                [skillKey]: value,
            },
        }));
    };

    const closeAssessmentModal = () => {
        setIsAssessmentFormOpen(false);
        setAssessmentSubmitting(false);
    };

    const handleAssessmentSubmit = async (e) => {
        e.preventDefault();

        if (!assessmentData.child_name.trim()) {
            toast.error("Please enter the child's name before submitting the assessment form.");
            return;
        }

        setAssessmentSubmitting(true);

        try {
            await contactService.submitFreeAssessment(assessmentData);
            toast.success("Assessment form captured successfully. Our team will contact you soon.");
            setAssessmentData(createInitialAssessmentData());
            closeAssessmentModal();
        } catch (error) {
            console.error("Error submitting free assessment:", error);
            toast.error("Unable to submit assessment form right now. Please try again.");
        } finally {
            setAssessmentSubmitting(false);
        }
    };

    return (
        <div className="contact-page-wrapper">
            {/* Floating WhatsApp Button */}
            <a
                href="https://wa.me/911234567890"
                className="whatsapp-float"
                target="_blank"
                rel="noopener noreferrer"
                title="Chat with us on WhatsApp"
            >
                <FaWhatsapp />
            </a>

            <div className="contact-page-container">
                {/* Contact Card */}
                <div className="contact-card">
                    {/* Brand Panel */}
                    <div className="brand-panel">
                        <div>
                            <h2>
                                <FaSeedling /> Let's Grow
                            </h2>
                            <p>Supporting your child's journey with care and expertise.</p>

                            <div style={{ marginTop: "35px" }}>
                                <div className="contact-item">
                                    <FaMapMarkerAlt /> Mumbai, Maharashtra
                                </div>
                                <div className="contact-item">
                                    <FaPhoneAlt /> +91 98XXX XXXXX
                                </div>
                                <div className="contact-item">
                                    <FaEnvelope /> help@hurshbin.com
                                </div>
                            </div>
                        </div>

                        <div className="social-links">
                            <a
                                href="https://www.instagram.com/hurshbin_mumbai?igsh=d3E0YXhuaTAwZGd3   "
                                className="social-icon"
                                title="Follow us on Instagram"
                                target="_blank"
                            >
                                <FaInstagram />
                            </a>
                            <a
                                href="#"
                                className="social-icon"
                                title="Follow us on Facebook"
                                onClick={(e) => e.preventDefault()}
                            >
                                <FaFacebook />
                            </a>
                            <a
                                href="#"
                                className="social-icon"
                                title="Subscribe on YouTube"
                                onClick={(e) => e.preventDefault()}
                            >
                                <FaYoutube />
                            </a>
                        </div>
                    </div>

                    {/* Form Panel */}
                    <div className="form-panel">
                        <h3>Send a Message</h3>

                        {submitted ? (
                            <div className="success-message">
                                <FaCheckCircle style={{ fontSize: "40px", marginBottom: "15px" }} />
                                <h4>Message Sent Successfully!</h4>
                                <p>Thank you for reaching out. We'll get back to you soon.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="contact-form">
                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="parent_name"
                                        placeholder="Parent's Name"
                                        value={formData.parent_name}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.parent_name ? "error" : ""}
                                    />
                                    {errors.parent_name && (
                                        <span className="error-message">{errors.parent_name}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="child_name"
                                        placeholder="Child's Name"
                                        value={formData.child_name}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.child_name ? "error" : ""}
                                    />
                                    {errors.child_name && (
                                        <span className="error-message">{errors.child_name}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="child_age"
                                        placeholder="Child Age"
                                        value={formData.child_age}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.child_age ? "error" : ""}
                                    />
                                    {errors.child_age && (
                                        <span className="error-message">{errors.child_age}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="address"
                                        placeholder="Address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.address ? "error" : ""}
                                    />
                                    {errors.address && (
                                        <span className="error-message">{errors.address}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Email Address"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.email ? "error" : ""}
                                    />
                                    {errors.email && <span className="error-message">{errors.email}</span>}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="Phone Number (Optional)"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="input-group">
                                    <textarea
                                        name="message"
                                        rows="4"
                                        placeholder="How can we help?"
                                        value={formData.message}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.message ? "error" : ""}
                                    />
                                    {errors.message && (
                                        <span className="error-message">{errors.message}</span>
                                    )}
                                    <span className="char-count">
                                        {formData.message.length}/5000
                                    </span>
                                </div>

                                <div className="form-action-row">
                                    <button
                                        type="button"
                                        className="free-assessment-btn"
                                        onClick={() => setIsAssessmentFormOpen(true)}
                                    >
                                        Free Assessment
                                    </button>

                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={loading}
                                        style={{
                                            opacity: loading ? 0.6 : 1,
                                            cursor: loading ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {loading ? (
                                            <>
                                                <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                Start Growing Together <FaPaperPlane />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Map Container */}
                <div className="map-container">
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d120612.98393522191!2d72.825765!3d19.144702!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b632906d04d3%3A0xc003923a1a941a!2sMumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>
            </div>

            {isAssessmentFormOpen && (
                <div className="app-modal-overlay" onClick={closeAssessmentModal}>
                    <div
                        className="app-modal-container app-modal-container--md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="app-modal-header app-modal-header--primary">
                            <h2 className="app-modal-title">Free Assessment Form</h2>
                            <button
                                type="button"
                                className="app-modal-close"
                                aria-label="Close free assessment form"
                                onClick={closeAssessmentModal}
                            >
                                ×
                            </button>
                        </div>
                        <div className="app-modal-content">
                            <form id="free-assessment-form" className="assessment-form" onSubmit={handleAssessmentSubmit}>
                                <div className="assessment-section">
                                    <h3>Basic Information</h3>
                                    <div className="assessment-grid">
                                        <div className="input-group">
                                            <label htmlFor="child_name">Name</label>
                                            <input
                                                id="child_name"
                                                name="child_name"
                                                type="text"
                                                value={assessmentData.child_name}
                                                onChange={handleAssessmentInputChange}
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="child_age">Age</label>
                                            <input
                                                id="child_age"
                                                name="child_age"
                                                type="text"
                                                value={assessmentData.child_age}
                                                onChange={handleAssessmentInputChange}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="date_of_assessment">Date of Assessment</label>
                                            <input
                                                id="date_of_assessment"
                                                name="date_of_assessment"
                                                type="date"
                                                value={assessmentData.date_of_assessment}
                                                onChange={handleAssessmentInputChange}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="address">Address</label>
                                            <input
                                                id="address"
                                                name="address"
                                                type="text"
                                                value={assessmentData.address}
                                                onChange={handleAssessmentInputChange}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="siblings">Siblings</label>
                                            <input
                                                id="siblings"
                                                name="siblings"
                                                type="text"
                                                value={assessmentData.siblings}
                                                onChange={handleAssessmentInputChange}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="sibling_age">Sibling Age</label>
                                            <input
                                                id="sibling_age"
                                                name="sibling_age"
                                                type="text"
                                                value={assessmentData.sibling_age}
                                                onChange={handleAssessmentInputChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Mother Details</h3>
                                    <div className="assessment-grid">
                                        <div className="input-group">
                                            <label htmlFor="mother_name">Name of the Mother</label>
                                            <input id="mother_name" name="mother_name" type="text" value={assessmentData.mother_name} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="mother_age">Age</label>
                                            <input id="mother_age" name="mother_age" type="text" value={assessmentData.mother_age} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="mother_education">Education</label>
                                            <input id="mother_education" name="mother_education" type="text" value={assessmentData.mother_education} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="mother_profession">Profession</label>
                                            <input id="mother_profession" name="mother_profession" type="text" value={assessmentData.mother_profession} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="mother_contact">Contact No.</label>
                                            <input id="mother_contact" name="mother_contact" type="text" value={assessmentData.mother_contact} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="mother_email">Email</label>
                                            <input id="mother_email" name="mother_email" type="email" value={assessmentData.mother_email} onChange={handleAssessmentInputChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Father Details</h3>
                                    <div className="assessment-grid">
                                        <div className="input-group">
                                            <label htmlFor="father_name">Name of the Father</label>
                                            <input id="father_name" name="father_name" type="text" value={assessmentData.father_name} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="father_age">Age</label>
                                            <input id="father_age" name="father_age" type="text" value={assessmentData.father_age} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="father_education">Education</label>
                                            <input id="father_education" name="father_education" type="text" value={assessmentData.father_education} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="father_profession">Profession</label>
                                            <input id="father_profession" name="father_profession" type="text" value={assessmentData.father_profession} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="father_contact">Contact No.</label>
                                            <input id="father_contact" name="father_contact" type="text" value={assessmentData.father_contact} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="father_email">Email</label>
                                            <input id="father_email" name="father_email" type="email" value={assessmentData.father_email} onChange={handleAssessmentInputChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Current Development Learning and Behaviour Overview</h3>
                                    <p className="assessment-scale-help">
                                        0 = It is of most concern, 1 = Developed till certain level, need to work on it, 2 = Seems to be lacking, need help, 3 = It is age appropriately developed.
                                    </p>
                                    <div className="assessment-skills-list">
                                        {ASSESSMENT_SKILLS.map((skill) => (
                                            <div className="assessment-skill-row" key={skill.key}>
                                                <p>{skill.label}</p>
                                                <div className="assessment-ratings">
                                                    {[0, 1, 2, 3].map((rating) => (
                                                        <label key={`${skill.key}_${rating}`}>
                                                            <input
                                                                type="radio"
                                                                name={`skill_${skill.key}`}
                                                                value={rating}
                                                                checked={assessmentData.skills[skill.key] === String(rating)}
                                                                onChange={(e) => handleSkillRatingChange(skill.key, e.target.value)}
                                                            />
                                                            {rating}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Specific Diagnosis / Concern</h3>
                                    <div className="assessment-checkbox-grid">
                                        {ASSESSMENT_DISORDERS.map((disorder) => (
                                            <label key={disorder} className="assessment-checkbox-item">
                                                <input
                                                    type="checkbox"
                                                    checked={assessmentData.selected_disorders.includes(disorder)}
                                                    onChange={() => handleDisorderToggle(disorder)}
                                                />
                                                <span>{disorder}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Medical History</h3>
                                    <div className="assessment-grid">
                                        <div className="input-group">
                                            <label>Did the baby scream as a baby?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_baby_scream" value="yes" checked={assessmentData.medical_baby_scream === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_baby_scream" value="no" checked={assessmentData.medical_baby_scream === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Did the baby have a difficult sleep pattern?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_difficult_sleep" value="yes" checked={assessmentData.medical_difficult_sleep === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_difficult_sleep" value="no" checked={assessmentData.medical_difficult_sleep === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Did the baby display struggle in changing routines?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_routine_change" value="yes" checked={assessmentData.medical_routine_change === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_routine_change" value="no" checked={assessmentData.medical_routine_change === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Did the baby display difficulties while shifting food habits?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_food_habit_shift" value="yes" checked={assessmentData.medical_food_habit_shift === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_food_habit_shift" value="no" checked={assessmentData.medical_food_habit_shift === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Did the baby achieve physical milestones at the right age?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_physical_milestones" value="yes" checked={assessmentData.medical_physical_milestones === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_physical_milestones" value="no" checked={assessmentData.medical_physical_milestones === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group">
                                            <label>Did the baby achieve vocal/language milestones at the right age?</label>
                                            <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_language_milestones" value="yes" checked={assessmentData.medical_language_milestones === 'yes'} onChange={handleAssessmentInputChange} />
                                                    Yes
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input type="radio" name="medical_language_milestones" value="no" checked={assessmentData.medical_language_milestones === 'no'} onChange={handleAssessmentInputChange} />
                                                    No
                                                </label>
                                            </div>
                                        </div>
                                        <div className="input-group input-group-full">
                                            <label htmlFor="medical_major_illness">Did the baby have any major illness/hospitalization in early developmental years? If yes, mention details.</label>
                                            <textarea id="medical_major_illness" name="medical_major_illness" rows="3" value={assessmentData.medical_major_illness} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group input-group-full">
                                            <label htmlFor="medical_specific_details">Please mention specific medical details, if any.</label>
                                            <textarea id="medical_specific_details" name="medical_specific_details" rows="3" value={assessmentData.medical_specific_details} onChange={handleAssessmentInputChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>Learning History</h3>
                                    <div className="assessment-grid">
                                        <div className="input-group">
                                            <label htmlFor="learning_school_years">Number of years school attended</label>
                                            <input id="learning_school_years" name="learning_school_years" type="text" value={assessmentData.learning_school_years} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="learning_support">Any support provided?</label>
                                            <input id="learning_support" name="learning_support" type="text" value={assessmentData.learning_support} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="learning_current_grade">Current grade of learning</label>
                                            <input id="learning_current_grade" name="learning_current_grade" type="text" value={assessmentData.learning_current_grade} onChange={handleAssessmentInputChange} />
                                        </div>
                                        <div className="input-group">
                                            <label htmlFor="learning_scenario">Current learning scenario</label>
                                            <input id="learning_scenario" name="learning_scenario" type="text" value={assessmentData.learning_scenario} onChange={handleAssessmentInputChange} />
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-section">
                                    <h3>History of Intervention</h3>
                                    <div className="input-group">
                                        <textarea
                                            id="intervention_history"
                                            name="intervention_history"
                                            rows="4"
                                            value={assessmentData.intervention_history}
                                            onChange={handleAssessmentInputChange}
                                            placeholder="Share intervention history details here"
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="app-modal-footer">
                            <button
                                type="button"
                                className="app-modal-btn app-modal-btn--secondary"
                                onClick={closeAssessmentModal}
                                disabled={assessmentSubmitting}
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                className="app-modal-btn app-modal-btn--primary"
                                form="free-assessment-form"
                                disabled={assessmentSubmitting}
                            >
                                {assessmentSubmitting ? "Submitting..." : "Submit Assessment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactUs;
