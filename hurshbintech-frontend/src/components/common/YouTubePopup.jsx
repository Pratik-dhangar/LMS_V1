import React, { useRef, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaTimes, FaEllipsisV } from 'react-icons/fa';
import whiteboardService from '../../api/services/whiteboardService';
import '../../styles/components/common/YouTubePopup.css';

/**
 * YouTubePopup Component
 * Displays YouTube video in a draggable, resizable popup using YouTube IFrame API
 * Used by trainer to render YouTube content on whiteboard with full controls
 * Synced to learner with read-only mode (can resize, cannot drag/control playback)
 * Trainer's video playback (play/pause/seek) is synced to learner in real-time
 */
const YouTubePopup = ({
    videoId,
    title,
    popupId,
    onClose,
    initialPosition = { x: 100, y: 100 },
    initialSize = { width: 560, height: 315 },
    isTrainer = true,
    isReadOnly = false, // Learner mode: can resize but not drag or control playback
    onVideoStateChange = null, // Callback for trainer to send video state to learner
}) => {
    const popupRef = useRef(null);
    const headerRef = useRef(null);
    const resizeRef = useRef(null);
    const playerContainerRef = useRef(null);
    const playerRef = useRef(null);
    const uniqueIdRef = useRef(`yt-${popupId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState(initialSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [initialResizeSize, setInitialResizeSize] = useState({ width: 0, height: 0 });
    const [initialResizePos, setInitialResizePos] = useState({ x: 0, y: 0 });
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const lastSyncTimeRef = useRef(0);

    // Load YouTube IFrame API
    useEffect(() => {
        if (typeof window.YT !== 'undefined') {
            // API already loaded
            setIsPlayerReady(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;

        window.onYouTubeIframeAPIReady = () => {
            console.log('[YouTubePopup] YouTube IFrame API ready');
            setIsPlayerReady(true);
        };

        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }, []);

    // Initialize YouTube Player
    useEffect(() => {
        if (!window.YT || !isPlayerReady) {
            console.log('[YouTubePopup] Waiting for YouTube API... YT:', !!window.YT, 'isPlayerReady:', isPlayerReady);
            return;
        }

        if (!playerContainerRef.current) {
            console.log('[YouTubePopup] Player container not ready');
            return;
        }

        if (playerRef.current) {
            console.log('[YouTubePopup] Player already initialized');
            return; // Player already initialized
        }

        try {
            console.log('[YouTubePopup] Initializing YouTube player - isTrainer:', isTrainer, 'videoId:', videoId);

            const player = new window.YT.Player(uniqueIdRef.current, {
                videoId: videoId,
                playerVars: {
                    autoplay: isTrainer ? 1 : 0,
                    controls: isTrainer ? 1 : 0,
                    modestbranding: 1,
                    fs: isTrainer ? 1 : 0,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3, // Hide annotations
                    disablekb: isTrainer ? 0 : 1, // Disable keyboard for learner
                    playsinline: 1,
                },
                events: {
                    onReady: handlePlayerReady,
                    onStateChange: handlePlayerStateChange,
                    onError: handlePlayerError,
                },
            });

            playerRef.current = player;

            // For learner, disable keyboard controls after player is ready
            if (!isTrainer) {
                player.setOption('controls', 'false');
            }

            console.log('[YouTubePopup] Player initialized - isTrainer:', isTrainer);
        } catch (error) {
            console.error('[YouTubePopup] Failed to initialize player:', error);
        }

        return () => {
            // Don't destroy player on unmount to avoid issues
        };
    }, [videoId, isReadOnly, isPlayerReady]);

    // Handle player ready
    const handlePlayerReady = useCallback((event) => {
        console.log('[YouTubePopup] Player ready for video:', videoId);
    }, [videoId]);

    // Handle player state changes (play/pause/seek)
    const handlePlayerStateChange = useCallback((event) => {
        const player = playerRef.current;
        if (!player || !isTrainer) return;

        // Only sync when trainer controls the video
        const currentTime = player.getCurrentTime();
        const state = event.data;

        // YT.PlayerState: UNSTARTED = -1, ENDED = 0, PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5
        const now = Date.now();

        // Only sync every 200ms to avoid excessive messages
        if (now - lastSyncTimeRef.current >= 200) {
            lastSyncTimeRef.current = now;

            console.log('[YouTubePopup] Trainer video state changed - Time:', currentTime, 'State:', state);

            // Broadcast to learner via WhiteboardService
            whiteboardService.send('youtube_video_state', {
                popupId,
                videoId,
                currentTime,
                isPlaying: state === 1, // 1 = PLAYING
                timestamp: now,
            });
        }
    }, [isTrainer, popupId, videoId]);

    // Handle player errors
    const handlePlayerError = useCallback((event) => {
        console.error('[YouTubePopup] YouTube player error:', event.data);
    }, []);

    // Listener for learner to receive video state from trainer
    useEffect(() => {
        if (isTrainer || !playerRef.current || !isPlayerReady) return;

        const handleVideoStateUpdate = (data) => {
            if (data.popupId !== popupId) return; // Not for this popup

            const player = playerRef.current;
            if (!player) {
                console.warn('[YouTubePopup] Learner: Player not available for video state update');
                return;
            }

            console.log('[YouTubePopup] Learner received video state:', data);

            try {
                const currentTime = player.getCurrentTime();
                const timeDiff = Math.abs(currentTime - data.currentTime);

                // If time difference > 1 second, sync it
                if (timeDiff > 1) {
                    player.seekTo(data.currentTime);
                    console.log('[YouTubePopup] Learner synced seek to:', data.currentTime, '(was at', currentTime, ')');
                }

                // Sync play/pause state
                const playerState = player.getPlayerState();
                if (data.isPlaying && playerState !== 1) {
                    player.playVideo();
                    console.log('[YouTubePopup] Learner synced PLAY');
                } else if (!data.isPlaying && playerState === 1) {
                    player.pauseVideo();
                    console.log('[YouTubePopup] Learner synced PAUSE');
                }
            } catch (error) {
                console.error('[YouTubePopup] Error syncing learner video state:', error);
            }
        };

        whiteboardService.onVideoStateUpdate = handleVideoStateUpdate;

        return () => {
            whiteboardService.onVideoStateUpdate = null;
        };
    }, [isTrainer, popupId, isPlayerReady]);

    // Block keyboard controls for learner
    useEffect(() => {
        if (isTrainer) return; // Only for learner

        const handleKeyDown = (e) => {
            // Prevent: spacebar, arrow keys, K (play/pause), F (fullscreen), M (mute), J/L (seek), C (captions)
            const blockedKeys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'k', 'K', 'f', 'F', 'm', 'M', 'j', 'J', 'l', 'L', 'c', 'C'];
            if (blockedKeys.includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const container = popupRef.current;
        if (container) {
            container.addEventListener('keydown', handleKeyDown, true);
            console.log('[YouTubePopup] Keyboard controls blocked for learner');
            return () => {
                container.removeEventListener('keydown', handleKeyDown, true);
            };
        }
    }, [isTrainer]);

    // Mark player container as ready to receive player
    useEffect(() => {
        setIsPlayerReady(true);
    }, []);

    // Handle drag start - disabled for learner (read-only)
    const handleDragStart = useCallback((e) => {
        if (!isTrainer || isReadOnly) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position, isTrainer, isReadOnly]);

    // Handle drag move
    const handleDragMove = useCallback((e) => {
        if (!isDragging) return;

        setPosition({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y,
        });
    }, [isDragging, dragOffset]);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Handle resize start - allowed for both trainer and learner
    const handleResizeStart = useCallback((e) => {
        // Learner can resize, trainer can resize
        // But learner cannot drag header
        if (isReadOnly && e.target.closest('.youtube-popup-header')) return;

        setIsResizing(true);
        setInitialResizeSize({ ...size });
        setInitialResizePos({ x: e.clientX, y: e.clientY });
    }, [size, isReadOnly]);

    // Handle resize move
    const handleResizeMove = useCallback((e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - initialResizePos.x;
        const deltaY = e.clientY - initialResizePos.y;

        // Maintain 16:9 aspect ratio
        const newWidth = Math.max(320, initialResizeSize.width + deltaX);
        const newHeight = (newWidth * 9) / 16;

        setSize({
            width: newWidth,
            height: newHeight,
        });
    }, [isResizing, initialResizePos, initialResizeSize]);

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    // Add event listeners
    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleDragMove);
            document.addEventListener('mouseup', handleDragEnd);
            return () => {
                document.removeEventListener('mousemove', handleDragMove);
                document.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDragging, handleDragMove, handleDragEnd]);

    React.useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    // Generate YouTube embed URL - no controls for read-only (learner) mode
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=${isReadOnly ? 0 : 1}`;

    return (
        <div
            ref={popupRef}
            className={`youtube-popup-container ${!isTrainer ? 'learner-readonly' : ''}`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
            }}
            onMouseDown={(e) => {
                // Prevent any clicks on learner video player
                if (!isTrainer && e.target.closest('[id^="yt-"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            onClick={(e) => {
                // Prevent any clicks on learner video player
                if (!isTrainer && e.target.closest('[id^="yt-"]')) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
        >
            {/* Header - Draggable for trainer only */}
            <div
                ref={headerRef}
                className={`youtube-popup-header ${isDragging ? 'dragging' : ''} ${isReadOnly ? 'read-only' : ''}`}
                onMouseDown={!isReadOnly ? handleDragStart : null}
                style={{ cursor: isReadOnly ? 'not-allowed' : 'move' }}
            >
                <div className="youtube-popup-title">
                    {title && title.length > 30 ? `${title.substring(0, 27)}...` : title || 'YouTube Video'}
                    {isReadOnly && <span className="text-xs ml-2 opacity-75">(View Only)</span>}
                </div>
                {!isReadOnly && (
                    <button
                        className="youtube-popup-close"
                        onClick={onClose}
                        aria-label="Close video"
                    >
                        <FaTimes size={16} />
                    </button>
                )}
            </div>

            {/* Video Container - Using YouTube IFrame API for playback sync */}
            <div
                className="youtube-popup-content"
                style={{
                    height: `${size.height}px`,
                    backgroundColor: '#000',
                    position: 'relative',
                    pointerEvents: !isTrainer ? 'none' : 'auto', // Disable clicks for learner
                }}
            >
                <div
                    ref={playerContainerRef}
                    id={uniqueIdRef.current}
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: !isTrainer ? 'none' : 'auto', // Double block for learner
                    }}
                >
                    {!isPlayerReady && (
                        <div style={{ color: '#666', fontSize: '14px' }}>Loading video...</div>
                    )}
                </div>
            </div>

            {/* Resize Handle - Bottom Right Corner - available to both trainer and learner */}
            {!isReadOnly && (
                <div
                    ref={resizeRef}
                    className={`youtube-popup-resize ${isResizing ? 'resizing' : ''}`}
                    onMouseDown={handleResizeStart}
                    title="Drag to resize"
                >
                    <FaEllipsisV size={12} />
                </div>
            )}
        </div>
    );
};

YouTubePopup.propTypes = {
    videoId: PropTypes.string.isRequired,
    title: PropTypes.string,
    popupId: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    initialPosition: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
    }),
    initialSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number,
    }),
    isTrainer: PropTypes.bool,
    isReadOnly: PropTypes.bool, // Learner mode: resize only, no drag/control
    onVideoStateChange: PropTypes.func, // Callback for trainer video state changes
};

export default YouTubePopup;
