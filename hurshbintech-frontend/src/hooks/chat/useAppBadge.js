/**
 * useAppBadge Hook
 * Manages PWA app icon badge notifications using the Badging API
 * Shows unread message count on the app icon (when installed as PWA)
 */

import { useEffect } from 'react';

/**
 * Check if Badging API is supported
 * @returns {boolean}
 */
const isBadgingSupported = () => {
  return 'setAppBadge' in navigator && 'clearAppBadge' in navigator;
};

/**
 * Set app badge with a count
 * @param {number} count - Number to display on badge (0 to clear)
 * @param {boolean} showCount - If true, shows count; if false, shows just a dot
 */
export const setAppBadge = (count, showCount = true) => {
  if (!isBadgingSupported()) {
    console.log('[AppBadge] Badging API not supported');
    return;
  }

  try {
    if (count > 0) {
      // Show either count or just a flag/dot
      if (showCount) {
        navigator.setAppBadge(count);
        console.log(`[AppBadge] Badge set to ${count}`);
      } else {
        navigator.setAppBadge(); // No argument = just shows a dot/flag
        console.log('[AppBadge] Badge set (dot mode)');
      }
    } else {
      navigator.clearAppBadge();
      console.log('[AppBadge] Badge cleared');
    }
  } catch (error) {
    console.error('[AppBadge] Error setting badge:', error);
  }
};

/**
 * Clear app badge
 */
export const clearAppBadge = () => {
  if (!isBadgingSupported()) {
    return;
  }

  try {
    navigator.clearAppBadge();
    console.log('[AppBadge] Badge cleared');
  } catch (error) {
    console.error('[AppBadge] Error clearing badge:', error);
  }
};

/**
 * React hook to automatically manage app badge based on unread count
 * @param {number} unreadCount - Total unread messages count
 * @param {boolean} showCount - If true, shows count; if false, shows just a dot (default: true)
 */
export const useAppBadge = (unreadCount, showCount = true) => {
  useEffect(() => {
    if (typeof unreadCount === 'number') {
      setAppBadge(unreadCount, showCount);
    }

    // Cleanup: Clear badge when component unmounts (optional)
    // Uncomment if you want badge to clear on logout
    // return () => clearAppBadge();
  }, [unreadCount, showCount]);

  return {
    isSupported: isBadgingSupported(),
    setBadge: setAppBadge,
    clearBadge: clearAppBadge,
  };
};

export default useAppBadge;
