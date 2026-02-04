/**
 * sessionUtils.jsx
 * =================
 * Shared utilities and common features for Trainer and Coach session components.
 * Extracts duplicate logic and provides reusable functions for:
 * - Session initialization
 * - WebRTC/Whiteboard setup
 * - Media controls (mic, camera, freeze)
 * - Floating animations (reactions)
 * - Canvas operations (clear, erase)
 * - Stopwatch/timer management
 * - Tool access control
 * - Session cleanup
 */

import React from 'react';
import { toast } from 'react-toastify';
import VideoConferenceService from '../api/services/videoConferenceService';
import WhiteboardService from '../api/services/whiteboardService';
import WhiteboardToolsService from '../api/services/WhiteboardToolsService';
import Emoji from '../components/common/Emoji';

// =============================
// CONSTANTS & CONFIGURATIONS
// =============================

/**
 * WebSocket base URL for services
 */
export const getWSBaseURL = () => {
    return import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
};

/**
 * Common reaction SVG assets used in both Trainer and Coach sessions
 */
export const REACTION_SVG_ASSETS = {
    smiley: {
        type: 'svg',
        src: '/reactions/realistic-pastel-smile.svg',
        alt: 'Realistic Pastel Smile'
    },
    bubble: {
        type: 'svg',
        src: '/reactions/realistic-bubble.svg',
        alt: 'Realistic Soap Bubble'
    },
    balloon: [
        {
            type: 'svg',
            src: '/reactions/02_pastel_mint.svg',
            alt: 'Realistic Pink Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/03_pastel_pink.svg',
            alt: 'Realistic Red Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/04_pastel_lavender.svg',
            alt: 'Realistic Blue Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/05_pastel_peach.svg',
            alt: 'Realistic Green Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/06_pastel_coral.svg',
            alt: 'Realistic Yellow Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/07_pastel_teal.svg',
            alt: 'Realistic Purple Balloon'
        },
        {
            type: 'svg',
            src: '/reactions/08_pastel_yellow.svg',
            alt: 'Realistic Orange Balloon'
        }
    ],
    star: {
        type: 'svg',
        src: '/reactions/realistic-oil-pastel-star.svg',
        alt: 'Realistic Oil Pastel Star'
    }
};

/**
 * Unified whiteboard button styles
 */
export const WB_BUTTON_STYLES = {
    base: 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center',
    active: 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded text-center cursor-pointer session-hover-transition transition-all duration-200 font-semibold flex items-center',
    smallBase: 'bg-white border-2 border-gray-300 text-black hover:bg-gray-100 rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1',
    smallActive: 'bg-white border-2 border-[#DB9D32] text-black shadow-lg rounded-lg px-2 py-1.5 text-[10px] sm:text-xs font-bold flex items-center gap-1'
};

/**
 * Default bucket colors for whiteboard
 */
export const BUCKET_COLORS = [
    { name: 'Brown', hex: '#8B6F47' },
    { name: 'Red', hex: '#ec221a' },
    { name: 'Blue', hex: '#5B7B9F' },
    { name: 'Yellow', hex: '#F4D394' },
    { name: 'Pink', hex: '#E8A8C7' },
    { name: 'Orange', hex: '#E8944C' }
];

// =============================
// SESSION INITIALIZATION
// =============================

/**
 * Validate user session and retrieve user data from localStorage
 * @param {Object} options - Configuration options
 * @param {string} options.requiredRole - Required user role (optional)
 * @param {Function} options.navigate - Navigation function from useNavigate
 * @param {string} options.loginPath - Path to redirect for login (default: '/login')
 * @returns {Object|null} User data object or null if invalid
 */
export const validateUserSession = ({ requiredRole, navigate, loginPath = '/login' }) => {
    const userData = localStorage.getItem('user_data');

    if (!userData) {
        console.error('[SessionUtils] No user data found in localStorage');
        toast.error('Please login first');
        navigate(loginPath);
        return null;
    }

    const user = JSON.parse(userData);

    // Validate required role if specified
    if (requiredRole && user.role !== requiredRole) {
        toast.error(`Unauthorized access - ${requiredRole}s only`);
        navigate('/');
        return null;
    }

    return user;
};

// =============================
// WEBRTC & WHITEBOARD SETUP
// =============================

/**
 * Initialize whiteboard service with common callbacks
 * @param {Object} options - Configuration options
 * @param {string} options.wsBaseUrl - WebSocket base URL
 * @param {string} options.sessionId - Session ID
 * @param {string} options.role - User role (trainer/coach)
 * @param {Function} options.setBuckets - State setter for buckets
 * @param {Function} options.setFloatingAnimations - State setter for floating animations
 * @param {Function} options.setErasePenTrigger - State setter for erase pen trigger
 * @param {Function} options.setRedrawCanvasTrigger - State setter for redraw trigger
 * @returns {Object} Whiteboard service instance
 */
export const initializeWhiteboardService = ({
    wsBaseUrl,
    sessionId,
    role,
    setBuckets,
    setFloatingAnimations,
    setErasePenTrigger,
    setRedrawCanvasTrigger
}) => {
    try {
        console.log(`[SessionUtils] Initializing whiteboard service for ${role}`);
        const wbService = new WhiteboardService(wsBaseUrl, sessionId, role);
        wbService.initialize();

        // Set up callback for bucket added/updated
        if (setBuckets) {
            wbService.onBucketAdded = (data) => {
                console.log(`[SessionUtils] Bucket added:`, data);
                setBuckets(prev => {
                    const exists = prev.find(bucket => bucket.id === data.id);
                    if (!exists) {
                        return [...prev, data];
                    }
                    return prev;
                });
            };

            wbService.onBucketUpdate = (data) => {
                console.log(`[SessionUtils] Bucket updated:`, data);
                if (data.removed) {
                    setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
                } else {
                    setBuckets(prev => prev.map(bucket =>
                        bucket.id === data.id ? { ...bucket, ...data } : bucket
                    ));
                }
            };
        }

        // Set up callback for floating animations (reactions)
        if (setFloatingAnimations) {
            wbService.onFloatingAnimations = (data) => {
                console.log(`[SessionUtils] Floating animations received:`, data);
                setFloatingAnimations(prev => [...prev, ...data.animations]);

                // Auto-remove after 13 seconds
                setTimeout(() => {
                    setFloatingAnimations(prev =>
                        prev.filter(a => !data.animations.find(na => na.id === a.id))
                    );
                }, 13000);
            };
        }

        // Set up callback for erase pen event
        if (setErasePenTrigger && setRedrawCanvasTrigger) {
            wbService.onErasePen = () => {
                console.log(`[SessionUtils] Received erase pen event`);
                setErasePenTrigger(prev => prev + 1);
                setRedrawCanvasTrigger(prev => prev + 1);
            };
        }

        console.log(`[SessionUtils] Whiteboard service initialized for ${role}`);
        return wbService;
    } catch (error) {
        console.error(`[SessionUtils] Error initializing whiteboard:`, error);
        toast.error('Failed to initialize whiteboard');
        return null;
    }
};

