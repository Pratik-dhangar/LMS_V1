/**
 * Image Modal Component
 * Full-screen image viewer with download option
 */

import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import '../../styles/chats/ImageModal.css';

const ImageModal = ({ imageUrl, fileName, onClose }) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'image';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(imageUrl, '_blank');
    }
  };

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="image-modal-header">
          <span className="image-modal-filename">{fileName}</span>
          <div className="image-modal-actions">
            <button
              className="image-modal-btn"
              onClick={handleDownload}
              title="Download"
            >
              <Download size={20} />
            </button>
            <button
              className="image-modal-btn"
              onClick={onClose}
              title="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="image-modal-body">
          <img
            src={imageUrl}
            alt={fileName}
            className="image-modal-img"
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
