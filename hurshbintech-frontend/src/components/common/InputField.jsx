import React from 'react';

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
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
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
      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
        error ? 'border-red-500' : 'border-gray-300'
      }`}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

export default InputField;
