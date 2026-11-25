/**
 * Session Activity Tracker for Live Session Studio.
 * Uses role- and tab-specific storage to allow Trainer and Learner tabs to coexist.
 */

const SESSION_STORAGE_PREFIX = 'lss_active_tab_';
const LOCAL_STORAGE_PREFIX = 'lss_device_';

const getTabId = () => {
  let tabId = sessionStorage.getItem('lss_tab_id');
  if (!tabId) {
    tabId = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    sessionStorage.setItem('lss_tab_id', tabId);
  }
  return tabId;
};

export const markSessionActive = (sessionId, role, allowOverride = false) => {
  try {
    const currentTabId = getTabId();
    const deviceKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
    const deviceData = localStorage.getItem(deviceKey);

    if (deviceData && !allowOverride) {
      const parsed = JSON.parse(deviceData);
      const elapsed = Date.now() - (parsed.lastActivityTime || 0);
      if (elapsed < 2 * 60 * 1000 && parsed.tabId !== currentTabId) {
        return {
          success: false,
          message: 'Session is active in another tab',
          isAnotherTab: true,
        };
      }
    }

    const payload = {
      sessionId,
      role,
      tabId: currentTabId,
      lastActivityTime: Date.now(),
    };
    sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${sessionId}_${role}`, JSON.stringify(payload));
    localStorage.setItem(deviceKey, JSON.stringify(payload));

    return { success: true, message: 'Session marked active' };
  } catch (err) {
    return { success: true };
  }
};

export const updateSessionActivity = (sessionId, role) => {
  try {
    const currentTabId = getTabId();
    const deviceKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
    const payload = {
      sessionId,
      role,
      tabId: currentTabId,
      lastActivityTime: Date.now(),
    };
    sessionStorage.setItem(`${SESSION_STORAGE_PREFIX}${sessionId}_${role}`, JSON.stringify(payload));
    localStorage.setItem(deviceKey, JSON.stringify(payload));
  } catch (_) {}
};

export const removeSessionActivity = (sessionId, role) => {
  try {
    sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${sessionId}_${role}`);
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`);
  } catch (_) {}
};

export const clearSessionActivity = removeSessionActivity;

export const isSessionActiveInAnotherTab = (sessionId, role) => {
  try {
    const currentTabId = getTabId();
    const deviceKey = `${LOCAL_STORAGE_PREFIX}${sessionId}_${role}`;
    const deviceData = localStorage.getItem(deviceKey);
    if (!deviceData) return false;
    const parsed = JSON.parse(deviceData);
    const elapsed = Date.now() - (parsed.lastActivityTime || 0);
    return elapsed < 2 * 60 * 1000 && parsed.tabId !== currentTabId;
  } catch (_) {
    return false;
  }
};

export default {
  markSessionActive,
  updateSessionActivity,
  removeSessionActivity,
  isSessionActiveInAnotherTab,
};
