/**
 * Stopwatch Sound Effects Utility
 * Provides tick and celebration sounds for countdown timer
 */

let audioContext = null;

// Get or create audio context
const getAudioContext = () => {
    if (!audioContext || audioContext.state === 'closed') {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
};

/**
 * Play tick sound - short beep for countdown
 */
export const playTickSound = () => {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        oscillator.start(now);
        oscillator.stop(now + 0.08);
    } catch (e) {
    }
};

/**
 * Play celebration sound - 5 second victory fanfare with clapping
 */
export const playCelebrationSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) {
            return;
        }

        // Resume context if needed (browser autoplay policy)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const now = ctx.currentTime;

        const playNote = (freq, time, duration, volume = 0.2, type = 'sine') => {
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.frequency.value = freq;
                osc.type = type;

                gain.gain.setValueAtTime(volume, now + time);
                gain.gain.exponentialRampToValueAtTime(0.01, now + time + duration);

                osc.start(now + time);
                osc.stop(now + time + duration);
            } catch (e) {
            }
        };

        // Victory fanfare melody
        // Opening - ascending
        playNote(523.25, 0, 0.15, 0.3);      // C5
        playNote(659.25, 0.15, 0.15, 0.3);   // E5
        playNote(783.99, 0.3, 0.2, 0.3);     // G5
        playNote(1046.50, 0.5, 0.4, 0.35);   // C6 - high note!

        // Second phrase
        playNote(880.00, 1.0, 0.2, 0.3);     // A5
        playNote(987.77, 1.2, 0.2, 0.3);     // B5
        playNote(1046.50, 1.4, 0.5, 0.35);   // C6

        // Descending
        playNote(987.77, 2.0, 0.12, 0.25);   // B5
        playNote(880.00, 2.12, 0.12, 0.25);  // A5
        playNote(783.99, 2.24, 0.12, 0.25);  // G5
        playNote(659.25, 2.36, 0.12, 0.25);  // E5
        playNote(523.25, 2.48, 0.3, 0.3);    // C5

        // Final big chord (C major)
        playNote(523.25, 3.0, 0.8, 0.3);     // C5
        playNote(659.25, 3.0, 0.8, 0.3);     // E5
        playNote(783.99, 3.0, 0.8, 0.3);     // G5

        // Clapping sounds using simple oscillators (more reliable)
        const clapTimes = [3.9, 4.1, 4.3, 4.5, 4.7];
        clapTimes.forEach(time => {
            // Use square wave burst for clap sound
            playNote(150, time, 0.04, 0.25, 'square');
            playNote(200, time + 0.01, 0.03, 0.2, 'square');
        });

    } catch (e) {
    }
};

/**
 * Cleanup audio context
 */
export const cleanupAudio = () => {
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
    }
};

export default {
    playTickSound,
    playCelebrationSound,
    cleanupAudio
};
