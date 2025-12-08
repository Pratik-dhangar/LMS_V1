import React from 'react';
import '../../styles/components/common/InputField.css';

/**
 * InputField Component
 * 
 * Reusable input field component with label, validation, and error handling
 * Supports text, number, tel, email, date, and other HTML5 input types
 * 
 * @param {string} label - The label text to display above the input
 * @param {string} name - The name attribute for the input field
 * @param {string|number} value - The current value of the input
 * @param {function} onChange - Handler function called when input value changes
 * @param {string} type - Input type (text, number, tel, email, date, etc.)
 * @param {boolean} required - Whether the field is required (shows asterisk)
 * @param {string} placeholder - Placeholder text for the input
 * @param {string} error - Error message to display below the input
 * @param {number} min - Minimum value for number inputs
 * @param {number} max - Maximum value for number inputs
 */
const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder = "",
  error,
  min,
  max
}) => (
  <div className="input-field-container">
    <label htmlFor={name} className="input-field-label">
      {label} {required && <span className="input-field-required">*</span>}
    </label>
    <input
      type={type}
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`input-field-input ${error ? 'error' : ''}`}
    />
    {error && <p className="input-field-error-message">{error}</p>}
  </div>
);

export default InputField;
