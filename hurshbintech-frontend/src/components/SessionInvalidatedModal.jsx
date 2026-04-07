/**
 * SessionInvalidatedModal Component
 * Custom styled modal for session invalidation alerts
 * Matches project theme (primary color: #db9d32)
 */

import React from 'react';
import './SessionInvalidatedModal.css';

const SessionInvalidatedModal = ({ isOpen, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="session-invalidated-overlay">
            <div className="session-invalidated-modal">
                {/* Close icon */}
                <div className="session-invalidated-close-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8M8 12h8" />
                    </svg>
                </div>

                {/* Modal header */}
                <h2 className="session-invalidated-title">Session Terminated</h2>

                {/* Modal message */}
                <p className="session-invalidated-message">
                    Your session has been logged out because you logged in from another device.
                </p>

                <p className="session-invalidated-submessage">
                    Only one device can be active at a time. Please log in again to continue.
                </p>

                {/* Action button */}
                <button
                    className="session-invalidated-btn"
                    onClick={onConfirm}
                >
                    Log In Again
                </button>
            </div>
        </div>
    );
};

export default SessionInvalidatedModal;
