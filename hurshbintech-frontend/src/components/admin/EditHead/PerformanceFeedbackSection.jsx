// PerformanceFeedbackSection Component
import React from 'react';
import InputField from '../../common/InputField';
import TextAreaField from '../../common/TextAreaField';
import FormSection from '../../common/FormSection';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const PerformanceFeedbackSection = ({ formData, handleChange }) => (
  <FormSection 
    title="Performance & Feedback"
    description="Track sessions and gather feedback"
  >
    <InputField
      label="Number of Sessions Done"
      name="number_of_sessions_done"
      type="number"
      value={formData.number_of_sessions_done}
      onChange={handleChange}
      placeholder="0"
      min={0}
    />

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Describe yourself?"
        name="head_description"
        value={formData.head_description}
        onChange={handleChange}
        rows={4}
        placeholder="Head's feedback and description"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="How do Learners' Guardians describe you?"
        name="learners_guardian_description"
        value={formData.learners_guardian_description}
        onChange={handleChange}
        rows={4}
        placeholder="Guardian's feedback and description"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Your Input at HurshBin"
        name="input_at_hurshbin"
        value={formData.input_at_hurshbin}
        onChange={handleChange}
        rows={3}
        placeholder="Contributions and input"
      />
    </div>
  </FormSection>
);

export default PerformanceFeedbackSection;
