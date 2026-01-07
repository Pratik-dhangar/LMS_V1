/**
 * Session Activity Tracker
 * Manages session activity detection to prevent multiple device/tab access
 * Stores session state in sessionStorage (tab-specific) and localStorage (device-wide)
 */

const SESSION_STORAGE_PREFIX = 'session_active_';
const LOCAL_STORAGE_PREFIX = 'device_session_';

/**
 * Mark a session as active in the current tab
 * @param {string} sessionId - The session ID
 * @param {string} role - The role ('trainer' or 'learner')
 * @returns {object} - { success: boolean, message: string }
 */
export const markSessionActive = (sessionId, role) => {
    try {
        const currentTabId = getTabId();
        console.log(`[SessionActivityTracker] Current tab ID: ${currentTabId}`);

        // Check if session is already active on this device
        const deviceSessionKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
        const deviceSessionData = localStorage.getItem(deviceSessionKey);

        console.log(`[SessionActivityTracker] Checking session: ${deviceSessionKey}`, deviceSessionData);

        if (deviceSessionData) {
            const parsedData = JSON.parse(deviceSessionData);
            const now = Date.now();
            const timeSinceLastActivity = now - parsedData.lastActivityTime;

            console.log(`[SessionActivityTracker] Session found. TabId from storage: ${parsedData.tabId}, Current TabId: ${currentTabId}, Time since activity: ${timeSinceLastActivity}ms`);

            // If session was active less than 5 minutes ago, it's still considered active
            if (timeSinceLastActivity < 5 * 60 * 1000) {
                // Check if it's from a different tab
                if (parsedData.tabId !== currentTabId) {
                    console.warn(`[SessionActivityTracker] RESTRICTION: Session already active in another tab (${parsedData.tabId})`);
                    return {
                        success: false,
                        message: 'Active already, Please close previous session.',
                        isAnotherTab: true
                    };
                } else {
                    console.log(`[SessionActivityTracker] Same tab ID, allowing continuation`);
                }
            } else {
                // Session expired, clear it
                console.log(`[SessionActivityTracker] Session expired, clearing old session`);
                localStorage.removeItem(deviceSessionKey);
            }
        } else {
            console.log(`[SessionActivityTracker] No existing session found`);
        }

        // Mark as active in current tab
        const tabSessionKey = `${SESSION_STORAGE_PREFIX}${sessionId}_${role}`;
        const tabData = {
            sessionId,
            role,
            tabId: currentTabId,
            startTime: Date.now(),
            lastActivityTime: Date.now()
        };
        sessionStorage.setItem(tabSessionKey, JSON.stringify(tabData));

        // Also mark in localStorage for device-wide tracking
        const deviceData = {
            sessionId,
            role,
            tabId: currentTabId,
            startTime: Date.now(),
            lastActivityTime: Date.now()
        };
        localStorage.setItem(deviceSessionKey, JSON.stringify(deviceData));

        console.log(`[SessionActivityTracker] Session marked as active with tabId: ${currentTabId}`);

        return {
            success: true,
            message: 'Session marked as active'
        };
    } catch (error) {
        console.error('Error marking session active:', error);
        return {
            success: false,
            message: 'Error tracking session activity'
        };
    }
};

/**
 * Update the last activity time for a session
 * @param {string} sessionId - The session ID
 * @param {string} role - The role ('trainer' or 'learner')
 */
export const updateSessionActivity = (sessionId, role) => {
    try {
        const tabSessionKey = `${SESSION_STORAGE_PREFIX}${sessionId}_${role}`;
        const deviceSessionKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
        const now = Date.now();

        // Update in sessionStorage
        const tabData = sessionStorage.getItem(tabSessionKey);
        if (tabData) {
            const parsed = JSON.parse(tabData);
            parsed.lastActivityTime = now;
            sessionStorage.setItem(tabSessionKey, JSON.stringify(parsed));
        }

        // Update in localStorage
        const deviceData = localStorage.getItem(deviceSessionKey);
        if (deviceData) {
            const parsed = JSON.parse(deviceData);
            parsed.lastActivityTime = now;
            localStorage.setItem(deviceSessionKey, JSON.stringify(parsed));
        }
    } catch (error) {
        console.error('Error updating session activity:', error);
    }
};

/**
 * Remove session activity tracking when session is closed
 * IMPORTANT: Only clears localStorage if THIS tab was the one using it
 * @param {string} sessionId - The session ID
 * @param {string} role - The role ('trainer' or 'learner')
 */
