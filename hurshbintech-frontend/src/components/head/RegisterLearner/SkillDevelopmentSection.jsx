import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const SkillDevelopmentSection = ({ formData, handleChange }) => {
  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Detailed Skill Development Assessment
      </h2>

      <div>
        <label htmlFor="skill_development_assessment" className="register-field-label">
          Skill Development Assessment
        </label>
        <textarea
          id="skill_development_assessment"
          name="skill_development_assessment"
          value={formData.skill_development_assessment}
          onChange={handleChange}
          rows="6"
          className="register-textarea"
          placeholder="Enter detailed skill development assessment..."
        />
      </div>
    </div>
  );
};

export default SkillDevelopmentSection;
