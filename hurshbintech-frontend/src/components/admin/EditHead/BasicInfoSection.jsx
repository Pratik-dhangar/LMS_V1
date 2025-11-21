// BasicInfoSection Component
import React from 'react';
import InputField from '../../common/InputField';
import TextAreaField from '../../common/TextAreaField';

/**
 * @param {object} formData
 * @param {object} errors
 * @param {function} handleChange
 */
const BasicInfoSection = ({ formData, errors, handleChange }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300">
      Basic Information
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        placeholder="+91-XXXXXXXXXX"
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
      
      <div className="md:col-span-2">
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
  </section>
);

export default BasicInfoSection;
