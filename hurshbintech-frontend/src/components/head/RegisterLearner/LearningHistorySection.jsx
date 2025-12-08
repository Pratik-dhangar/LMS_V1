import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const LearningHistorySection = ({ formData, handleChange }) => {
  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Learning History
      </h2>

      <div className="register-section-grid">
        {/* Number of years school attended */}
        <div>
          <label htmlFor="years_school_attended" className="register-field-label">
            Number of years school attended
          </label>
          <input
            type="number"
            id="years_school_attended"
            name="years_school_attended"
            value={formData.years_school_attended}
            onChange={handleChange}
            className="register-input"
            placeholder="Enter number of years"
            min="0"
          />
        </div>

        {/* Current grade of learning */}
        <div>
          <label htmlFor="current_grade" className="register-field-label">
            Current grade of learning
          </label>
          <input
            type="text"
            id="current_grade"
            name="current_grade"
            value={formData.current_grade}
            onChange={handleChange}
            className="register-input"
            placeholder="e.g., Grade 5, KG-2"
          />
        </div>
      </div>

      {/* Any support provided */}
      <div className="register-field-full">
        <label htmlFor="support_provided" className="register-field-label">
          Any support provided?
        </label>
        <textarea
          id="support_provided"
          name="support_provided"
          value={formData.support_provided}
          onChange={handleChange}
          rows="3"
          className="register-textarea"
          placeholder="Describe any support provided..."
        />
      </div>

      {/* Current learning scenario */}
      <div className="register-field-full">
        <label htmlFor="current_learning_scenario" className="register-field-label">
          Current learning scenario
        </label>
        <textarea
          id="current_learning_scenario"
          name="current_learning_scenario"
          value={formData.current_learning_scenario}
          onChange={handleChange}
          rows="4"
          className="register-textarea"
          placeholder="Describe the current learning scenario..."
        />
      </div>
    </div>
  );
};

export default LearningHistorySection;
