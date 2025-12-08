import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const AssessmentBehaviourSection = ({ formData, handleChange }) => {
  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Assessment Behaviour
      </h2>

      <div>
        <label htmlFor="assessment_behaviour_notes" className="register-field-label">
          Notes
        </label>
        <textarea
          id="assessment_behaviour_notes"
          name="assessment_behaviour_notes"
          value={formData.assessment_behaviour_notes}
          onChange={handleChange}
          rows="5"
          className="register-textarea"
          placeholder="Enter assessment behaviour notes..."
        />
      </div>
    </div>
  );
};

export default AssessmentBehaviourSection;
