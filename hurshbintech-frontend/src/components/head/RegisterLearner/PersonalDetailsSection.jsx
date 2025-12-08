import React from 'react';
import ChecklistField from '../../common/ChecklistField';
import '../../../styles/components/head/RegisterLearnerSections.css';

const PersonalDetailsSection = ({ formData, errors, handleChange, handleFileChange, referenceFiles, removeFile }) => {
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

      {/* Upload References */}
      <div className="register-field-full">
        <label htmlFor="personal_reference_files" className="register-field-label">
          Upload References (Documents, Images, Videos)
        </label>
        <input
          type="file"
          id="personal_reference_files"
          multiple
          onChange={handleFileChange}
          className="register-file-input"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.mp4,.avi,.mov"
        />
        <p className="register-file-hint">
          Supported formats: PDF, DOCX, Images, Videos
        </p>

        {referenceFiles.length > 0 && (
          <div className="register-file-list">
            {referenceFiles.map((file, index) => (
              <div key={index} className="register-file-item">
                <span className="register-file-name">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="register-file-remove"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
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
