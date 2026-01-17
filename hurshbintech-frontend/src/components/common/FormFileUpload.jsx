import React from 'react';
import '../../styles/components/common/FormFileUpload.css';

/**
 * FormFileUpload Component
 * 
 * Modern file upload component with drag-and-drop support
 * Shows file list with preview and remove functionality
 * 
 * @param {string} label - The label text to display
 * @param {string} name - The name/id attribute for the input
 * @param {Array} files - Array of selected files
 * @param {function} onChange - Handler function called when files are selected
 * @param {function} onRemove - Handler function called when a file is removed (receives index)
 * @param {string} accept - Accepted file types (e.g., ".pdf,.doc,.docx")
 * @param {boolean} multiple - Whether multiple files can be selected
 * @param {boolean} required - Whether the field is required
 * @param {string} helpText - Helper text to display below the input
 */
const FormFileUpload = ({
  label,
  name,
  files = [],
  onChange,
  onRemove,
  accept = "",
  multiple = true,
  required = false,
  helpText = "Supported formats: PDF, DOCX, Images, Videos"
}) => {
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const event = {
        target: {
          files: droppedFiles
        }
      };
      onChange(event);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return '🖼️';
    } else if (['pdf'].includes(ext)) {
      return '📄';
    } else if (['doc', 'docx'].includes(ext)) {
      return '📝';
    } else if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) {
      return '🎥';
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return '🎵';
    } else if (['zip', 'rar', '7z'].includes(ext)) {
      return '📦';
    }
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      <label className="file-upload-label">
        {label} {required && <span className="file-upload-required">*</span>}
      </label>

      <div className="file-upload-input-wrapper">
        <div
          className={`file-upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id={name}
            name={name}
            multiple={multiple}
            onChange={onChange}
            accept={accept}
            className="file-upload-input"
          />
          
          <label htmlFor={name} className="file-upload-label-area">
            <div className="file-upload-icon">
              <svg className="file-upload-icon-svg" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
              </svg>
            </div>
            <div className="file-upload-text">
              <span className="file-upload-text-primary">
                Drag and drop files here
              </span>
              <span className="file-upload-text-secondary">{helpText}</span>
            </div>
          </label>
        </div>
        
        <label htmlFor={name} className="file-upload-btn">
          <svg className="file-upload-btn-icon" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
          </svg>
          Choose Files
        </label>
      </div>

      {files.length > 0 && (
        <div className="file-upload-list">
          <div className="file-upload-list-header">
            <span className="file-upload-list-title">
              Selected Files ({files.length})
            </span>
          </div>
          {files.map((file, index) => (
            <div key={index} className="file-upload-item">
              <div className="file-upload-item-info">
                <span className="file-upload-item-icon">
                  {getFileIcon(file.name)}
                </span>
                <div className="file-upload-item-details">
                  <span className="file-upload-item-name">{file.name}</span>
                  <span className="file-upload-item-size">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="file-upload-item-remove"
                aria-label="Remove file"
              >
                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormFileUpload;
