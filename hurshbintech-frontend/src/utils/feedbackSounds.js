/**
 * Feedback Sounds Utility
 * Handles playing audio feedback for instructor session feedback messages
 * Maps feedback messages to corresponding sound files
 */

// Mapping of feedback messages to audio file names
const FEEDBACK_SOUND_MAP = {
    'Good Job!': 'Good Job.mp3',
    'Wow!': 'Wow.mp3',
    'Doing Well': 'Doing Well.mp3',
    'Thank You': 'Thank You.mp3',
    'Loved it': 'Loved it.mp3',
    'Relax': 'Relax.mp3',
    'Please Wait...': 'Wait.mp3'
};


// Cache for audio elements to avoid creating new ones each time
const audioCache = new Map();

// Cache for interval-based looping (keyed by sound file name)
const loopIntervalCache = new Map();

// Track which sound files are currently in 'active loop' mode
const activeLoopSounds = new Set();

/**
 * Get or create an audio element for a given sound file
 * Caches audio elements to improve performance
 * 
 * @param {string} soundFile - The sound file name (e.g., 'Good Job.mp3')
 * @returns {HTMLAudioElement} - The audio element
 */
const getAudioElement = (soundFile) => {
    if (!audioCache.has(soundFile)) {
        const audio = new Audio(`/music/${soundFile}`);
        audio.volume = 0.7; // Set default volume to 70%
        audioCache.set(soundFile, audio);
    }
    return audioCache.get(soundFile);
};

/**
 * Play feedback sound based on feedback message
 * Handles different feedback types and plays corresponding audio files
 * 
 * @param {string} feedbackMessage - The feedback message text
 * @example
 * playFeedbackSound('Good Job!');
 * playFeedbackSound('Doing Well');
 */
export const playFeedbackSound = (feedbackMessage) => {
    try {
        const soundFile = FEEDBACK_SOUND_MAP[feedbackMessage];

        if (!soundFile) {
            // console.warn(`[FeedbackSound] No audio mapping found for: ${feedbackMessage}`);
            return;
        }

        const audio = getAudioElement(soundFile);

        // Always ensure loop is off (defensive – in case a previous loop call is still cached)
        audio.loop = false;
        audio.onended = null;

        // Reset audio to beginning and play
        audio.currentTime = 0;

        // Attempt to play, handling browser autoplay policies
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .catch(error => {
                    console.warn(`[FeedbackSound] Could not play audio: ${soundFile}`, error);
                });
        }
    } catch (error) {
        console.error('[FeedbackSound] Error playing feedback sound:', error);
    }
};

/**
 * Play sound for floating animation reactions
 * Plays sound when instructor sends floating animations (bubbles, smileys, etc.)
 * 
 * @param {string} animationType - Type of animation ('bubble', 'smiley', 'balloon', 'star')
 * @example
 * playFloatingAnimationSound('bubble');
 * playFloatingAnimationSound('smiley');
 */
export const playFloatingAnimationSound = (animationType) => {
    try {
        const soundFile = FLOATING_ANIMATION_SOUND_MAP[animationType];

        if (!soundFile) {
            console.warn(`[FeedbackSound] No audio mapping found for animation: ${animationType}`);
            return;
        }

        const audio = getAudioElement(soundFile);

        // Reset audio to beginning and play
        audio.currentTime = 0;

        // Attempt to play, handling browser autoplay policies
        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .catch(error => {
                    console.warn(`[FeedbackSound] Could not play audio: ${soundFile}`, error);
                });
        }
    } catch (error) {
        console.error('[FeedbackSound] Error playing animation sound:', error);
    }
};

/**
 * Stop all currently playing feedback sounds
 */
export const stopFeedbackSounds = () => {
    try {
        // Deactivate all loop sounds and clear scheduled timeouts
        activeLoopSounds.clear();
        loopIntervalCache.forEach((timeoutId) => clearTimeout(timeoutId));
        loopIntervalCache.clear();

        audioCache.forEach((audio) => {
            audio.onended = null;
            audio.loop = false;
            audio.pause();
            audio.currentTime = 0;
        });
    } catch (error) {
        console.error('[FeedbackSound] Error stopping audio:', error);
    }
};

