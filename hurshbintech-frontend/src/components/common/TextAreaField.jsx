import React from 'react';

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
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <textarea
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${
        error ? 'border-red-500' : 'border-gray-300'
      }`}
    ></textarea>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
);

export default TextAreaField;
