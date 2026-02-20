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
        audioCache.forEach((audio) => {
            audio.pause();
            audio.currentTime = 0;
        });
    } catch (error) {
        console.error('[FeedbackSound] Error stopping audio:', error);
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
        audioCache.forEach((audio) => {
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
    playFloatingAnimationSound,
    stopFeedbackSounds,
    setFeedbackSoundVolume,
    cleanupFeedbackSounds
};
