import React from 'react';

const LearningHistorySection = ({ formData, handleChange }) => {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
        Learning History
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Number of years school attended */}
        <div>
          <label htmlFor="years_school_attended" className="block text-sm font-medium text-gray-700 mb-2">
            Number of years school attended
          </label>
          <input
            type="number"
            id="years_school_attended"
            name="years_school_attended"
            value={formData.years_school_attended}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="Enter number of years"
            min="0"
          />
        </div>

        {/* Current grade of learning */}
        <div>
          <label htmlFor="current_grade" className="block text-sm font-medium text-gray-700 mb-2">
            Current grade of learning
          </label>
          <input
            type="text"
            id="current_grade"
            name="current_grade"
            value={formData.current_grade}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            placeholder="e.g., Grade 5, KG-2"
          />
        </div>
      </div>

      {/* Any support provided */}
      <div className="mt-6">
        <label htmlFor="support_provided" className="block text-sm font-medium text-gray-700 mb-2">
          Any support provided?
        </label>
        <textarea
          id="support_provided"
          name="support_provided"
          value={formData.support_provided}
          onChange={handleChange}
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Describe any support provided..."
        />
      </div>

      {/* Current learning scenario */}
      <div className="mt-6">
        <label htmlFor="current_learning_scenario" className="block text-sm font-medium text-gray-700 mb-2">
          Current learning scenario
        </label>
        <textarea
          id="current_learning_scenario"
          name="current_learning_scenario"
          value={formData.current_learning_scenario}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          placeholder="Describe the current learning scenario..."
        />
      </div>
    </div>
  );
};

export default LearningHistorySection;
