import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const InterventionHistorySection = ({ 
  formData, 
  handleChange, 
  handleFileChange, 
  referenceFiles, 
  removeFile,
  existingReferenceData,
  handleViewFile,
  handleDeleteExistingFile
}) => {
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

        {/* Existing Reference Files */}
        {existingReferenceData && existingReferenceData.length > 0 && (
          <div className="existing-files-section" style={{ marginTop: '1rem' }}>
            <h4 className="subsection-title">Existing Reference Files</h4>
            <div className="file-list">
              {existingReferenceData.map((file) => (
                <div key={file.id} className="file-item">
                  <span className="file-name">{file.file_name || file.description || 'Unnamed File'}</span>
                  <div className="file-actions">
                    <button
                      type="button"
                      onClick={(e) => handleViewFile(file.file_path, e)}
                      className="btn-view-file"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingFile(file.id)}
                      className="file-remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Files to Upload */}
        {referenceFiles.length > 0 && (
          <div className="register-file-list">
            <h4 className="subsection-title">New Files to Upload</h4>
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
