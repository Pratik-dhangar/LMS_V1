// ConfirmModal Component - A reusable confirmation modal dialog

import React from 'react';

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

  const iconColor = variant === "danger" ? "bg-red-100" : "bg-blue-100";
  const iconStroke = variant === "danger" ? "text-red-600" : "text-blue-600";
  const buttonColor = variant === "danger" 
    ? "bg-red-600 hover:bg-red-700" 
    : "bg-blue-600 hover:bg-blue-700";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
        <div className="flex items-center gap-4 mb-4">
          <div className={`flex-shrink-0 w-12 h-12 ${iconColor} rounded-full flex items-center justify-center`}>
            <svg className={`w-6 h-6 ${iconStroke}`} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2 ${buttonColor} text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