export const clearSessionActivity = (sessionId, role) => {
    try {
        const tabSessionKey = `${SESSION_STORAGE_PREFIX}${sessionId}_${role}`;
        const deviceSessionKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;

        // Get current tab ID for comparison
        const currentTabId = getTabId();

        // Always clear tab-specific storage
        sessionStorage.removeItem(tabSessionKey);

        // Only clear device storage if THIS tab was the one using it
        const deviceSessionData = localStorage.getItem(deviceSessionKey);
        if (deviceSessionData) {
            const parsedData = JSON.parse(deviceSessionData);
            // Only remove if this tab's ID matches the stored ID
            if (parsedData.tabId === currentTabId) {
                localStorage.removeItem(deviceSessionKey);
                console.log(`[SessionActivityTracker] Cleared device session activity for ${role} - ${sessionId} (this tab was using it)`);
            } else {
                console.log(`[SessionActivityTracker] Preserved device session activity for ${role} - ${sessionId} (another tab is using it with tabId: ${parsedData.tabId})`);
            }
        }

        console.log(`[SessionActivityTracker] Cleared tab-specific session activity for ${role} - ${sessionId}`);
    } catch (error) {
        console.error('Error clearing session activity:', error);
    }
};

/**
 * Check if a session is active on another tab/device
 * @param {string} sessionId - The session ID
 * @param {string} role - The role ('trainer' or 'learner')
 * @returns {object} - { isActive: boolean, details: object }
 */
export const checkSessionActivity = (sessionId, role) => {
    try {
        const deviceSessionKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
        const deviceSessionData = localStorage.getItem(deviceSessionKey);

        if (!deviceSessionData) {
            return {
                isActive: false,
                details: null
            };
        }

        const parsedData = JSON.parse(deviceSessionData);
        const now = Date.now();
        const timeSinceLastActivity = now - parsedData.lastActivityTime;

        // Session is considered active if there was activity within the last 5 minutes
        const isActive = timeSinceLastActivity < 5 * 60 * 1000;

        return {
            isActive,
            details: isActive ? parsedData : null
        };
    } catch (error) {
        console.error('Error checking session activity:', error);
        return {
            isActive: false,
            details: null
        };
    }
};

/**
 * Get unique tab ID - generates a truly unique ID for this specific tab
 * Uses a combination of crypto and per-tab isolation to ensure uniqueness
 * Store in sessionStorage to prevent sharing between tabs
 * @returns {string} - Unique tab identifier
 */
const TAB_ID_KEY = 'hurshbin_tab_id_unique_per_tab';
function getTabId() {
    // Check sessionStorage first (tab-specific storage)
    let tabId = sessionStorage.getItem(TAB_ID_KEY);

    if (!tabId) {
        // Generate new tab ID with maximum entropy
        let uuid;
        try {
            // Primary method: crypto.randomUUID()
            uuid = crypto.randomUUID();
        } catch (error) {
            // Fallback 1: Use crypto.getRandomValues() if available
            try {
                const arr = new Uint8Array(16);
                crypto.getRandomValues(arr);
                uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c, i) {
                    const r = (arr[Math.floor(i / 2)] >> (i % 2 ? 0 : 4)) & 0xf;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
            } catch (error2) {
                // Fallback 2: Last resort - maximum entropy from Math.random()
                uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = Math.random() * 16 | 0;
                    const v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        }
        // Add additional entropy with timestamp and random values
        const timestamp = Date.now().toString(36);
        const random1 = Math.random().toString(36).substr(2, 9);
        const random2 = Math.random().toString(36).substr(2, 9);
        tabId = `tab_${uuid}_${timestamp}_${random1}_${random2}`;

        // CRITICAL: Store in sessionStorage (tab-specific, not shared with other tabs)
        sessionStorage.setItem(TAB_ID_KEY, tabId);
        console.log(`[SessionActivityTracker] Generated unique tab ID: ${tabId}`);
    } else {
        console.log(`[SessionActivityTracker] Retrieved tab ID from sessionStorage: ${tabId}`);
    }

    return tabId;
}

/**
 * Get all active sessions for current device
 * @returns {array} - Array of active sessions
 */
export const getAllActiveSessions = () => {
    const activeSessions = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
                const sessionData = localStorage.getItem(key);
                if (sessionData) {
                    const parsed = JSON.parse(sessionData);
                    const now = Date.now();
                    const timeSinceLastActivity = now - parsed.lastActivityTime;

                    // Include only if activity is within last 5 minutes
                    if (timeSinceLastActivity < 5 * 60 * 1000) {
                        activeSessions.push(parsed);
                    } else {
                        // Clean up expired sessions
                        localStorage.removeItem(key);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error getting active sessions:', error);
    }
    return activeSessions;
};