/**
 * Initialize video conference service with common callbacks
 * @param {Object} options - Configuration options
 * @param {string} options.wsBaseUrl - WebSocket base URL
 * @param {string} options.sessionId - Session ID
 * @param {string} options.role - User role (trainer/coach)
 * @param {Function} options.setLocalStream - State setter for local stream
 * @param {Function} options.setRemoteStream - State setter for remote stream
 * @param {Function} options.setConnectionStatus - State setter for connection status
 * @param {Object} options.connectedRef - Ref to track connection status
 * @param {Object} options.sessionInfo - Session information object
 * @param {string} options.participantName - Name of remote participant (learner/client)
 * @returns {Object} Video conference service instance
 */
export const initializeVideoConferenceService = async ({
    wsBaseUrl,
    sessionId,
    role,
    setLocalStream,
    setRemoteStream,
    setConnectionStatus,
    connectedRef,
    sessionInfo,
    participantName = 'Participant'
}) => {
    try {
        console.log(`[SessionUtils] Initializing video conference service for ${role}`);
        const videoService = new VideoConferenceService(wsBaseUrl, sessionId, role);

        // Set callback for local stream
        videoService.onLocalStream = (stream) => {
            console.log(`[SessionUtils] Local stream received`);
            setLocalStream(stream);
            setConnectionStatus('Waiting for participant...');
        };

        // Set callback for remote stream
        videoService.onRemoteStream = (stream) => {
            console.log(`[SessionUtils] Remote stream received from ${participantName}`);
            setRemoteStream(stream);
            setConnectionStatus('Connected');

            // Only show toast once when participant first connects
            if (connectedRef && !connectedRef.current) {
                connectedRef.current = true;
                const name = sessionInfo?.learner_name || sessionInfo?.client_name || participantName;
                toast.success(`${name} has joined the session`);
            }
        };

        // Set callback for connection state changes
        videoService.onConnectionStateChange = (state) => {
            console.log(`[SessionUtils] Connection state changed to:`, state);
            const statusMap = {
                'new': 'connecting',
                'connecting': 'connecting',
                'connected': 'connected',
                'disconnected': 'disconnected',
                'failed': 'failed',
                'closed': 'disconnected'
            };
            setConnectionStatus(statusMap[state] || state);

            // Handle participant disconnect
            if ((state === 'disconnected' || state === 'closed') && connectedRef?.current) {
                console.log(`[SessionUtils] ${participantName} disconnected`);
                const name = sessionInfo?.learner_name || sessionInfo?.client_name || participantName;
                toast.info(`${name} has left the session`);
                setRemoteStream(null);
                connectedRef.current = false;
            }
        };

        // Set error callback
        videoService.onError = (error) => {
            console.error(`[SessionUtils] Video conference error:`, error);
            toast.error(`Video error: ${error.message}`);
        };

        // Initialize video conference
        await videoService.initialize();
        console.log(`[SessionUtils] Video conference service initialized for ${role}`);

        return videoService;
    } catch (error) {
        console.error(`[SessionUtils] Video Conference init error:`, error);
        toast.error('Failed to initialize video conference: ' + error.message);
        return null;
    }
};

/**
 * Initialize whiteboard tools service
 * @param {Object} whiteboardService - Whiteboard service instance
 * @returns {Object} Tools service instance
 */
export const initializeToolsService = (whiteboardService) => {
    try {
        console.log('[SessionUtils] Initializing tools service');
        const toolsService = new WhiteboardToolsService(whiteboardService);
        console.log('[SessionUtils] Tools service initialized');
        return toolsService;
    } catch (error) {
        console.error('[SessionUtils] Error initializing tools service:', error);
        return null;
    }
};

// =============================
// MEDIA CONTROLS
// =============================

/**
 * Toggle microphone on/off
 * @param {Object} videoService - Video conference service instance
 * @param {Function} setMicEnabled - State setter for mic enabled
 * @param {Array} additionalServices - Additional video services to sync (e.g., observer)
 * @returns {boolean} New microphone state
 */
export const toggleMicrophone = (videoService, setMicEnabled, additionalServices = []) => {
    if (!videoService) {
        toast.error('Video service not initialized');
        return false;
    }

    const newState = videoService.toggleMicrophone();
    setMicEnabled(newState);

    // Sync with additional services if provided (e.g., observer connection)
    additionalServices.forEach(service => {
        if (service && service.peerConnection) {
            const audioSenders = service.peerConnection.getSenders().filter(s => s.track?.kind === 'audio');
            audioSenders.forEach(sender => {
                if (sender.track) {
                    sender.track.enabled = false; // Keep additional connections muted
                }
            });
        }
    });

    return newState;
};

/**
 * Toggle camera on/off
 * @param {Object} videoService - Video conference service instance
 * @param {Function} setCameraEnabled - State setter for camera enabled
 * @returns {boolean} New camera state
 */
export const toggleCamera = (videoService, setCameraEnabled) => {
    if (!videoService) {
        toast.error('Video service not initialized');
        return false;
    }

    const newState = videoService.toggleCamera();
    setCameraEnabled(newState);
    return newState;
};

/**
 * Toggle freeze mode for participant window
 * @param {boolean} currentFreezeState - Current freeze state
 * @param {Function} setIsFrozen - State setter for freeze state
 * @param {Object} videoService - Video conference service instance
 * @param {string} participantRole - Role of participant to freeze (learner/client)
 * @returns {boolean} New freeze state
 */
export const toggleFreeze = (currentFreezeState, setIsFrozen, videoService, participantRole = 'participant') => {
    const newFreezeState = !currentFreezeState;
    setIsFrozen(newFreezeState);

    if (videoService) {
        const freezeSignal = {
            type: 'freeze',
            frozen: newFreezeState,
            timestamp: new Date().toISOString()
        };

        // Use sendSignal or sendMessage depending on service implementation
        if (typeof videoService.sendSignal === 'function') {
            videoService.sendSignal(freezeSignal);
        } else if (typeof videoService.sendMessage === 'function') {
            videoService.sendMessage(freezeSignal);
        }

        console.log(`[SessionUtils] Freeze signal sent for ${participantRole}:`, freezeSignal);
        toast.info(newFreezeState ? `${participantRole} window frozen` : `${participantRole} window unfrozen`);
    } else {
        console.error(`[SessionUtils] Cannot send freeze signal - Video service not initialized`);
        toast.error('Unable to send freeze signal');
        setIsFrozen(!newFreezeState); // Revert state
    }

    return newFreezeState;
};

// =============================
// CANVAS & DRAWING OPERATIONS
// =============================

