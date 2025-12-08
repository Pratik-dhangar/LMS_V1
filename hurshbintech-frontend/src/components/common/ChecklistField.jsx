import React from 'react';
import '../../styles/components/common/ChecklistField.css';

const DLB_CONCERNS_OPTIONS = [
  { value: 'language_delay', label: 'Language delay' },
  { value: 'social_interaction_difficulties', label: 'Social interaction difficulties' },
  { value: 'motor_skill_challenges', label: 'Motor skill challenges' },
  { value: 'attention_focus_issues', label: 'Attention and focus issues' },
  { value: 'behavioral_concerns', label: 'Behavioral concerns' },
];

const ChecklistField = ({ label, name, value = [], onChange, error, required = false }) => {
  const handleCheckboxChange = (optionValue) => {
    const currentValues = Array.isArray(value) ? value : [];

    let newValues;
    if (currentValues.includes(optionValue)) {
      // Remove if already selected
      newValues = currentValues.filter(v => v !== optionValue);
    } else {
      // Add if not selected
      newValues = [...currentValues, optionValue];
    }

    // Call onChange with event-like structure to match existing handlers
    onChange({
      target: {
        name: name,
        value: newValues
      }
    });
  };

  return (
    <div className="checklist-field">
      <label className="checklist-label">
        {label}
        {required && <span className="checklist-required">*</span>}
      </label>

      <div className={`checklist-container ${error ? 'error' : ''}`}>
        <div className="checklist-grid">
          {DLB_CONCERNS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="checklist-option"
            >
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option.value)}
                onChange={() => handleCheckboxChange(option.value)}
                className="checklist-checkbox"
              />
              <span className="checklist-option-text">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="checklist-error">{error}</p>
      )}


    </div>
  );
};

export default ChecklistField;
