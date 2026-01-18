import React from 'react';
import TextAreaField from '../../common/TextAreaField';
import FormSection from '../../common/FormSection';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const ProfessionalInfoSection = ({ formData, handleChange }) => (
  <FormSection 
    title="Professional Information"
    description="Professional background and qualifications"
  >
    <div className="modern-form-grid-full">
      <TextAreaField
        label="Qualification"
        name="qualification"
        value={formData.qualification}
        onChange={handleChange}
        rows={3}
        placeholder="Enter educational qualifications"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Experience"
        name="experience"
        value={formData.experience}
        onChange={handleChange}
        rows={3}
        placeholder="Enter work experience"
      />
    </div>

    <div className="modern-form-grid-full">
      <TextAreaField
        label="Experience with HurshBin"
        name="experience_with_hurshbin"
        value={formData.experience_with_hurshbin}
        onChange={handleChange}
        rows={3}
        placeholder="Describe experience with HurshBin"
      />
    </div>
  </FormSection>
);

export default ProfessionalInfoSection;