/**
 * Clear all canvas items including pen strokes, buckets, text boxes, and animations
 * @param {Object} options - Configuration options
 * @param {Function} options.setCanvasItems - State setter for canvas items
 * @param {Function} options.setBuckets - State setter for buckets
 * @param {Function} options.setTextBoxes - State setter for text boxes (optional)
 * @param {Function} options.setFloatingAnimations - State setter for floating animations
 * @param {Function} options.setErasePenTrigger - State setter for erase pen trigger
 * @param {Function} options.setClearCanvasTrigger - State setter for clear canvas trigger
 * @param {Function} options.setEraseAllActive - State setter for erase all active state
 * @param {Object} options.whiteboardService - Whiteboard service instance
 */
export const clearAllCanvas = ({
    setCanvasItems,
    setBuckets,
    setTextBoxes,
    setFloatingAnimations,
    setErasePenTrigger,
    setClearCanvasTrigger,
    setEraseAllActive,
    whiteboardService
}) => {
    // Clear local state
    setCanvasItems([]);
    setBuckets([]);
    if (setTextBoxes) setTextBoxes([]);
    setFloatingAnimations([]);

    // Trigger local clear and redraw
    setErasePenTrigger(prev => prev + 1);
    setClearCanvasTrigger(prev => prev + 1);
    setEraseAllActive(true);

    // Send clear command to other participants
    if (whiteboardService) {
        whiteboardService.send('clear_canvas', {
            timestamp: Date.now()
        });
    }

    setTimeout(() => setEraseAllActive(false), 300);
    console.log('[SessionUtils] Canvas cleared');
};

/**
 * Add a new bucket to the canvas
 * @param {Array} existingBuckets - Current buckets array
 * @param {Function} setBuckets - State setter for buckets
 * @param {Object} whiteboardService - Whiteboard service instance
 * @param {string} bucketColor - Color of the bucket (default: '#8B6F47')
 * @param {number} canvasWidth - Width of the whiteboard canvas (default: 1200)
 * @param {number} canvasHeight - Height of the whiteboard canvas (default: 600)
 * @returns {Object} New bucket object
 */
export const addBucket = (existingBuckets, setBuckets, whiteboardService, bucketColor = '#8B6F47', canvasWidth = 1200, canvasHeight = 600, canvasRef = null) => {
    const BUCKET_WIDTH = 150;
    const BUCKET_HEIGHT = 150;
    const PADDING = 20;
    const START_X = 20;
    const START_Y = 20;
    const SAFE_MARGIN = 30; // Extra safety margin from edges

    // Calculate position for new bucket
    let newX = START_X;
    let newY = START_Y;

    // Available space accounting for safe margins
    const maxX = canvasWidth - BUCKET_WIDTH - SAFE_MARGIN;
    const maxY = canvasHeight - BUCKET_HEIGHT - SAFE_MARGIN;

    if (existingBuckets.length > 0) {
        // Try to place next to the last bucket
        const lastBucket = existingBuckets[existingBuckets.length - 1];
        const potentialX = lastBucket.x + BUCKET_WIDTH + PADDING;

        // Check if bucket would go outside right boundary
        if (potentialX + BUCKET_WIDTH + SAFE_MARGIN > canvasWidth) {
            // Move to next row
            newX = START_X;
            newY = lastBucket.y + BUCKET_HEIGHT + PADDING;

            // Check if bucket would go outside bottom boundary
            if (newY + BUCKET_HEIGHT + SAFE_MARGIN > canvasHeight) {
                // Try to find space in previous rows
                let foundSpace = false;
                for (let row = 0; row < 10 && !foundSpace; row++) {
                    const testY = START_Y + (row * (BUCKET_HEIGHT + PADDING));
                    if (testY + BUCKET_HEIGHT + SAFE_MARGIN <= canvasHeight) {
                        let testX = START_X;

                        // Check for collisions in this row
                        for (const bucket of existingBuckets) {
                            // If bucket is in this row, place next to it
                            if (Math.abs(bucket.y - testY) < BUCKET_HEIGHT / 2) {
                                const nextPos = bucket.x + BUCKET_WIDTH + PADDING;
                                if (nextPos > testX) {
                                    testX = nextPos;
                                }
                            }
                        }

                        // Check if this position fits within bounds
                        if (testX + BUCKET_WIDTH + SAFE_MARGIN <= canvasWidth) {
                            newX = testX;
                            newY = testY;
                            foundSpace = true;
                        }
                    }
                }

                // If no space found, stack on top
                if (!foundSpace) {
                    newX = START_X;
                    newY = Math.max(START_Y, maxY - BUCKET_HEIGHT - PADDING);
                }
            }
        } else {
            newX = potentialX;
            newY = lastBucket.y;
        }
    }

    // Final bounds check - clamp position to ensure it stays within canvas with safety margin
    newX = Math.max(START_X, Math.min(newX, maxX));
    newY = Math.max(START_Y, Math.min(newY, maxY));

    const newBucket = {
        id: Date.now(),
        x: newX,
        y: newY,
        width: BUCKET_WIDTH,
        height: BUCKET_HEIGHT,
        label: 'Bucket',
        color: bucketColor,
        items: [] // Items inside bucket
    };

    setBuckets(prev => [...prev, newBucket]);

    // Send bucket to other participants (buckets use pixel coordinates, no normalization needed)
    if (whiteboardService) {
        whiteboardService.sendBucketAdded(newBucket);
    }

    // console.log('[SessionUtils] Bucket added:', newBucket);
    return newBucket;
};

// =============================
// FLOATING ANIMATIONS (REACTIONS)
// =============================

/**
 * Generate evenly spaced positions for floating animations
 * @param {number} count - Number of positions to generate
 * @param {number} minPercent - Minimum percentage (default: 5)
 * @param {number} maxPercent - Maximum percentage (default: 95)
 * @returns {Array} Array of position percentages
 */
export const generateSpacedPositions = (count, minPercent = 5, maxPercent = 95) => {
    const positions = [];
    const step = (maxPercent - minPercent) / (count - 1 || 1);
    for (let i = 0; i < count; i++) {
        positions.push(minPercent + i * step);
    }
    return positions;
};

/**
 * Spawn floating animation (bubbles, balloons, smileys, stars)
 * @param {Object} options - Configuration options
 * @param {string} options.type - Animation type (bubble/balloon/smiley/star)
 * @param {Object|Array} options.asset - Asset configuration (single object or array for balloons)
 * @param {Set} options.activeFloatingAnimationTypesRef - Ref to track active animation types
 * @param {Function} options.setFloatingAnimations - State setter for floating animations
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {number} options.count - Number of animations to spawn (default: 10)
 * @returns {Array} Array of spawned animations
 */
