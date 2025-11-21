import React from 'react';

const SkillDevelopmentSection = ({ formData, handleChange }) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
        Detailed Skill Development Assessment
      </h2>
      
      <div>
        <label htmlFor="skill_development_assessment" className="block text-sm font-medium text-gray-700 mb-2">
          Skill Development Assessment
        </label>
        <textarea
          id="skill_development_assessment"
          name="skill_development_assessment"
          value={formData.skill_development_assessment}
          onChange={handleChange}
          rows="6"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Enter detailed skill development assessment..."
        />
      </div>
    </div>
  );
};

export default SkillDevelopmentSection;
