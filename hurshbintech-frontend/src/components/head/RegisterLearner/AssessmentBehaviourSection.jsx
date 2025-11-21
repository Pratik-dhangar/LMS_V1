import React from 'react';

const AssessmentBehaviourSection = ({ formData, handleChange }) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
        Assessment Behaviour
      </h2>
      
      <div>
        <label htmlFor="assessment_behaviour_notes" className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          id="assessment_behaviour_notes"
          name="assessment_behaviour_notes"
          value={formData.assessment_behaviour_notes}
          onChange={handleChange}
          rows="5"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Enter assessment behaviour notes..."
        />
      </div>
    </div>
  );
};

export default AssessmentBehaviourSection;
