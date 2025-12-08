import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const InterventionHistorySection = ({ formData, handleChange, handleFileChange, referenceFiles, removeFile }) => {
  return (
    <div className="register-section">
      <h2 className="register-section-title">
        History of Intervention
      </h2>

      {/* Upload References */}
      <div className="register-field-full">
        <label htmlFor="intervention_reference_files" className="register-field-label">
          Upload References (Documents, Images, Videos)
        </label>
        <input
          type="file"
          id="intervention_reference_files"
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

      {/* Duration of intervention */}
      <div className="register-field-full">
        <label htmlFor="intervention_duration" className="register-field-label">
          Number of months/years of intervention
        </label>
        <input
          type="text"
          id="intervention_duration"
          name="intervention_duration"
          value={formData.intervention_duration}
          onChange={handleChange}
          className="register-input"
          placeholder="e.g., 6 months, 2 years"
        />
      </div>

      {/* Intervention notes */}
      <div>
        <label htmlFor="intervention_notes" className="register-field-label">
          Notes
        </label>
        <textarea
          id="intervention_notes"
          name="intervention_notes"
          value={formData.intervention_notes}
          onChange={handleChange}
          rows="4"
          className="register-textarea"
          placeholder="Enter intervention notes..."
        />
      </div>
    </div>
  );
};

export default InterventionHistorySection;
