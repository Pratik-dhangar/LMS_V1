import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import '../../../styles/components/admin/EditHeadSections.css';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const ProfessionalInfoSection = ({ formData, handleChange }) => (
  <section className="edit-head-section">
    <h2 className="edit-head-section-title">
      Professional Information
    </h2>
    <div className="edit-head-section-grid">
      <TextAreaField
        label="Qualification"
        name="qualification"
        value={formData.qualification}
        onChange={handleChange}
        rows={3}
        placeholder="Enter educational qualifications"
      />

      <TextAreaField
        label="Experience"
        name="experience"
        value={formData.experience}
        onChange={handleChange}
        rows={3}
        placeholder="Enter work experience"
      />

      <TextAreaField
        label="Experience with HurshBin"
        name="experience_with_hurshbin"
        value={formData.experience_with_hurshbin}
        onChange={handleChange}
        rows={3}
        placeholder="Describe experience with HurshBin"
      />
    </div>
  </section>
);

export default ProfessionalInfoSection;
