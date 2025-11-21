import React from 'react';
import TextAreaField from '../../common/TextAreaField';

/**
 * @param {object} formData 
 * @param {function} handleChange 
 */
const ProfessionalInfoSection = ({ formData, handleChange }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
      Professional Information
    </h2>
    <div className="grid grid-cols-1 gap-6">
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
