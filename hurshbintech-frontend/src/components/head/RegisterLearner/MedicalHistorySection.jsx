import React from 'react';

const MedicalHistorySection = ({ formData, handleChange }) => {
  const RadioGroup = ({ label, name, value }) => (
    <div className="flex items-center gap-6 mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-0 flex-1">{label}</label>
      <div className="flex items-center gap-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name={name}
            value="true"
            checked={value === true}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Yes</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            name={name}
            value="false"
            checked={value === false}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">No</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
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
        <div className="ml-8 mb-4">
          <label htmlFor="major_illness_details" className="block text-sm font-medium text-gray-700 mb-2">
            If yes, mention details:
          </label>
          <textarea
            id="major_illness_details"
            name="major_illness_details"
            value={formData.major_illness_details}
            onChange={handleChange}
            rows="3"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="Enter illness/hospitalization details..."
          />
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="specific_medical_details" className="block text-sm font-medium text-gray-700 mb-2">
          Please mention specific medical details if any:
        </label>
        <textarea
          id="specific_medical_details"
          name="specific_medical_details"
          value={formData.specific_medical_details}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Enter any specific medical details..."
        />
      </div>
    </div>
  );
};

export default MedicalHistorySection;