export const spawnFloatingAnimation = ({
    type,
    asset,
    activeFloatingAnimationTypesRef,
    setFloatingAnimations,
    whiteboardService,
    count = 10
}) => {
    // Check if this animation type is already active
    if (activeFloatingAnimationTypesRef.has(type)) {
        toast.warn(`${type.charAt(0).toUpperCase() + type.slice(1)}s are already active!`);
        return [];
    }

    activeFloatingAnimationTypesRef.add(type);

    const leftPositions = generateSpacedPositions(count);

    const newAnimations = leftPositions.map((leftPercent, index) => {
        // For balloons, randomly select from the color array
        const selectedAsset = Array.isArray(asset)
            ? asset[Math.floor(Math.random() * asset.length)]
            : asset;

        return {
            id: `${type}-${Date.now()}-${index}`,
            type: type,
            x: leftPercent,
            startDelay: index * 200, // 200ms delay between each animation
            duration: 8000 + Math.random() * 5000, // Random duration between 8-13 seconds in milliseconds
            asset: {
                type: selectedAsset.type,
                src: selectedAsset.src,
                alt: selectedAsset.alt
            },
            popped: false
        };
    });

    setFloatingAnimations(prev => [...prev, ...newAnimations]);

    // Send to other participants
    if (whiteboardService) {
        whiteboardService.sendFloatingAnimations(newAnimations);
    }

    // Auto-cleanup after 13 seconds and remove from active set
    setTimeout(() => {
        setFloatingAnimations(prev =>
            prev.filter(a => !newAnimations.find(na => na.id === a.id))
        );
        activeFloatingAnimationTypesRef.delete(type);
    }, 13000);

    console.log(`[SessionUtils] Spawned ${count} ${type} animations`);
    return newAnimations;
};

// =============================
// TOOL ACCESS CONTROL
// =============================

/**
 * Toggle tool access for participant (learner/client)
 * @param {string} toolName - Tool name (select/drag/keyboard)
 * @param {Object} currentAccess - Current tool access state
 * @param {Function} setToolAccess - State setter for tool access
 * @param {Object} whiteboardService - Whiteboard service instance
 * @param {Function} setTool - State setter for active tool (optional)
 * @returns {Object} Updated tool access state
 */
export const toggleToolAccess = (toolName, currentAccess, setToolAccess, whiteboardService, setTool) => {
    const updated = { ...currentAccess, [toolName]: !currentAccess[toolName] };

    // Auto-enable select permission when drag is activated
    if (toolName === 'drag' && updated.drag) {
        updated.select = true;
    }

    setToolAccess(updated);

    // Send permission update to participant via whiteboard service
    if (whiteboardService) {
        whiteboardService.send('tool_access', {
            toolName,
            enabled: updated[toolName],
            allPermissions: updated
        });

        // If drag is being enabled, also send select permission update
        if (toolName === 'drag' && updated.drag) {
            whiteboardService.send('tool_access', {
                toolName: 'select',
                enabled: true,
                allPermissions: updated
            });
        }
    }

    console.log('[SessionUtils] Tool access updated:', updated);

    // Auto-switch to select tool when drag is enabled
    if (toolName === 'drag' && updated.drag && setTool) {
        setTool('select');
    }

    return updated;
};

// =============================
// SESSION CLEANUP
// =============================

/**
 * Cleanup session resources (WebRTC, Whiteboard, Tools)
 * @param {Object} options - Services to cleanup
 * @param {Object} options.videoService - Primary video conference service
 * @param {Object} options.whiteboardService - Whiteboard service
 * @param {Object} options.toolsService - Tools service
 * @param {Object} options.recordingService - Recording service (optional)
 * @param {Object} options.secondaryVideoService - Secondary video service (optional, e.g., observer)
 * @param {Object} options.isInitializingRef - Ref to track initialization state
 */
export const cleanupSessionResources = ({
    videoService,
    whiteboardService,
    toolsService,
    recordingService,
    secondaryVideoService,
    isInitializingRef
}) => {
    console.log('[SessionUtils] Cleaning up session resources');

    // Stop all local stream tracks
    if (videoService?.localStream) {
        videoService.localStream.getTracks().forEach(track => {
            track.stop();
            console.log('[SessionUtils] Stopped track:', track.kind);
        });
    }

    // Close video service
    if (videoService) {
        videoService.close();
        console.log('[SessionUtils] Video service closed');
    }

    // Close secondary video service (e.g., observer)
    if (secondaryVideoService) {
        secondaryVideoService.close();
        console.log('[SessionUtils] Secondary video service closed');
    }

    // Close whiteboard service
    if (whiteboardService) {
        whiteboardService.close();
        console.log('[SessionUtils] Whiteboard service closed');
    }

    // Cleanup tools service
    if (toolsService) {
        toolsService.cleanup();
        console.log('[SessionUtils] Tools service cleaned up');
    }

    // Cleanup recording service
    if (recordingService) {
        if (typeof recordingService.cleanup === 'function') {
            recordingService.cleanup();
        } else if (typeof recordingService.stopRecording === 'function') {
            recordingService.stopRecording();
        }
        console.log('[SessionUtils] Recording service cleaned up');
    }

    // Reset initialization ref
    if (isInitializingRef) {
        isInitializingRef.current = false;
    }

    console.log('[SessionUtils] Session cleanup complete');
};

// =============================
// STOPWATCH SYNC
// =============================

/**
 * Send stopwatch sync to participant via whiteboard service (throttled)
 * @param {Object} options - Configuration options
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {number} options.elapsedTime - Elapsed time in milliseconds
 * @param {boolean} options.isRunning - Whether stopwatch is running
 * @param {Object} options.lastSyncTimeRef - Ref to track last sync time
 * @param {number} options.throttleMs - Throttle interval in milliseconds (default: 100)
 * @returns {boolean} Whether sync was sent
 */
