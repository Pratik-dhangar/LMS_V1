// PersonalDetailsSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import FormSection from '../../common/FormSection';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const PersonalDetailsSection = ({ formData, handleChange }) => (
  <FormSection 
    title="Personal Details"
    description="Personal interests and aspirations"
  >
    <div className="modern-form-grid-full">
      <TextAreaField
        label="Interest"
        name="interest"
        value={formData.interest}
        onChange={handleChange}
        rows={2}
        placeholder="Enter interests and hobbies"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Describe Yourself?"
        name="self_description"
        value={formData.self_description}
        onChange={handleChange}
        rows={3}
        placeholder="Self description"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Describe Your future Vision"
        name="future_vision"
        value={formData.future_vision}
        onChange={handleChange}
        rows={3}
        placeholder="Future vision and goals"
      />
    </div>
  </FormSection>
);

export default PersonalDetailsSection;
