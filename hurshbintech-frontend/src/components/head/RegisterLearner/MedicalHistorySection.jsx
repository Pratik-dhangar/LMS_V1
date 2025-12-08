import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const MedicalHistorySection = ({ formData, handleChange }) => {
  const RadioGroup = ({ label, name, value }) => (
    <div className="register-radio-group">
      <label className="register-radio-label">{label}</label>
      <div className="register-radio-options">
        <label className="register-radio-option">
          <input
            type="radio"
            name={name}
            value="true"
            checked={value === true}
            onChange={handleChange}
            className="register-radio-input"
          />
          <span className="register-radio-text">Yes</span>
        </label>
        <label className="register-radio-option">
          <input
            type="radio"
            name={name}
            value="false"
            checked={value === false}
            onChange={handleChange}
            className="register-radio-input"
          />
          <span className="register-radio-text">No</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Medical History
      </h2>

      <RadioGroup
        label="Did the baby scream as a baby?"
        name="screamed_as_baby"
        value={formData.screamed_as_baby}
      />

      <RadioGroup
        label="Did the baby have a difficult sleep pattern?"
        name="difficult_sleep_pattern"
        value={formData.difficult_sleep_pattern}
      />

      <RadioGroup
        label="Did the baby display struggle in changing the routines?"
        name="struggled_changing_routines"
        value={formData.struggled_changing_routines}
      />

      <RadioGroup
        label="Did the baby display difficulties while shifting food habits?"
        name="difficulties_shifting_food"
        value={formData.difficulties_shifting_food}
      />

      <RadioGroup
        label="Did the baby achieve physical milestones at the right age?"
        name="physical_milestones_achieved"
        value={formData.physical_milestones_achieved}
      />

      <RadioGroup
        label="Did the baby vocal/language milestones at the right age?"
        name="vocal_language_milestones_achieved"
        value={formData.vocal_language_milestones_achieved}
      />

      <RadioGroup
        label="Did the baby have any major illness/hospitalization in early developmental years?"
        name="major_illness_hospitalization"
        value={formData.major_illness_hospitalization}
      />

      {formData.major_illness_hospitalization === true && (
        <div className="register-conditional-field">
          <label htmlFor="major_illness_details" className="register-field-label">
            If yes, mention details:
          </label>
          <textarea
            id="major_illness_details"
            name="major_illness_details"
            value={formData.major_illness_details}
            onChange={handleChange}
            rows="3"
            className="register-textarea"
            placeholder="Enter illness/hospitalization details..."
          />
        </div>
      )}

      <div className="register-field-full">
        <label htmlFor="specific_medical_details" className="register-field-label">
          Please mention specific medical details if any:
        </label>
        <textarea
          id="specific_medical_details"
          name="specific_medical_details"
          value={formData.specific_medical_details}
          onChange={handleChange}
          rows="4"
          className="register-textarea"
          placeholder="Enter any specific medical details..."
        />
      </div>
    </div>
  );
};

export default MedicalHistorySection;
