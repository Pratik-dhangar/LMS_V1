import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * MediaControlContext
 * Manages global media state for video/PDF playback synchronization
 * Handles media state synchronization between trainer and learners
 */
const MediaControlContext = createContext(null);

/**
 * Hook to use MediaControlContext
 */
export const useMediaControl = () => {
    const context = useContext(MediaControlContext);
    if (!context) {
        throw new Error('useMediaControl must be used within MediaControlProvider');
    }
    return context;
};

/**
 * MediaControlProvider Component
 * Wraps the app to provide media control state globally
 */
export const MediaControlProvider = ({ children }) => {
    // Current media being displayed
    const [currentMedia, setCurrentMedia] = useState({
        mediaId: null,
        mediaType: null, // 'video' or 'pdf'
        mediaUrl: null,
        status: 'paused', // 'playing' or 'paused'
        currentTime: 0, // for video
        currentPage: 1, // for pdf
        isVisible: false,
    });

    // Track which trainer is controlling media (prevent multiple trainer control)
    const [activeTrainer, setActiveTrainer] = useState(null);

    // Callbacks that parent components will set
    const callbacksRef = React.useRef({
        onMediaControl: null,
    });

    /**
     * Open media popup
     */
    const openMedia = useCallback((mediaId, mediaType, mediaUrl) => {
        setCurrentMedia(prev => ({
            ...prev,
            mediaId,
            mediaType,
            mediaUrl,
            isVisible: true,
        }));

        // Notify parent about media open event
        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'open',
                mediaId,
                mediaType,
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Close media popup
     */
    const closeMedia = useCallback(() => {
        const mediaId = currentMedia.mediaId;
        setCurrentMedia(prev => ({
            ...prev,
            isVisible: false,
        }));

        // Notify parent about media close event
        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'close',
                mediaId,
                timestamp: Date.now(),
            });
        }
    }, [currentMedia.mediaId]);

    /**
     * Play video
     */
    const playMedia = useCallback((mediaId) => {
        setCurrentMedia(prev => {
            if (prev.mediaId === mediaId) {
                return { ...prev, status: 'playing' };
            }
            return prev;
        });

        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'play',
                mediaId,
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Pause video
     */
    const pauseMedia = useCallback((mediaId) => {
        setCurrentMedia(prev => {
            if (prev.mediaId === mediaId) {
                return { ...prev, status: 'paused' };
            }
            return prev;
        });

        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'pause',
                mediaId,
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Seek to specific time in video
     */
    const seekMedia = useCallback((mediaId, currentTime) => {
        setCurrentMedia(prev => {
            if (prev.mediaId === mediaId) {
                return { ...prev, currentTime };
            }
            return prev;
        });

        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'seek',
                mediaId,
                currentTime,
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Change PDF page
     */
    const changePageMedia = useCallback((mediaId, currentPage) => {
        setCurrentMedia(prev => {
            if (prev.mediaId === mediaId) {
                return { ...prev, currentPage };
            }
            return prev;
        });

        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'page_change',
                mediaId,
                currentPage,
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Handle media control event from WebSocket
     * Used to sync media state from server
     */
    const handleMediaControlEvent = useCallback((event) => {
        const { action, mediaId, mediaType, mediaUrl, status, currentTime, currentPage, activeTrainerId } = event;

        switch (action) {
            case 'open':
                setCurrentMedia(prev => ({
                    ...prev,
                    mediaId,
                    mediaType,
                    mediaUrl,
                    status: status || 'paused',
                    currentTime: currentTime || 0,
                    currentPage: currentPage || 1,
                    isVisible: true,
                }));
                if (activeTrainerId) {
                    setActiveTrainer(activeTrainerId);
                }
                break;

            case 'close':
                setCurrentMedia(prev => ({
                    ...prev,
                    isVisible: false,
                }));
                setActiveTrainer(null);
                break;

            case 'play':
                setCurrentMedia(prev => {
                    if (prev.mediaId === mediaId) {
                        return { ...prev, status: 'playing' };
                    }
                    return prev;
                });
                break;

            case 'pause':
                setCurrentMedia(prev => {
                    if (prev.mediaId === mediaId) {
                        return { ...prev, status: 'paused' };
                    }
                    return prev;
                });
                break;

            case 'seek':
                setCurrentMedia(prev => {
                    if (prev.mediaId === mediaId) {
                        return { ...prev, currentTime };
                    }
                    return prev;
                });
                break;

            case 'page_change':
                setCurrentMedia(prev => {
                    if (prev.mediaId === mediaId) {
                        return { ...prev, currentPage };
                    }
                    return prev;
                });
                break;

            default:
                console.warn('[MediaControlContext] Unknown media control action:', action);
        }
    }, []);

    /**
     * Request media snapshot from server
     * Used when a new learner joins to get current media state
     */
    const requestMediaSnapshot = useCallback(() => {
        if (callbacksRef.current.onMediaControl) {
            callbacksRef.current.onMediaControl({
                action: 'request_snapshot',
                timestamp: Date.now(),
            });
        }
    }, []);

    /**
     * Register callback for media control events
     */
    const setMediaControlCallback = useCallback((callback) => {
        callbacksRef.current.onMediaControl = callback;
    }, []);

    const value = {
        // State
        currentMedia,
        activeTrainer,

        // Actions
        openMedia,
        closeMedia,
        playMedia,
        pauseMedia,
        seekMedia,
        changePageMedia,
        handleMediaControlEvent,
        requestMediaSnapshot,

        // Callbacks
        setMediaControlCallback,
    };

    return (
        <MediaControlContext.Provider value={value}>
            {children}
        </MediaControlContext.Provider>
    );
};

export default MediaControlContext;
