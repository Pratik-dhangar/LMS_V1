import React, { useState } from "react";
import { toast } from "react-toastify";
import { FaSpinner } from "react-icons/fa";
import contactService from "../../api/services/contactService";
import "../../styles/components/common/Modal.css";

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

const FreeAssessmentModal = ({ isOpen, onClose }) => {
    const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
    const [assessmentData, setAssessmentData] = useState(createInitialAssessmentData);

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
            onClose();
        } catch (error) {
            console.error("Error submitting free assessment:", error);
            toast.error("Unable to submit assessment form right now. Please try again.");
        } finally {
            setAssessmentSubmitting(false);
        }
    };

    const closeModal = () => {
        setAssessmentSubmitting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="app-modal-overlay" onClick={closeModal}>
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
                        onClick={closeModal}
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
                        onClick={closeModal}
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
    );
};

export default FreeAssessmentModal;
