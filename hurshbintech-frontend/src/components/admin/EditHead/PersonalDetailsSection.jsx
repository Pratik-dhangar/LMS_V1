// PersonalDetailsSection Component
import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import '../../../styles/components/admin/EditHeadSections.css';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const PersonalDetailsSection = ({ formData, handleChange }) => (
  <section className="edit-head-section">
    <h2 className="edit-head-section-title">
      Personal Details
    </h2>
    <div className="edit-head-section-grid">
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
