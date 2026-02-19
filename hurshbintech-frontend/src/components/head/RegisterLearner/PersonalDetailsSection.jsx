import React from 'react';
import ChecklistField from '../../common/ChecklistField';
import '../../../styles/components/head/RegisterLearnerSections.css';

const PersonalDetailsSection = ({ formData, errors, handleChange }) => {
  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Personal Details
      </h2>

      <div className="register-section-grid">
        {/* Name */}
        <div>
          <label htmlFor="name" className="register-field-label">
            Name <span className="register-required">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`register-input ${errors.name ? 'register-input-error' : ''}`}
            placeholder="Enter learner's name"
          />
          {errors.name && <p className="register-error-text">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="register-field-label">
            Email <span className="register-required">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`register-input ${errors.email ? 'register-input-error' : ''}`}
            placeholder="Enter email address"
          />
          {errors.email && <p className="register-error-text">{errors.email}</p>}
        </div>

        {/* Contact Number */}
        <div>
          <label htmlFor="contact_number" className="register-field-label">
            Contact Number
          </label>
          <input
            type="tel"
            id="contact_number"
            name="contact_number"
            value={formData.contact_number}
            onChange={handleChange}
            className={`register-input ${errors.contact_number ? 'register-input-error' : ''}`}
            placeholder="Enter contact number"
          />
          {errors.contact_number && <p className="register-error-text">{errors.contact_number}</p>}
        </div>

        {/* Age */}
        <div>
          <label htmlFor="age" className="register-field-label">
            Age <span className="register-required">*</span>
          </label>
          <input
            type="number"
            id="age"
            name="age"
            value={formData.age}
            onChange={handleChange}
            className={`register-input ${errors.age ? 'register-input-error' : ''}`}
            placeholder="Enter age"
            min="0"
          />
          {errors.age && <p className="register-error-text">{errors.age}</p>}
        </div>

        {/* DOB */}
        <div>
          <label htmlFor="dob" className="register-field-label">
            Date of Birth (DOB) <span className="register-required">*</span>
          </label>
          <input
            type="date"
            id="dob"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className={`register-input ${errors.dob ? 'register-input-error' : ''}`}
          />
          {errors.dob && <p className="register-error-text">{errors.dob}</p>}
        </div>

        {/* Date of Assessment */}
        <div>
          <label htmlFor="date_of_assessment" className="register-field-label">
            Date of Assessment <span className="register-required">*</span>
          </label>
          <input
            type="date"
            id="date_of_assessment"
            name="date_of_assessment"
            value={formData.date_of_assessment}
            onChange={handleChange}
            className={`register-input ${errors.date_of_assessment ? 'register-input-error' : ''}`}
          />
          {errors.date_of_assessment && <p className="register-error-text">{errors.date_of_assessment}</p>}
        </div>
      </div>

      {/* Checklist of DLB concerns */}
      <div className="mt-6">
        <ChecklistField
          label="DLB Concerns Checklist"
          name="dlb_concerns_checklist"
          value={formData.dlb_concerns_checklist || []}
          onChange={handleChange}
          error={errors.dlb_concerns_checklist}
          required
        />
      </div>

      {/* A box for notes */}
      <div className="register-field-full">
        <label htmlFor="personal_notes" className="register-field-label">
          Notes <span className="register-required">*</span>
        </label>
        <textarea
          id="personal_notes"
          name="personal_notes"
          value={formData.personal_notes}
          onChange={handleChange}
          rows="4"
          className={`register-textarea ${errors.personal_notes ? 'register-input-error' : ''}`}
          placeholder="Enter personal notes..."
        />
        {errors.personal_notes && <p className="register-error-text">{errors.personal_notes}</p>}
      </div>
    </div>
  );
};

export default PersonalDetailsSection;
