// PersonalDetailsSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const PersonalDetailsSection = ({ formData, handleChange }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
      Personal Details
    </h2>
    <div className="grid grid-cols-1 gap-6">
      <TextAreaField
        label="Interest"
        name="interest"
        value={formData.interest}
        onChange={handleChange}
        rows={2}
        placeholder="Enter interests and hobbies"
      />
      
      <TextAreaField
        label="Describe Yourself?"
        name="self_description"
        value={formData.self_description}
        onChange={handleChange}
        rows={3}
        placeholder="Self description"
      />
      
      <TextAreaField
        label="Describe Your future Vision"
        name="future_vision"
        value={formData.future_vision}
        onChange={handleChange}
        rows={3}
        placeholder="Future vision and goals"
      />
    </div>
  </section>
);

export default PersonalDetailsSection;
