// PerformanceFeedbackSection Component
import React from 'react';
import InputField from '../../common/InputField';
import TextAreaField from '../../common/TextAreaField';
import '../../../styles/components/admin/EditHeadSections.css';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const PerformanceFeedbackSection = ({ formData, handleChange }) => (
  <section className="edit-head-section">
    <h2 className="edit-head-section-title">
      Performance & Feedback
    </h2>
    <div className="edit-head-section-grid">
      <InputField
        label="Number of Sessions Done"
        name="number_of_sessions_done"
        type="number"
        value={formData.number_of_sessions_done}
        onChange={handleChange}
        placeholder="0"
        min={0}
      />

      <TextAreaField
        label="Describe yourself?"
        name="head_description"
        value={formData.head_description}
        onChange={handleChange}
        rows={4}
        placeholder="Head's feedback and description"
      />

      <TextAreaField
        label="How do Learners' Guardians describe you?"
        name="learners_guardian_description"
        value={formData.learners_guardian_description}
        onChange={handleChange}
        rows={4}
        placeholder="Guardian's feedback and description"
      />

      <TextAreaField
        label="Your Input at HurshBin"
        name="input_at_hurshbin"
        value={formData.input_at_hurshbin}
        onChange={handleChange}
        rows={3}
        placeholder="Contributions and input"
      />
    </div>
  </section>
);

export default PerformanceFeedbackSection;
