// ConfirmModal Component - A reusable confirmation modal dialog

import React from 'react';
import '../../styles/components/common/ConfirmModal.css';

/**
 * @param {boolean} show 
 * @param {function} onClose 
 * @param {function} onConfirm 
 * @param {string} title 
 * @param {string} message 
 * @param {string} confirmText 
 * @param {string} cancelText 
 * @param {boolean} loading 
 * @param {string} variant 
 */
const ConfirmModal = ({
  show,
  isOpen, // some callers use `isOpen` prop; accept both for compatibility
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  variant = "danger" // "danger" or "primary"
}) => {
  const visible = typeof show !== 'undefined' ? show : !!isOpen;
  if (!visible) return null;

  const iconClass = variant === "danger" ? "danger" : "primary";
  const buttonClass = variant === "danger" ? "danger" : "primary";

  return (
    <div className="confirm-modal-overlay">
      <div className="confirm-modal-container">
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon ${iconClass}`}>
            <svg fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <div className="confirm-modal-header-text">
            <h3>{title}</h3>
            <p>This action cannot be undone</p>
          </div>
        </div>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-buttons">
          <button
            onClick={onClose}
            disabled={loading}
            className="confirm-modal-cancel-btn"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`confirm-modal-confirm-btn ${buttonClass}`}
          >
            {loading ? (
              <>
                <div className="confirm-modal-spinner"></div>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
