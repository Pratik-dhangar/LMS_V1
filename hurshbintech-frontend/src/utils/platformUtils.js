/**
 * Meeting Platform Utilities
 * Helper functions for displaying platform information
 */

/**
 * Get icon component for meeting platform
 * @param {string} platform - Platform identifier
 * @returns {string} - Icon name for lucide-react
 */
export const getPlatformIcon = (platform) => {
  const icons = {
    zoom: 'Video',
    google_meet: 'Video',
    microsoft_teams: 'Users',
    webex: 'Video',
    skype: 'MessageCircle',
    gotomeeting: 'Video',
    jitsi: 'Video',
    whereby: 'Video',
    bluejeans: 'Video',
    other: 'ExternalLink'
  };
  return icons[platform] || 'ExternalLink';
};

/**
 * Get color class for platform badge
 * @param {string} platform - Platform identifier
 * @returns {string} - Tailwind color class
 */
export const getPlatformColorClass = (platform) => {
  const colors = {
    zoom: 'bg-yellow-100 text-amber-800 border-amber-300',
    google_meet: 'bg-teal-100 text-teal-700 border-teal-300',
    microsoft_teams: 'bg-purple-100 text-purple-700 border-purple-300',
    webex: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    skype: 'bg-sky-100 text-sky-700 border-sky-300',
    gotomeeting: 'bg-orange-100 text-orange-700 border-orange-300',
    jitsi: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    whereby: 'bg-violet-100 text-violet-700 border-violet-300',
    bluejeans: 'bg-yellow-100 text-amber-800 border-amber-300',
    other: 'bg-gray-100 text-gray-700 border-gray-300'
  };
  return colors[platform] || 'bg-gray-100 text-gray-700 border-gray-300';
};

/**
 * Get button text based on user role
 * @param {boolean} isCreator - Whether current user is the webinar creator
 * @returns {string} - Button text
 */
export const getMeetingButtonText = (isCreator) => {
  return isCreator ? 'Start Meeting' : 'Join Meeting';
};

/**
 * Get button icon based on user role
 * @param {boolean} isCreator - Whether current user is the webinar creator
 * @returns {string} - Icon name for lucide-react
 */
export const getMeetingButtonIcon = (isCreator) => {
  return isCreator ? 'PlayCircle' : 'LogIn';
};