/**
 * Play feedback sound on an interval (for persistent messages like "Please Wait...")
 * Plays the sound immediately, then repeats every 7 seconds.
 * @param {string} feedbackMessage - The feedback message text
 * @returns {HTMLAudioElement|null} - The audio element, or null if not found
 */
export const playFeedbackSoundLoop = (feedbackMessage) => {
    try {
        const soundFile = FEEDBACK_SOUND_MAP[feedbackMessage];
        if (!soundFile) return null;

        // Stop any pre-existing interval or scheduled timeout for this sound
        if (loopIntervalCache.has(soundFile)) {
            clearTimeout(loopIntervalCache.get(soundFile));
            loopIntervalCache.delete(soundFile);
        }

        const audio = getAudioElement(soundFile);

        // Ensure native loop is OFF — use our own timed schedule instead
        audio.loop = false;
        audio.onended = null;
        audio.pause();
        audio.currentTime = 0;

        // Mark this sound as actively looping
        activeLoopSounds.add(soundFile);

        // Recursive scheduler: play once, then 7 seconds after it ends, play again
        const scheduleNextPlay = () => {
            // Stop if this sound was deactivated
            if (!activeLoopSounds.has(soundFile)) return;

            audio.currentTime = 0;
            const p = audio.play();
            if (p !== undefined) {
                p.catch(err => {
                    console.warn(`[FeedbackSound] Could not play audio: ${soundFile}`, err);
                });
            }

            // After playback ends, wait 7 seconds then play again
            audio.onended = () => {
                if (!activeLoopSounds.has(soundFile)) return;
                const timeoutId = setTimeout(scheduleNextPlay, 7000);
                loopIntervalCache.set(soundFile, timeoutId);
            };
        };

        scheduleNextPlay();

        return audio;
    } catch (error) {
        console.error('[FeedbackSound] Error playing interval feedback sound:', error);
        return null;
    }
};

/**
 * Stop a specific feedback sound by message
 * @param {string} feedbackMessage - The feedback message text
 */
export const stopFeedbackSound = (feedbackMessage) => {
    try {
        const soundFile = FEEDBACK_SOUND_MAP[feedbackMessage];
        if (!soundFile) return;

        // Remove from active set so the onended callback stops rescheduling
        activeLoopSounds.delete(soundFile);

        // Clear any pending timeout
        if (loopIntervalCache.has(soundFile)) {
            clearTimeout(loopIntervalCache.get(soundFile));
            loopIntervalCache.delete(soundFile);
        }

        const audio = audioCache.get(soundFile);
        if (audio) {
            audio.onended = null;  // Remove the rescheduling handler
            audio.loop = false;
            audio.pause();
            audio.currentTime = 0;
        }
    } catch (error) {
        console.error('[FeedbackSound] Error stopping specific audio:', error);
    }
};

/**
 * Set volume for all feedback sounds
 * @param {number} volume - Volume level (0 to 1)
 */
export const setFeedbackSoundVolume = (volume) => {
    try {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        audioCache.forEach((audio) => {
            audio.volume = normalizedVolume;
        });
    } catch (error) {
        console.error('[FeedbackSound] Error setting volume:', error);
    }
};

/**
 * Cleanup audio resources
 * Clears the audio cache and removes event listeners
 */
export const cleanupFeedbackSounds = () => {
    try {
        // Deactivate all loop sounds and clear scheduled timeouts
        activeLoopSounds.clear();
        loopIntervalCache.forEach((timeoutId) => clearTimeout(timeoutId));
        loopIntervalCache.clear();

        audioCache.forEach((audio) => {
            audio.onended = null;
            audio.loop = false;
            audio.pause();
            audio.src = '';
        });
        audioCache.clear();
    } catch (error) {
        console.error('[FeedbackSound] Error cleaning up audio:', error);
    }
};

export default {
    playFeedbackSound,
    playFeedbackSoundLoop,
    stopFeedbackSound,
    playFloatingAnimationSound,
    stopFeedbackSounds,
    setFeedbackSoundVolume,
    cleanupFeedbackSounds
};
