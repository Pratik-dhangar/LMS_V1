// BasicInfoSection Component
import React from 'react';
import InputField from '../../common/InputField';
import TextAreaField from '../../common/TextAreaField';
import FormSection from '../../common/FormSection';

/**
 * @param {object} formData
 * @param {object} errors
 * @param {function} handleChange
 */
const BasicInfoSection = ({ formData, errors, handleChange }) => (
  <FormSection 
    title="Basic Information"
    description="Enter the essential details of the Candidate"
  >
    <div className="modern-form-grid-two-col">
      <InputField
        label="Name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
        placeholder="Enter full name"
        error={errors.name}
      />

      <InputField
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        required
        placeholder="Enter email address"
        error={errors.email}
      />

      <InputField
        label="Age"
        name="age"
        type="number"
        value={formData.age}
        onChange={handleChange}
        placeholder="Enter age"
        error={errors.age}
        required
        min={18}
        max={100}
      />

      <InputField
        label="Contact Number"
        name="contact_no"
        type="tel"
        value={formData.contact_no}
        onChange={handleChange}
        required
        placeholder="+91-8928765220"
        error={errors.contact_no}
      />

      <InputField
        label="Date of Joining"
        name="date_of_joining"
        type="date"
        required
        value={formData.date_of_joining}
        onChange={handleChange}
        error={errors.date_of_joining}
      />

      <div className="modern-form-grid-full">
        <TextAreaField
          label="Address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          rows={3}
          required
          placeholder="Enter full address"
          error={errors.address}
        />
      </div>
    </div>
  </FormSection>
);

export default BasicInfoSection;
