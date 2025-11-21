import React from 'react';

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
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      <div className={`border rounded-lg p-4 bg-gray-50 ${error ? 'border-red-500' : 'border-gray-300'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DLB_CONCERNS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center space-x-3 cursor-pointer hover:bg-white p-3 rounded-md transition-colors duration-200"
            >
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option.value)}
                onChange={() => handleCheckboxChange(option.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-700 select-none">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      
      
    </div>
  );
};

export default ChecklistField;