export const syncStopwatchToParticipant = ({
    whiteboardService,
    elapsedTime,
    isRunning,
    lastSyncTimeRef,
    throttleMs = 100
}) => {
    if (!whiteboardService || elapsedTime < 0) return false;

    // Check if WebSocket is ready before sending
    if (!whiteboardService.ws || whiteboardService.ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    const now = Date.now();
    // Only send if throttle time has passed since last send
    if (now - lastSyncTimeRef.current >= throttleMs) {
        lastSyncTimeRef.current = now;

        // Send stopwatch sync using generic send method
        whiteboardService.send('stopwatch_sync', {
            elapsedTime,
            isRunning
        });

        return true;
    }

    return false;
};

// =============================
// SESSION ENDING
// =============================

/**
 * End session and notify participants
 * @param {Object} options - Configuration options
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {Function} options.sessionServiceEndFn - Session service end function
 * @param {string} options.sessionId - Session ID
 * @param {string} options.notes - Session notes (optional)
 * @param {Function} options.cleanupFn - Cleanup function
 * @param {Function} options.navigate - Navigation function
 * @param {string} options.dashboardPath - Dashboard path to navigate to
 * @param {string} options.roleName - Role name for messages (trainer/coach)
 * @returns {Promise<boolean>} Success status
 */
export const endSession = async ({
    whiteboardService,
    sessionServiceEndFn,
    sessionId,
    notes = '',
    cleanupFn,
    navigate,
    dashboardPath,
    roleName = 'trainer'
}) => {
    if (!window.confirm('Are you sure you want to end this session?')) {
        return false;
    }

    try {
        // Broadcast session end to participants before ending
        if (whiteboardService) {
            whiteboardService.send('session_ended', {
                message: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} has ended the session`,
                timestamp: Date.now()
            });
        }

        // Call session service to end session
        await sessionServiceEndFn(sessionId, notes);

        toast.success('Session ended successfully');

        // Cleanup resources
        if (cleanupFn) {
            cleanupFn();
        }

        // Navigate to dashboard
        navigate(dashboardPath);

        return true;
    } catch (error) {
        console.error('[SessionUtils] Error ending session:', error);
        toast.error('Failed to end session');
        return false;
    }
};

// =============================
// COUNTDOWN TIMER
// =============================

/**
 * Calculate time remaining for session
 * @param {Object} sessionInfo - Session information object
 * @param {string|Date} sessionInfo.started_at - Session start time
 * @param {number} sessionInfo.duration - Session duration in minutes
 * @returns {string} Formatted time remaining (MM:SS) or '--:--' if invalid
 */
export const calculateTimeRemaining = (sessionInfo) => {
    if (!sessionInfo || !sessionInfo.started_at || !sessionInfo.duration) {
        return '--:--';
    }

    // Parse start time
    let startTime;
    if (typeof sessionInfo.started_at === 'string') {
        startTime = new Date(sessionInfo.started_at.replace(' ', 'T')).getTime();
    } else {
        startTime = new Date(sessionInfo.started_at).getTime();
    }

    // Validate parsed time
    if (isNaN(startTime)) {
        console.error('[SessionUtils] Invalid start time:', sessionInfo.started_at);
        return '--:--';
    }

    const durationMs = sessionInfo.duration * 60 * 1000;
    const endTime = startTime + durationMs;
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
        return '00:00';
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

// =============================
// KEYBOARD TRIGGER
// =============================

/**
 * Trigger keyboard tool for participant
 * @param {Object} whiteboardService - Whiteboard service instance
 * @param {string} participantRole - Role of participant (client/learner)
 */
export const triggerParticipantKeyboard = (whiteboardService, participantRole = 'participant') => {
    if (whiteboardService) {
        if (typeof whiteboardService.sendTriggerKeyboard === 'function') {
            whiteboardService.sendTriggerKeyboard();
        } else {
            whiteboardService.send('trigger_keyboard', {
                timestamp: Date.now()
            });
        }
        toast.info(`Keyboard tool sent to ${participantRole}`);
    }
};

// =============================
// AUDIO CONTEXT & SOUND EFFECTS
// =============================

/**
 * Reusable AudioContext instance (singleton pattern)
 */
let audioContextInstance = null;

/**
 * Get or create AudioContext instance
 * @returns {AudioContext} Audio context instance
 */
export const getAudioContext = () => {
    if (!audioContextInstance) {
        audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextInstance;
};

/**
 * Play pop sound effect based on animation type
 * @param {string} animationType - Type of animation (bubble/smiley/balloon/star)
 */
export const playPopSound = (animationType) => {
    try {
        const audioContext = getAudioContext();
        const now = audioContext.currentTime;

        switch (animationType) {
            case 'bubble': {
                // Bubble: Simple "bloop" (1 oscillator)
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(700, now);
                osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.08);
                break;
            }

            case 'smiley': {
                // Smiley: Simple "ding" (1 oscillator)
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1000, now);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            }

            case 'balloon': {
                // Balloon: Quick pop with minimal white noise
                const bufferSize = audioContext.sampleRate * 0.05;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);

                // Generate white noise
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noiseSource = audioContext.createBufferSource();
                noiseSource.buffer = buffer;
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.4, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                noiseSource.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noiseSource.start(now);

                // Single low thump
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.04);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.04);
                break;
            }

            case 'star': {
                // Star: Sparkle sound
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.12);
                break;
            }

            default: {
                // Default pop sound
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.frequency.setValueAtTime(500, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.start(now);
                osc.stop(now + 0.1);
            }
        }
    } catch (error) {
        console.error('[SessionUtils] Error playing pop sound:', error);
    }
};

/**
 * Handle animation pop event
 * @param {Object} options - Configuration options
 * @param {string} options.animationId - ID of animation to pop
 * @param {number} options.poppedLeft - Left position of pop
 * @param {number} options.poppedTop - Top position of pop
 * @param {Array} options.floatingAnimations - Current floating animations array
 * @param {Function} options.setFloatingAnimations - State setter for floating animations
 * @param {Object} options.whiteboardService - Whiteboard service instance
 */
export const handleAnimationPop = ({
    animationId,
    poppedLeft,
    poppedTop,
    floatingAnimations,
    setFloatingAnimations,
    whiteboardService
}) => {
    // Find the animation to get its type for sound effect
    const animation = floatingAnimations.find(a => a.id === animationId);
    if (animation) {
        playPopSound(animation.type);
    }

    setFloatingAnimations(prev =>
        prev.map(a => a.id === animationId ? { ...a, popped: true, poppedLeft, poppedTop } : a)
    );

    // Broadcast the animation pop event to participant
    if (whiteboardService) {
        whiteboardService.send('animation_popped', {
            animationId,
            poppedLeft,
            poppedTop,
            timestamp: Date.now()
        });
    }

    console.log('[SessionUtils] Animation popped:', animationId);
};

// =============================
// PEN/ERASER TOOLS
// =============================

/**
 * Erase all pen strokes from whiteboard (keeps canvas items)
 * @param {Object} options - Configuration options
 * @param {Function} options.setErasePenTrigger - State setter for erase pen trigger
 * @param {Function} options.setRedrawCanvasTrigger - State setter for redraw trigger
 * @param {Object} options.whiteboardService - Whiteboard service instance
 */
export const eraseAllPen = ({
    setErasePenTrigger,
    setRedrawCanvasTrigger,
    whiteboardService
}) => {
    setErasePenTrigger(prev => prev + 1);
    setRedrawCanvasTrigger(prev => prev + 1);

    // Send clear pen command to participant
    if (whiteboardService) {
        whiteboardService.send('erase_pen', {
            timestamp: Date.now()
        });
    }

    console.log('[SessionUtils] Pen strokes erased');
};

// =============================
// FEEDBACK MESSAGES & TOOLS
// =============================

/**
 * Send feedback message to participant via whiteboard
 * @param {Object} options - Configuration options
 * @param {string} options.message - Feedback message to send
 * @param {Function} options.setFeedbackMessage - State setter for feedback message
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {number} options.duration - How long to display (default: 3000ms)
 */
export const sendFeedbackMessage = ({
    message,
    setFeedbackMessage,
    whiteboardService,
    duration = 3000
}) => {
    setFeedbackMessage(message);

    // Send to participant
    if (whiteboardService) {
        whiteboardService.send('feedback_message', {
            text: message,
            timestamp: Date.now()
        });
    }

    // Auto-clear after duration
    setTimeout(() => {
        setFeedbackMessage('');
        if (whiteboardService) {
            whiteboardService.send('feedback_message', {
                text: '',
                timestamp: Date.now()
            });
        }
    }, duration);

    console.log('[SessionUtils] Feedback message sent:', message);
};

/**
 * Send waiting message to participant
 * @param {Object} options - Configuration options
 * @param {string} options.message - Waiting message to send
 * @param {Function} options.setWaitingMessage - State setter for waiting message
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {number} options.duration - How long to display (default: 5000ms)
 */
export const sendWaitingMessage = ({
    message,
    setWaitingMessage,
    whiteboardService,
    duration = 5000
}) => {
    setWaitingMessage(message);

    // Send to participant
    if (whiteboardService) {
        whiteboardService.send('waiting_message', {
            text: message,
            timestamp: Date.now()
        });
    }

    // Auto-clear after duration
    setTimeout(() => {
        setWaitingMessage('');
        if (whiteboardService) {
            whiteboardService.send('waiting_message', {
                text: '',
                timestamp: Date.now()
            });
        }
    }, duration);

    console.log('[SessionUtils] Waiting message sent:', message);
};

/**
 * Handle all session tool clicks (feedback, emojis, animations)
 * @param {Object} options - Configuration options
 * @param {string} options.tool - Tool name/label
 * @param {Function} options.setFeedbackMessage - State setter for feedback message
 * @param {Function} options.setWaitingMessage - State setter for waiting message
 * @param {Function} options.setFloatingAnimations - State setter for floating animations
 * @param {Object} options.whiteboardService - Whiteboard service instance
 * @param {Object} options.REACTION_SVG_ASSETS - Reaction assets object
 */
export const handleToolClick = ({
    tool,
    setFeedbackMessage,
    setWaitingMessage,
    setShowExercise,
    spawnFloatingAnimation,
    toggleLearnerToolAccess,
    whiteboardService,
    REACTION_SVG_ASSETS
}) => {
    console.log('[SessionUtils] Tool clicked:', tool);

    // Map tool names to actions
    switch (tool) {
        // Feedback Messages
        case '👍 Good Job!':
            sendFeedbackMessage({
                message: 'Good Job!',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '🌟 Wow!':
            sendFeedbackMessage({
                message: 'Wow!',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '💪 Doing Well':
            sendFeedbackMessage({
                message: 'Doing Well',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '🙏 Thank You':
            sendFeedbackMessage({
                message: 'Thank You',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '❤️ Loved it':
            sendFeedbackMessage({
                message: 'Loved it',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        case '😌 Relax':
            sendFeedbackMessage({
                message: 'Relax',
                setFeedbackMessage,
                whiteboardService,
                duration: 3000
            });
            break;

        // Waiting Message
        case '⏳ Wait':
            sendWaitingMessage({
                message: 'Please Wait...',
                setWaitingMessage,
                whiteboardService,
                duration: 5000
            });
            break;

        // Floating Animations
        case '🫧 Bubbles':
            spawnFloatingAnimation('bubble', REACTION_SVG_ASSETS.bubble);
            break;

        case '😊 Smileys':
            spawnFloatingAnimation('smiley', REACTION_SVG_ASSETS.smiley);
            break;

        case '🎈 Balloons':
            spawnFloatingAnimation('balloon', REACTION_SVG_ASSETS.balloon);
            break;

        case '⭐ Stars':
            spawnFloatingAnimation('star', REACTION_SVG_ASSETS.star);
            break;

        default:
            console.log('[SessionUtils] Unknown tool:', tool);
    }
};

// =============================
// WHITEBOARD TOOLS COMPONENT
// =============================

/**
 * WhiteboardTools - Reusable whiteboard tools UI component
 * Used by both TrainerSession and CoachSession
 * 
 * @param {Object} props - Component props
 * @param {string} props.tool - Current tool selected (pen/eraser)
 * @param {Function} props.setTool - Set tool function
 * @param {boolean} props.toolActive - Whether tool is active
 * @param {Function} props.setToolActive - Set tool active function
 * @param {boolean} props.eraserActive - Whether eraser is active
 * @param {Function} props.setEraserActive - Set eraser active function
 * @param {Function} props.setEraseAllActive - Set erase all active function
 * @param {Function} props.eraseAllPen - Erase all pen strokes function
 * @param {Function} props.addBucket - Add bucket function
 * @param {string} props.color - Current pen color
 * @param {Function} props.setColor - Set pen color function
 * @param {number} props.lineWidth - Current pen line width
 * @param {Function} props.setLineWidth - Set pen line width function
 * @param {string} props.bucketColor - Current bucket color
 * @param {Function} props.setBucketColor - Set bucket color function
 * @param {Function} props.setCanvasItems - Set canvas items function
 * @param {Function} props.setBuckets - Set buckets function
 * @param {Function} props.setFloatingAnimations - Set floating animations function
 * @param {Function} props.setClearCanvasTrigger - Set clear canvas trigger function
 * @param {Object} props.whiteboardService - Whiteboard service instance
 * @param {Object} props.toolAccess - Tool access control object
 * @param {Function} props.toggleToolAccess - Toggle tool access function
 * @param {boolean} props.showStopwatch - Whether stopwatch is visible
 * @param {Function} props.setShowStopwatch - Set stopwatch visibility function
 * @param {boolean} props.showExercise - Whether exercise is visible
 * @param {Function} props.setShowExercise - Set exercise visibility function
 * @param {Object} props.activeIcons - Active icons state
 * @param {Function} props.handleToolClick - Handle tool click function
 * @param {Object} props.wbBtnBase - Base button style class
 * @param {Object} props.wbBtnActive - Active button style class
 * @param {Object} props.wbSmallBtnBase - Small base button style class
 * @param {Object} props.wbSmallBtnActive - Small active button style class
 * @param {string} props.participantType - Type of participant (learner/client)
 * @param {Object} props.musicOptions - Music options (optional, for trainer only)
 * @param {Function} props.toggleBackgroundMusic - Toggle background music (optional, for trainer only)
 * @param {string} props.selectedMusic - Selected music ID (optional, for trainer only)
 * @param {boolean} props.backgroundMusicPlaying - Whether music is playing (optional, for trainer only)
 * @param {number} props.musicVolume - Music volume (optional, for trainer only)
 * @param {Function} props.handleMusicVolumeChange - Handle music volume change (optional, for trainer only)
 * @param {boolean} props.showSessionNotes - Whether to show session notes (optional, for trainer only)
 * @param {string} props.sessionNotes - Session notes content (optional, for trainer only)
 * @param {Function} props.handleNotesChange - Handle notes change (optional, for trainer only)
 * @param {Function} props.handleClearNotes - Handle clear notes (optional, for trainer only)
 */
export const WhiteboardTools = ({
    tool,
    setTool,
    toolActive,
    setToolActive,
    eraserActive,
    setEraserActive,
    setEraseAllActive,
    eraseAllPen,
    addBucket,
    color,
    setColor,
    lineWidth,
    setLineWidth,
    bucketColor,
    setBucketColor,
    setCanvasItems,
    setBuckets,
    setFloatingAnimations,
    setClearCanvasTrigger,
    whiteboardService,
    toolAccess,
    toggleToolAccess,
    showStopwatch,
    setShowStopwatch,
    showExercise,
    setShowExercise,
    activeIcons,
    handleToolClick,
    wbBtnBase,
    wbBtnActive,
    wbSmallBtnBase,
    wbSmallBtnActive,
    participantType = 'learner', // 'learner' or 'client'
    // Optional music props (for trainer only)
    musicOptions = null,
    toggleBackgroundMusic = null,
    selectedMusic = null,
    backgroundMusicPlaying = false,
    musicVolume = 0.5,
    handleMusicVolumeChange = null,
    // Optional session notes props (for trainer only)
    showSessionNotes = false,
    sessionNotes = '',
    handleNotesChange = null,
    handleClearNotes = null
}) => {
    return (
        <div className="session-whiteboard-tools w-full flex flex-wrap items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
            {/* Drawing tool buttons */}
            <div className="flex" style={{ gap: 'clamp(0.25rem, 0.8vw, 0.5rem)' }}>
                <button
                    onClick={() => {
                        if (tool === 'pen' && toolActive && !eraserActive) {
                            setToolActive(false);
                        } else {
                            setTool('pen');
                            setToolActive(true);
                            setEraserActive(false);
                            setEraseAllActive(false);
                        }
                    }}
                    className={`${tool === 'pen' && toolActive && !eraserActive ? wbBtnActive : wbBtnBase}`}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Pen Tool (Click to activate/deactivate)"
                >
                    <span>✏️</span>
                    <span className="hidden xs:inline">Pen</span>
                </button>
                <button
                    onClick={() => {
                        if (eraserActive) {
                            setEraserActive(false);
                            setToolActive(false);
                        } else {
                            setTool('eraser');
                            setToolActive(true);
                            setEraserActive(true);
                            setEraseAllActive(false);
                        }
                    }}
                    className={`${eraserActive ? wbBtnActive : wbBtnBase}`}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Eraser Tool (Click to activate/deactivate)"
                >
                    <span>🧽</span>
                    <span className="hidden xs:inline">Eraser</span>
                </button>
                <button
                    onClick={() => {
                        eraseAllPen();
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Erase All Pen Strokes"
                >
                    <Emoji emoji="🗑️" size="base" />
                    <span className="hidden sm:inline">Erase All</span>
                </button>
                <button
                    onClick={() => {
                        setCanvasItems([]);
                        setBuckets([]);
                        setFloatingAnimations([]);
                        setClearCanvasTrigger(prev => prev + 1);
                        if (whiteboardService) {
                            whiteboardService.send('clear_canvas', {
                                timestamp: Date.now()
                            });
                        }
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Clear All Canvas Items and Pen Strokes"
                >
                    <Emoji emoji="🗑️" size="base" />
                    <span className="hidden sm:inline">Clear All</span>
                </button>
                <button
                    onClick={() => {
                        addBucket();
                    }}
                    className={wbBtnBase}
                    style={{ padding: 'clamp(0.375rem, 1.5vw, 0.625rem) clamp(0.5rem, 2vw, 1rem)', fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)', gap: 'clamp(0.125rem, 0.5vw, 0.25rem)' }}
                    title="Add Bucket"
                >
                    <Emoji emoji="🪣" size="base" />
                    <span className="hidden xs:inline">Bucket</span>
                </button>
            </div>

            {/* Color and Size Controls */}
            <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 1vw, 0.5rem)' }}>
                <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                    <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Pen Color:</label>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        disabled={tool === 'eraser'}
                        className="rounded cursor-pointer border border-gray-300"
                        style={{ width: 'clamp(1.25rem, 3vw, 1.75rem)', height: 'clamp(1.25rem, 3vw, 1.75rem)' }}
                        title="Pen Color"
                    />
                    <div className="flex items-center" style={{ gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                        <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                            <label className="font-semibold text-slate-700 hidden md:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Pen Size:</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={lineWidth}
                                onChange={(e) => setLineWidth(parseInt(e.target.value))}
                                className="brush-size-slider"
                                title="Pen Size"
                                aria-label="Pen size slider"
                                style={{
                                    width: 'clamp(5rem, 12vw, 10rem)',
                                    ['--pct']: `${Math.round(((lineWidth - 1) / (10 - 1)) * 100)}%`
                                }}
                            />
                        </div>
                        <div className="flex items-center" style={{ gap: 'clamp(0.25rem, 1vw, 0.75rem)' }}>
                            <div
                                className="brush-preview"
                                title="Brush preview"
                                style={{
                                    width: `${Math.max(6, lineWidth * 3)}px`,
                                    height: `${Math.max(6, lineWidth * 3)}px`,
                                    background: tool === 'eraser' ? 'transparent' : color,
                                    border: tool === 'eraser' ? '2px solid red' : '1px solid rgba(0,0,0,0.6)',
                                    borderRadius: tool === 'eraser' ? '4px' : '9999px'
                                }}
                            />
                            <div className="text-slate-600" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>{lineWidth}</div>
                        </div>
                    </div>
                </div>

                {/* Bucket Color Selector */}
                <div className="flex items-center flex-wrap" style={{ gap: 'clamp(0.25rem, 0.5vw, 0.5rem)' }}>
                    <label className="font-semibold text-slate-700 hidden sm:inline" style={{ fontSize: 'clamp(0.625rem, 1.8vw, 0.875rem)' }}>Bucket Color:</label>
                    <div className="flex flex-wrap gap-1" style={{ gap: 'clamp(0.125rem, 0.3vw, 0.25rem)' }}>
                        {BUCKET_COLORS.map((bc) => (
                            <button
                                key={bc.hex}
                                onClick={() => setBucketColor(bc.hex)}
                                className="rounded border-2 transition-all"
                                style={{
                                    backgroundColor: bc.hex,
                                    width: 'clamp(1.25rem, 3vw, 1.75rem)',
                                    height: 'clamp(1.25rem, 3vw, 1.75rem)',
                                    borderColor: bucketColor === bc.hex ? '#000000' : '#ccc',
                                    borderWidth: bucketColor === bc.hex ? '3px' : '2px',
                                    cursor: 'pointer'
                                }}
                                title={`Bucket Color: ${bc.name}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* All tools group - participant access + interactive buttons */}
            <div className="all-tools-group w-full">
                <div className="session-tools-section w-full flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-3 pb-2 sm:pb-3">
                    {/* Select Tool Toggle */}
                    <button
                        onClick={() => toggleToolAccess('select')}
                        className={`${toolAccess.select ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title={toolAccess.select ? 'Click to disable Select' : 'Click to enable Select'}
                    >
                        <span>✋</span>
                        <span>Select</span>
                    </button>

                    {/* Drag Tool Toggle */}
                    <button
                        onClick={() => toggleToolAccess('drag')}
                        className={`${toolAccess.drag ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title={toolAccess.drag ? 'Click to disable Drag' : 'Click to enable Drag'}
                    >
                        <span>↔️</span>
                        <span>Drag</span>
                    </button>

                    {/* Exercise Tool Button */}
                    <button
                        onClick={() => setShowExercise(!showExercise)}
                        className={`${showExercise ? wbSmallBtnActive : wbSmallBtnBase}`}
                        title="Open Exercise Tool - Create Q&A exercises with keyword validation"
                    >
                        <span>💡</span>
                        <span>Q & A</span>
                    </button>

                    {/* Background Music Control - Only for Trainer */}
                    {musicOptions && toggleBackgroundMusic && (
                        <div className="flex gap-1 flex-wrap items-center">
                            {musicOptions.map((music) => (
                                <button
                                    key={music.id}
                                    onClick={() => toggleBackgroundMusic(music.id)}
                                    className={`${selectedMusic === music.id && backgroundMusicPlaying
                                        ? wbSmallBtnActive
                                        : wbSmallBtnBase
                                        }`}
                                    title={`${selectedMusic === music.id && backgroundMusicPlaying
                                        ? `Playing ${music.name} - Click to stop`
                                        : `Click to play ${music.name}`
                                        }`}
                                >
                                    <span>{music.name}</span>
                                </button>
                            ))}

                            {/* Volume Slider */}
                            {backgroundMusicPlaying && handleMusicVolumeChange && (
                                <div className="flex items-center gap-2 px-2 py-1 bg-white border-2 border-gray-300 rounded-lg">
                                    <span className="text-xs font-semibold text-gray-700">🔊</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={musicVolume * 100}
                                        onChange={(e) => handleMusicVolumeChange(e.target.value / 100)}
                                        className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        title={`Volume: ${Math.round(musicVolume * 100)}%`}
                                    />
                                    <span className="text-xs font-semibold text-gray-700">{Math.round(musicVolume * 100)}%</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stopwatch Tool Button */}
                    <button
                        onClick={() => setShowStopwatch(prev => !prev)}
                        className={`${showStopwatch ? wbSmallBtnActive : wbSmallBtnBase}`}
                        aria-expanded={showStopwatch}
                        aria-controls="stopwatch-panel"
                        title="Toggle stopwatch panel"
                    >
                        <Emoji emoji="⏲️" size="base" />
                        <span className="hidden sm:inline">Stopwatch</span>
                    </button>

                    {[
                        { label: 'Good Job!', icon: '👍' },
                        { label: 'Wow!', icon: '🌟' },
                        { label: 'Doing Well', icon: '💪' },
                        { label: 'Thank You', icon: '🙏' },
                        { label: 'Loved it', icon: '❤️' },
                        { label: 'Relax', icon: '😌' },
                        { label: 'Bubbles', icon: '🫧' },
                        { label: 'Smileys', icon: '😊' },
                        { label: 'Balloons', icon: '🎈' },
                        { label: 'Stars', icon: '⭐' },
                        { label: 'Wait', icon: '⏳' }
                    ].map((t, i) => (
                        <button
                            key={i}
                            onClick={() => handleToolClick(`${t.icon} ${t.label}`)}
                            className={`${activeIcons[t.label] ? wbBtnActive : wbBtnBase} px-1.5 sm:px-2 py-1.5 sm:py-2 rounded text-[9px] sm:text-[10px] text-center session-hover-transition transition-all duration-200 font-semibold flex items-center gap-0.5 sm:gap-1`}
                            title={t.label}
                        >
                            <Emoji emoji={t.icon} size="base" className="inline-block" />
                            <span className="hidden sm:inline">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Session Notes - Only for Trainer */}
            {showSessionNotes && handleNotesChange && handleClearNotes && (
                <div className="session-notes-section border-2 border-gray-300 my-2 sm:my-4 rounded bg-gray-50 w-full" style={{ padding: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-semibold text-slate-800" style={{ fontSize: 'clamp(0.75rem, 1.8vw, 1rem)' }}>📝 Session Notes</div>
                        <button
                            onClick={handleClearNotes}
                            className="session-interactive-buttons bg-red-500 hover:bg-red-600 text-white rounded font-semibold transition-colors"
                            style={{ padding: 'clamp(0.25rem, 0.8vw, 0.375rem) clamp(0.5rem, 1.2vw, 0.75rem)', fontSize: 'clamp(0.5rem, 1.2vw, 0.625rem)' }}
                            title="Clear all notes"
                        >
                            <span className="hidden sm:inline">Clear</span>
                        </button>
                    </div>
                    <textarea
                        className="w-full rounded mt-1 text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#DB9D32]"
                        style={{ padding: 'clamp(0.375rem, 1vw, 0.625rem)', fontSize: 'clamp(0.625rem, 1.4vw, 0.875rem)', minHeight: 'clamp(60px, 15vw, 80px)' }}
                        value={sessionNotes}
                        onChange={handleNotesChange}
                        placeholder="Write session notes here..."
                    />
                </div>
            )}
        </div>
    );
};

// =============================
// EXPORT ALL UTILITIES
// =============================

export default {
    // Constants
    getWSBaseURL,
    REACTION_SVG_ASSETS,
    WB_BUTTON_STYLES,
    BUCKET_COLORS,

    // Session
    validateUserSession,

    // Services
    initializeWhiteboardService,
    initializeVideoConferenceService,
    initializeToolsService,

    // Media Controls
    toggleMicrophone,
    toggleCamera,
    toggleFreeze,

    // Canvas
    clearAllCanvas,
    addBucket,
    eraseAllPen,

    // Animations
    generateSpacedPositions,
    spawnFloatingAnimation,
    handleAnimationPop,

    // Audio
    getAudioContext,
    playPopSound,

    // Tools
    toggleToolAccess,
    handleToolClick,
    sendFeedbackMessage,
    sendWaitingMessage,

    // Components
    WhiteboardTools,

    // Session Management
    cleanupSessionResources,
    endSession
};