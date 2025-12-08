import React from 'react';
import '../../styles/components/common/TextAreaField.css';

/**
 * TextAreaField Component
 * 
 * Reusable textarea component with label, validation, and error handling
 * Used for multi-line text inputs like descriptions, addresses, notes, etc.
 * 
 * @param {string} label - The label text to display above the textarea
 * @param {string} name - The name attribute for the textarea field
 * @param {string} value - The current value of the textarea
 * @param {function} onChange - Handler function called when textarea value changes
 * @param {number} rows - Number of visible text rows (default: 3)
 * @param {string} placeholder - Placeholder text for the textarea
 * @param {string} error - Error message to display below the textarea
 * @param {boolean} required - Whether the field is required (shows asterisk)
 */
const TextAreaField = ({
  label,
  name,
  value,
  onChange,
  rows = 3,
  placeholder = "",
  error,
  required = false
}) => (
  <div className="textarea-field-container">
    <label htmlFor={name} className="textarea-field-label">
      {label} {required && <span className="textarea-field-required">*</span>}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className={`textarea-field-textarea ${error ? 'error' : ''}`}
    ></textarea>
    {error && <p className="textarea-field-error-message">{error}</p>}
  </div>
);

export default TextAreaField;
