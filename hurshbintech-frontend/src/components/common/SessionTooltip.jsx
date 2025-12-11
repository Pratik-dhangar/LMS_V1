import React, { useEffect, useRef } from 'react';
import '../../styles/SessionTooltip.css';

/**
 * SessionTooltip - Display session notes and learning goals on click
 * @param {Object} session - Session object with notes and learning_goals
 * @param {Object} position - Tooltip position {x, y}
 * @param {Function} onClose - Callback to close the tooltip
 */
const SessionTooltip = ({ session, position, onClose }) => {
    const tooltipRef = useRef(null);

    if (!session) return null;

    const hasNotes = session.session_notes && session.session_notes.trim();
    const hasGoals = session.learning_goals && session.learning_goals.length > 0;

    // Handle click outside tooltip to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Add event listener with a slight delay to avoid immediate closure
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Adjust position to ensure tooltip stays within viewport
    useEffect(() => {
        if (tooltipRef.current) {
            const tooltip = tooltipRef.current;
            const rect = tooltip.getBoundingClientRect();

            // Get current styles
            let left = parseFloat(tooltip.style.left);
            let top = parseFloat(tooltip.style.top);

            // Viewport dimensions
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust if going off-screen to the right
            if (rect.right > viewportWidth) {
                left = Math.max(10, viewportWidth - rect.width - 10);
                tooltip.style.left = `${left}px`;
            }

            // Adjust if going off-screen at the bottom
            if (rect.bottom > viewportHeight) {
                top = Math.max(10, viewportHeight - rect.height - 10);
                tooltip.style.top = `${top}px`;
            }
        }
    }, [position]);

    if (!hasNotes && !hasGoals) {
        return (
            <div
                ref={tooltipRef}
                className="session-tooltip session-tooltip-click"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`
                }}
            >
                <div className="tooltip-header-with-close">
                    <div></div>
                    <button
                        onClick={onClose}
                        className="tooltip-close-button"
                        title="Close"
                        aria-label="Close tooltip"
                    >
                        ✕
                    </button>
                </div>
                <div className="tooltip-section">
                    <p className="tooltip-empty">No session notes or goals recorded</p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={tooltipRef}
            className="session-tooltip session-tooltip-click"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`
            }}
        >
            {/* Close Button */}
            <div className="tooltip-header-with-close">
                <div></div>
                <button
                    onClick={onClose}
                    className="tooltip-close-button"
                    title="Close"
                    aria-label="Close tooltip"
                >
                    ✕
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="tooltip-body">
                {/* Session Notes Section */}
                {hasNotes && (
                    <div className="tooltip-section">
                        <div className="tooltip-header">📝 Session Notes</div>
                        <div className="tooltip-content">
                            <p className="tooltip-notes">{session.session_notes}</p>
                        </div>
                    </div>
                )}

                {/* Learning Goals Section */}
                {hasGoals && (
                    <div className="tooltip-section">
                        <div className="tooltip-header">🎯 Learning Goals</div>
                        <div className="tooltip-content">
                            {session.learning_goals.map((goal, index) => (
                                <div key={goal.id || index} className="tooltip-goal">
                                    <div className="goal-title">{goal.goal}</div>
                                    {goal.goal_description && (
                                        <div className="goal-description">{goal.goal_description}</div>
                                    )}
                                    {/* Show prompt and reinforcement values if available */}
                                    {(goal.prompt_meter || goal.reinforcement_meter) && (
                                        <div className="goal-meters">
                                            {goal.prompt_meter && (
                                                <span className="meter-badge meter-prompt">
                                                    Prompt: {goal.prompt_meter}
                                                </span>
                                            )}
                                            {goal.reinforcement_meter && (
                                                <span className="meter-badge meter-reinforcement">
                                                    Reinforcement: {goal.reinforcement_meter}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SessionTooltip;
