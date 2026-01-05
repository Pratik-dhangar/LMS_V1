import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Emoji from './Emoji';
import '../../styles/components/common/Whiteboard.css';
import appleImage from '../../assets/Red_Apple.jpg';
import bananaImage from '../../assets/banana.jpeg';
import MediaPopup from './MediaPopup';
import { useMediaControl } from '../../context/MediaControlContext';
// Fill-in-the-blanks removed

// Memoized Video Overlay Component
const VideoOverlay = React.memo(({
    item,
    isSelectedByTrainer,
    isSelectedByLearner,
    isSelectedByRemoteLearner,
    isDragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onClick,
    onDoubleClick
}) => (
    <div
        key={`video-${item.id}`}
        className="absolute"
        style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            zIndex: 20,
            border: isSelectedByTrainer || isSelectedByLearner || isSelectedByRemoteLearner
                ? `3px solid ${isSelectedByRemoteLearner ? '#4caf50' : isSelectedByTrainer ? '#007bff' : '#4caf50'}`
                : 'none',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: 'pointer',
            position: 'absolute',
            transition: isDragging ? 'left 0.08s ease-out, top 0.08s ease-out' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.2s ease-out, height 0.2s ease-out, border 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            willChange: isDragging ? 'left, top' : 'auto'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        title="Click to watch video in popup"
    >
        {/* Video Thumbnail - NO PLAYBACK */}
        <video
            ref={(el) => {
                if (el) {
                    el.pause();
                    el.muted = true;
                }
            }}
            src={item.src}
            preload="metadata"
            crossOrigin="anonymous"
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000',
                pointerEvents: 'none'
            }}
            onLoadedMetadata={(e) => {
                const video = e.target;
                video.pause();
            }}
            onPlay={(e) => {
                e.target.pause();
            }}
            controls={false}
        />

        {/* Play Overlay Icon */}
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}
        >
            <span style={{ fontSize: '30px' }}>▶️</span>
        </div>

        {/* Video Title */}
        <div
            style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '8px',
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
            }}
        >
            {item.src?.split('/').pop() || 'Video'}
        </div>
    </div>
));

VideoOverlay.propTypes = {
    item: PropTypes.object.isRequired,
    isSelectedByTrainer: PropTypes.bool,
    isSelectedByLearner: PropTypes.bool,
    isSelectedByRemoteLearner: PropTypes.bool,
    isDragging: PropTypes.bool,
    onMouseDown: PropTypes.func,
    onMouseMove: PropTypes.func,
    onMouseUp: PropTypes.func,
    onClick: PropTypes.func,
    onDoubleClick: PropTypes.func
};

// Memoized PDF Overlay Component
const PDFOverlay = React.memo(({
    item,
    isSelectedByTrainer,
    isSelectedByLearner,
    isSelectedByRemoteLearner,
    isDragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    selectionStyle = {}
}) => (
    <div
        key={`pdf-${item.id}`}
        className="absolute group"
        style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            zIndex: 20,
            border: 'none',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: '#f5f5f5',
            position: 'absolute',
            transition: isDragging ? 'left 0.08s ease-out, top 0.08s ease-out' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.2s ease-out, height 0.2s ease-out, transform 0.2s ease, box-shadow 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            willChange: isDragging ? 'left, top' : 'auto',
            ...selectionStyle
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        {/* PDF Icon and Label */}
        <div className="pdf-overlay-content">
            <div className="pdf-icon">📄</div>
            <div className="pdf-filename">
                {item.src ? item.src.split('/').pop() : 'PDF Document'}
            </div>
            <div className="pdf-hint">Double-click to open</div>
        </div>

        {/* Selection Indicators */}
        {isSelectedByRemoteLearner && (
            <div className="selection-indicator">
                👤 Learner
            </div>
        )}
        {isSelectedByLearner && (
            <div className="selection-indicator">
                ✓ Selected
            </div>
        )}
    </div>
));

PDFOverlay.propTypes = {
    item: PropTypes.object.isRequired,
    isSelectedByTrainer: PropTypes.bool,
    isSelectedByLearner: PropTypes.bool,
    isSelectedByRemoteLearner: PropTypes.bool,
    isDragging: PropTypes.bool,
    onMouseDown: PropTypes.func,
    onMouseMove: PropTypes.func,
    onMouseUp: PropTypes.func,
    onDoubleClick: PropTypes.func,
    onTouchStart: PropTypes.func,
    onTouchMove: PropTypes.func,
    onTouchEnd: PropTypes.func,
    selectionStyle: PropTypes.object
};

// Memoized Image Overlay Component - for images that can be dragged to sidebar
const ImageOverlay = React.memo(({
    item,
    isSelectedByTrainer,
    isSelectedByLearner,
    isSelectedByRemoteLearner,
    isAnimating,
    isDragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onDragStart,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    selectionStyle = {}
}) => (
    <div
        key={`image-${item.id}`}
        className={`absolute group ${isAnimating ? 'bucket-drop-animation' : ''}`}
        draggable={isSelectedByTrainer}
        onDragStart={onDragStart}
        onDragEnd={(e) => {
            e.preventDefault();
        }}
        style={{
            left: `${item.x}px`,
            top: `${item.y}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            zIndex: 20,
            border: '2px solid #ccc',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: isSelectedByTrainer || isSelectedByLearner ? 'move' : 'pointer',
            backgroundColor: '#f5f5f5',
            position: 'absolute',
            userSelect: 'none',
            transition: isDragging ? 'left 0.08s ease-out, top 0.08s ease-out' : 'left 0.15s ease-out, top 0.15s ease-out, width 0.2s ease-out, height 0.2s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            willChange: isDragging ? 'left, top' : 'auto',
            ...selectionStyle
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        {/* Image Content */}
        <img
            src={item.src}
            alt={item.title || 'Image'}
            crossOrigin="anonymous"
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none',
                userSelect: 'none'
            }}
            onError={(e) => {
                // console.error('[Whiteboard] Failed to load image:', item.src);
                e.target.style.display = 'none';
            }}
            draggable={false}
        />

        {/* Selection Indicators */}
        {isSelectedByRemoteLearner && (
            <div className="selection-indicator">
                👤 Learner
            </div>
        )}
        {isSelectedByLearner && (
            <div className="selection-indicator">
                ✓ Selected
            </div>
        )}
    </div>
));

ImageOverlay.propTypes = {
    item: PropTypes.object.isRequired,
    isSelectedByTrainer: PropTypes.bool,
    isSelectedByLearner: PropTypes.bool,
    isSelectedByRemoteLearner: PropTypes.bool,
    isAnimating: PropTypes.bool,
    isDragging: PropTypes.bool,
    onMouseDown: PropTypes.func,
    onMouseMove: PropTypes.func,
    onMouseUp: PropTypes.func,
    onDoubleClick: PropTypes.func,
    onDragStart: PropTypes.func,
    onTouchStart: PropTypes.func,
    onTouchMove: PropTypes.func,
    onTouchEnd: PropTypes.func,
    selectionStyle: PropTypes.object
};

// Helper function to lighten a hex color
// const lightenColor = (color, percent = 30) => {
//     const usePound = color[0] === "#";
//     const col = usePound ? color.slice(1) : color;
//     const num = parseInt(col, 16);
//     const amt = Math.round(2.55 * percent);
//     const R = Math.min(255, (num >> 16) + amt);
//     const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
//     const B = Math.min(255, (num & 0x0000FF) + amt);
//     return (usePound ? "#" : "") + (0x1000000 + (R < 256 ? R < 0 ? 0 : R : 255) * 0x10000 +
//         (G < 256 ? G < 0 ? 0 : G : 255) * 0x100 +
//         (B < 256 ? B < 0 ? 0 : B : 255))
//         .toString(16)
//         .slice(1);
// };

const Whiteboard = ({
    whiteboardService,
    isTrainer,
    canvasItems = [],
    setCanvasItems,
    toolAccess = { select: false, drag: false },
    learnerSelectedItemIds = [],
    textMessages = [],
    setTextMessages = () => { },
    feedbackMessage = '',
    waitingMessage = '',
    floatingAnimations = [],
    onAnimationPop = () => { },
    tool = 'pen',
    // setTool = () => { },
    color = '#000000',
    // setColor = () => { },
    lineWidth = 2,
    // setLineWidth = () => { },
    bucketColor = '#9333ea',
    // setBucketColor = () => { },
    buckets = [],
    setBuckets = () => { },
    isPaused = false,
    isFrozen = false,
    // keyboardMode = false,
    // keyboardText = '',
    // setKeyboardText = () => { },
    // keyboardPosition = { x: 0, y: 0 },
    // setKeyboardPosition = () => { },
    clearCanvasTrigger = 0,
    erasePenTrigger = 0,
    redrawCanvasTrigger = 0,
    stopwatchFormattedTime = null,
    stopwatchIsRunning = false,
    toolActive = false,
    textBoxes = [],
    onTextBoxChange = () => { },
    onTextBoxResize = () => { },
    onTextBoxMove = () => { },
    onRemoveTextBox = () => { },
    activeTextBoxId = null,
    setActiveTextBoxId = () => { }
}) => {
    // Media control state management
    const mediaControl = useMediaControl();

    // Debug log for feedback message
    useEffect(() => {
        if (feedbackMessage) {
            // console.log('[Whiteboard] Feedback message received:', feedbackMessage);
        }
    }, [feedbackMessage]);

    // Check if item is a video
    const isVideoItem = useCallback((item) => {
        if (!item.src) return false;
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv'];
        return videoExtensions.some(ext => item.src.toLowerCase().includes(ext)) ||
            item.type === 'video' ||
            item.src.includes('video');
    }, []);

    // Check if item is a PDF
    const isPdfItem = useCallback((item) => {
        if (!item.src) return false;
        return item.src.toLowerCase().includes('.pdf') || item.type === 'pdf';
    }, []);

    const hasActiveFloatingAnimation = useCallback((type) => {
        return floatingAnimations.some(animation => animation.type === type && !animation.popped);
    }, [floatingAnimations]);

    // Handle opening media (video/PDF)
    const handleMediaOpen = useCallback((item) => {
        if (isVideoItem(item) || isPdfItem(item)) {
            const mediaType = isVideoItem(item) ? 'video' : 'pdf';
            const mediaUrl = item.src;
            const mediaId = item.id;

            // console.log('[Whiteboard] Opening media:', { mediaId, mediaType, mediaUrl });

            // Open media popup through MediaControlContext
            mediaControl.openMedia(mediaId, mediaType, mediaUrl);
        }
    }, [isVideoItem, isPdfItem, mediaControl]);

    const canvasRef = useRef(null);
    const prevPosRef = useRef({ x: 0, y: 0 });
    // const animationFrameRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    // const [searchTerm, setSearchTerm] = useState('');
    // const [canvasItems, setCanvasItems] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [isDraggingItem, setIsDraggingItem] = useState(false);
    const [isResizingItem, setIsResizingItem] = useState(false);
    const [resizingVideo, setResizingVideo] = useState(null); // For video/item resizing
    const [selectedItems, setSelectedItems] = useState([]); // Array for multiple selection
    const [editingBucketId, setEditingBucketId] = useState(null);
    const [editingBucketLabel, setEditingBucketLabel] = useState('');
    const [animatingItemId, setAnimatingItemId] = useState(null); // For drop animation
    const [isDragOverCanvas, setIsDragOverCanvas] = useState(false); // For visual feedback during drag over

    // Performance optimization refs for 60fps
    const rafIdRef = useRef(null);
    const lastNetworkUpdateRef = useRef(0);
    const dragOffsetRef = useRef({ x: 0, y: 0 }); // Store click offset within dragged item
    const dragStateUpdateTimeRef = useRef(0); // For throttling state updates during drag

    // Touch drag-back state
    const [touchDragBackActive, setTouchDragBackActive] = useState(false);
    const touchDragGhostRef = useRef(null);
    const touchDragItemRef = useRef(null);
    const touchStartPosRef = useRef({ x: 0, y: 0 });

    // Advanced touch features
    const [multiTouchActive, setMultiTouchActive] = useState(false);
    const [pinchToResizeActive, setPinchToResizeActive] = useState(false);
    const [showGestureHints, setShowGestureHints] = useState(false);
    const pinchStartDistanceRef = useRef(0);
    const pinchStartSizeRef = useRef({ width: 0, height: 0 });

    // Gesture hints for first-time users
    useEffect(() => {
        const hasSeenHints = localStorage.getItem('whiteboard_gesture_hints_seen');
        if (!hasSeenHints && isTrainer) {
            setShowGestureHints(true);
            setTimeout(() => {
                setShowGestureHints(false);
                localStorage.setItem('whiteboard_gesture_hints_seen', 'true');
            }, 8000); // Show for 8 seconds
        }
    }, [isTrainer]);

    const getSelectionStyles = (isSelectedByTrainer, isSelectedByLearner, isSelectedByRemoteLearner) => {
        if (!isSelectedByLearner && !isSelectedByRemoteLearner) {
            return {};
        }

        let selectionColor = null;
        let gradientAccent = null;
        if (isSelectedByRemoteLearner) {
            selectionColor = 'var(--color-baby-rose, #ff86c1)';
            gradientAccent = 'rgba(255, 164, 199, 0.65)';
        } else if (isSelectedByLearner) {
            selectionColor = 'var(--color-baby-blue, #7ae7ff)';
            gradientAccent = 'rgba(122, 231, 255, 0.65)';
        }

        if (!selectionColor) return {};

        return {
            border: '3px solid transparent',
            borderImage: `linear-gradient(135deg, ${selectionColor} 0%, ${gradientAccent || selectionColor} 60%, #ffffff 100%)`,
            borderImageSlice: 1,
            boxShadow: `0 0 25px ${selectionColor}, 0 15px 30px ${gradientAccent || selectionColor}`,
            animation: 'selectionPulse 1.5s ease-in-out infinite'
        };
    };

    // Inline video state for 50-50 split mode
    const [inlineVideo, setInlineVideo] = useState(null); // { id, src, title }
    const inlineVideoRef = useRef(null);

    // Image caching system for performance
    const imageCacheRef = useRef(new Map());
    // const [imageLoadQueue, setImageLoadQueue] = useState(new Set());

    // const [materialsList, setMaterialsList] = useState([]);

    // const appleImage = require('../../assets/red_apple.jpeg');
    // const bananaImage = require('../../assets/banana.jpg');


    const _availableItems = [
        { id: 'apple', name: 'Apple', src: appleImage },
        { id: 'banana', name: 'Banana', src: bananaImage },
        // { id: 'circle', name: 'Circle', src: null, shape: 'circle' },
        // { id: 'square', name: 'Square', src: null, shape: 'square' },
    ];

    // const filteredItems = availableItems.filter(item =>
    //     item.name.toLowerCase().includes(searchTerm.toLowerCase())
    // );

    // Generate custom cursor based on tool and lineWidth
    const generateCursor = useCallback((tool, lineWidth) => {
        try {
            // Scale cursor size so it's always visible (browsers may clamp the image size)
            const base = Math.max(12, Math.round(lineWidth * 3));
            const center = Math.round(base / 2);

            if (tool === 'pen') {
                const radius = Math.max(2, Math.round(lineWidth));
                const stroke = Math.max(1, Math.round(lineWidth / 2));
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${base}' height='${base}' viewBox='0 0 ${base} ${base}'><circle cx='${center}' cy='${center}' r='${radius}' fill='rgba(0,0,0,0.0)' stroke='rgba(0,0,0,0.85)' stroke-width='${stroke}' opacity='0.95'/></svg>`;
                const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
                return `url("${url}") ${center} ${center}, crosshair`;
            }

            if (tool === 'eraser') {
                // Draw a visible square for the eraser with a red stroke
                const pad = Math.max(2, Math.round(lineWidth / 2));
                const size = Math.max(10, Math.round(lineWidth * 3));
                const inner = Math.max(4, size - pad * 2);
                const stroke = Math.max(1, Math.round(lineWidth / 2));
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><rect x='${pad}' y='${pad}' width='${inner}' height='${inner}' rx='2' fill='rgba(255,255,255,0.0)' stroke='rgba(220,38,38,0.95)' stroke-width='${stroke}'/></svg>`;
                const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
                return `url("${url}") ${Math.round(size / 2)} ${Math.round(size / 2)}, auto`;
            }

            return 'default';
        } catch {
            // btoa/encodeURIComponent can throw in certain environments - fall back gracefully
            return 'default';
        }
    }, []);

    // Update cursor when tool or lineWidth changes
    useEffect(() => {
        if (canvasRef.current) {
            canvasRef.current.style.cursor = generateCursor(tool, lineWidth);
        }
    }, [tool, lineWidth, generateCursor]);

    // Image caching functions
    const loadImageToCache = useCallback((src) => {
        return new Promise((resolve, reject) => {
            if (imageCacheRef.current.has(src)) {
                resolve(imageCacheRef.current.get(src));
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                imageCacheRef.current.set(src, img);
                resolve(img);
            };

            img.onerror = (err) => {
                // console.error('[Whiteboard] Failed to load image:', src, err);
                reject(err);
            };

            img.src = src;
        });
    }, []);

    const preloadImages = useCallback(async (items) => {
        const imagePromises = items
            .filter(item => item.src && !imageCacheRef.current.has(item.src) && !isVideoItem(item))
            .map(item => loadImageToCache(item.src));

        if (imagePromises.length > 0) {
            try {
                await Promise.all(imagePromises);
                // console.log('[Whiteboard] Preloaded images:', imagePromises.length);
            } catch {
                // console.warn('[Whiteboard] Some images failed to preload');
            }
        }
    }, [loadImageToCache, isVideoItem]);

    // Handle touch-based drop from learning content sidebar
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !isTrainer) return;

        const handleTouchDrop = (e) => {
            const { content, x, y } = e.detail;

            if (!content) return;

            // Construct full URL properly
            let fullUrl = content.file_url;
            let fileUrl = fullUrl;

            if (!fullUrl.startsWith('http') && !fullUrl.startsWith('s3://')) {
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://43.204.218.16:8000/api';
                const backendUrl = apiBaseUrl.replace('/api', '');
                fullUrl = `${backendUrl}${fullUrl}`;
                fileUrl = fullUrl;
            }

            // Check if it's a video
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv'];
            const isVideo = videoExtensions.some(ext => fullUrl.toLowerCase().includes(ext)) ||
                content.content_type === 'video';

            if (isVideo) {
                const videoData = {
                    id: Date.now(),
                    src: fullUrl
                };

                // console.log('[Whiteboard] Activating inline video split mode (touch):', videoData);
                setInlineVideo({ id: videoData.id, src: videoData.src });

                whiteboardService?.sendMediaControl({
                    action: 'open',
                    videoId: videoData.id,
                    src: videoData.src
                });
                return;
            }

            // For non-video items, add to canvas
            const newItem = {
                id: Date.now(),
                src: content.thumbnail_url ? `${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://43.204.218.16:8000'}${content.thumbnail_url}` : fullUrl,
                x: x - 50,
                y: y - 50,
                width: 100,
                height: 100,
                title: content.title,
                type: content.content_type,
                fileUrl: fileUrl,
                thumbnail: content.thumbnail_url,
                originalFilename: content.original_filename || content.title || 'image',
                mimeType: content.mime_type || 'image/jpeg'
            };

            setCanvasItems(prev => [...prev, newItem]);

            whiteboardService?.sendImage({
                id: newItem.id,
                src: newItem.src,
                x: newItem.x,
                y: newItem.y,
                width: newItem.width,
                height: newItem.height,
                title: newItem.title,
                type: newItem.type,
                fileUrl: newItem.fileUrl,
                thumbnail: newItem.thumbnail,
                originalFilename: newItem.originalFilename,
                mimeType: newItem.mimeType
            });
        };

        canvas.addEventListener('touchDrop', handleTouchDrop);
        return () => canvas.removeEventListener('touchDrop', handleTouchDrop);
    }, [isTrainer, whiteboardService, setCanvasItems, setInlineVideo]);

    // Pinch-to-resize gesture handler
    const handlePinchResize = useCallback((e, item) => {
        if (!isTrainer || e.touches.length !== 2) return;

        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        if (!pinchToResizeActive) {
            // Start pinch
            setPinchToResizeActive(true);
            pinchStartDistanceRef.current = distance;
            pinchStartSizeRef.current = { width: item.width, height: item.height };
        } else {
            // Continue pinch - resize
            const scale = distance / pinchStartDistanceRef.current;
            const newWidth = Math.max(40, pinchStartSizeRef.current.width * scale);
            const newHeight = Math.max(40, pinchStartSizeRef.current.height * scale);

            setCanvasItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, width: newWidth, height: newHeight } : i
            ));

            // Throttled network update
            const now = Date.now();
            if (now - lastNetworkUpdateRef.current > 50) {
                whiteboardService?.sendItemUpdate({
                    id: item.id,
                    width: newWidth,
                    height: newHeight
                });
                lastNetworkUpdateRef.current = now;
            }
        }
    }, [isTrainer, pinchToResizeActive, whiteboardService, setCanvasItems]);

    const handlePinchEnd = useCallback(() => {
        if (pinchToResizeActive) {
            setPinchToResizeActive(false);
        }
    }, [pinchToResizeActive]);

    // Handle touch drag-back (whiteboard items to sidebar)
    const handleItemTouchStart = useCallback((e, item) => {
        if (!isTrainer) return;

        // Check for pinch gesture (2 fingers)
        if (e.touches.length === 2) {
            handlePinchResize(e, item);
            return;
        }

        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        touchDragItemRef.current = item;

        // Long-press indication
        e.currentTarget.style.opacity = '0.7';
    }, [isTrainer, handlePinchResize]);

    const handleItemTouchMove = useCallback((e, item) => {
        if (!isTrainer || !touchDragItemRef.current) return;

        // Handle pinch gesture
        if (e.touches.length === 2) {
            handlePinchResize(e, item);
            return;
        }

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

        // Activate drag mode after 15px movement
        if ((deltaX > 15 || deltaY > 15) && !touchDragBackActive) {
            setTouchDragBackActive(true);
            e.currentTarget.style.opacity = '0.3';

            // Create ghost element
            if (!touchDragGhostRef.current) {
                const ghost = document.createElement('div');
                ghost.id = 'touch-drag-back-ghost';
                ghost.style.position = 'fixed';
                ghost.style.pointerEvents = 'none';
                ghost.style.zIndex = '10000';
                ghost.style.opacity = '0.7';
                ghost.style.transform = 'scale(0.8)';
                ghost.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
                ghost.style.border = '3px dashed #3b82f6';
                ghost.style.borderRadius = '8px';
                ghost.style.backgroundColor = 'white';
                ghost.style.padding = '8px';
                ghost.style.fontSize = '12px';
                ghost.style.fontWeight = 'bold';
                ghost.style.color = '#1e40af';
                ghost.style.display = 'flex';
                ghost.style.alignItems = 'center';
                ghost.style.justifyContent = 'center';
                ghost.style.width = '120px';
                ghost.style.height = '80px';
                ghost.textContent = '↩️ Return';
                document.body.appendChild(ghost);
                touchDragGhostRef.current = ghost;
            }
        }

        // Move ghost element
        if (touchDragBackActive && touchDragGhostRef.current) {
            // Note: Cannot use e.preventDefault() in passive listener - rely on CSS touch-action: none
            touchDragGhostRef.current.style.left = touch.clientX - 60 + 'px';
            touchDragGhostRef.current.style.top = touch.clientY - 40 + 'px';

            // Highlight learning content sidebar as drop zone
            const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
            const sidebar = elementAtPoint?.closest('.sidebar-container');
            if (sidebar) {
                sidebar.classList.add('touch-drop-zone-active');
            } else {
                document.querySelectorAll('.sidebar-container.touch-drop-zone-active').forEach(el => {
                    el.classList.remove('touch-drop-zone-active');
                });
            }
        }
    }, [isTrainer, touchDragBackActive]);

    const handleItemTouchEnd = useCallback((e, item) => {
        if (!isTrainer) return;

        // Handle pinch end
        handlePinchEnd();

        const touch = e.changedTouches[0];

        // Cleanup ghost
        if (touchDragGhostRef.current) {
            touchDragGhostRef.current.remove();
            touchDragGhostRef.current = null;
        }

        // Remove highlights
        document.querySelectorAll('.touch-drop-zone-active').forEach(el => {
            el.classList.remove('touch-drop-zone-active');
        });

        // Restore opacity
        e.currentTarget.style.opacity = '1';

        if (touchDragBackActive) {
            // Check if dropped on sidebar
            const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
            const sidebar = elementAtPoint?.closest('.sidebar-container');

            if (sidebar) {
                // Success feedback - remove item from whiteboard
                setCanvasItems(prev => prev.filter(i => i.id !== item.id));
                whiteboardService?.send('item_remove', { id: item.id });

                // Clear selection
                setSelectedItems([]);
            }
        }

        setTouchDragBackActive(false);
        touchDragItemRef.current = null;
    }, [isTrainer, touchDragBackActive, whiteboardService, setCanvasItems, setSelectedItems, handlePinchEnd]);

    // Preload images when canvasItems change - debounced to prevent excessive calls
    useEffect(() => {
        const timer = setTimeout(() => {
            preloadImages(canvasItems);
        }, 100);
        return () => clearTimeout(timer);
    }, [canvasItems, preloadImages]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Set canvas size with higher resolution
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        ctx.scale(dpr, dpr);

        // Setup whiteboard event listeners
        if (whiteboardService) {
            whiteboardService.onDraw = (data) => {
                drawOnCanvas(data);
            };

            whiteboardService.onClear = () => {
                clearCanvas();
                setCanvasItems([]);
            };

            whiteboardService.onImage = (data) => {
                // Add the image to canvasItems if not already present
                // The useEffect will handle redrawing via redrawCanvas()
                // console.log('[Whiteboard] onImage received:', data);
                setCanvasItems(prev => {
                    const exists = prev.find(item => item.id === data.id);
                    if (!exists) {
                        const newItem = {
                            id: data.id,
                            src: data.src,
                            x: data.x,
                            y: data.y,
                            width: data.width,
                            height: data.height,
                            title: data.title,
                            type: data.type,
                            // Preserve canonical file metadata for learning content API
                            fileUrl: data.fileUrl,
                            thumbnail: data.thumbnail,
                            originalFilename: data.originalFilename,
                            mimeType: data.mimeType
                        };
                        // console.log('[Whiteboard] Adding image item to canvasItems:', newItem);

                        // Auto-open popup if it's a video/PDF and this is a trainer adding it
                        if (isTrainer) {
                            const isVideo = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv'].some(ext =>
                                data.src.toLowerCase().includes(ext)
                            ) || data.type === 'video' || data.src.includes('video');
                            const isPdf = data.src.toLowerCase().includes('.pdf') || data.type === 'pdf';

                            if (isVideo || isPdf) {
                                const mediaType = isVideo ? 'video' : 'pdf';
                                // Schedule popup open for next tick to avoid state conflicts
                                setTimeout(() => {
                                    // console.log('[Whiteboard] Auto-opening media on add:', { id: data.id, mediaType });
                                    mediaControl.openMedia(data.id, mediaType, data.src);
                                }, 50);
                            }
                        }

                        return [...prev, newItem];
                    }
                    return prev;
                });
                // Don't call drawImageOnCanvas directly - let redrawCanvas handle it
                // to avoid race conditions with canvas clearing
            };

            whiteboardService.onItemUpdate = (data) => {
                // console.log('[Whiteboard] Item update received:', data);

                // Handle bucket removal
                if (data.removed_from_bucket) {
                    setBuckets(prev => prev.map(bucket =>
                        bucket.id === data.removed_from_bucket
                            ? { ...bucket, items: (bucket.items || []).filter(id => id !== data.id) }
                            : bucket
                    ));
                }

                // Update item properties
                setCanvasItems(prev => prev.map(item =>
                    item.id === data.id
                        ? {
                            ...item,
                            x: data.x !== undefined ? data.x : item.x,
                            y: data.y !== undefined ? data.y : item.y,
                            width: data.width !== undefined ? data.width : item.width,
                            height: data.height !== undefined ? data.height : item.height,
                            inBucket: data.inBucket !== undefined ? data.inBucket : item.inBucket,
                            answers: data.answers !== undefined ? data.answers : item.answers
                        }
                        : item
                ));
            };

            whiteboardService.onItemRemove = (data) => {
                // console.log('[Whiteboard] Item removed:', data);
                setCanvasItems(prev => prev.filter(item => item.id !== data.id));
            };

            /* Inline video/media handler moved to consolidated onMediaControl handler below. */

            whiteboardService.onBucketAdded = (data) => {
                // console.log('[Whiteboard] Bucket added:', data);
                setBuckets(prev => {
                    const exists = prev.find(bucket => bucket.id === data.id);
                    if (!exists) {
                        return [...prev, data];
                    }
                    return prev;
                });
            };

            whiteboardService.onBucketUpdate = (data) => {
                // console.log('[Whiteboard] Bucket updated:', data);
                if (data.removed) {
                    // Remove bucket
                    setBuckets(prev => prev.filter(bucket => bucket.id !== data.id));
                } else {
                    // Update bucket
                    setBuckets(prev => prev.map(bucket =>
                        bucket.id === data.id ? { ...bucket, ...data } : bucket
                    ));
                }
            };

            whiteboardService.onTextAdded = (data) => {
                // console.log('[Whiteboard] Text added:', data);
                // Add text message to display as alert
                const newMessage = {
                    id: data.id,
                    text: data.text,
                    sender: data.sender || 'Learner',
                    timestamp: Date.now()
                };

                setTextMessages(prev => [...prev, newMessage]);

                // Auto-remove message after 5 seconds
                setTimeout(() => {
                    setTextMessages(prev => prev.filter(msg => msg.id !== data.id));
                }, 5000);
            };

            whiteboardService.onVideoStateUpdate = (data) => {
                // console.log('[Whiteboard] Video state received:', data);
                // Apply video state synchronization from trainer to learners
                // Note: setVideoStates would need to be passed as a prop or managed differently
                // console.log('[Whiteboard] Video state update:', data.videoId, data.isPlaying);
            };

            whiteboardService.onMediaControl = (data) => {
                // console.log('[Whiteboard] Media control event received:', data);

                // If this is an inline video open command, handle inline split-video
                if (data && data.action === 'open' && data.src) {
                    // Open inline split video for learners (suppress popup)
                    if (!isTrainer) {
                        setInlineVideo({ id: data.videoId, src: data.src });
                    }
                    return; // don't forward to popup handler
                }

                // Forward to MediaControlContext for other media control flows
                try {
                    mediaControl.handleMediaControlEvent(data);
                } catch (err) {
                    // console.warn('[Whiteboard] mediaControl.handleMediaControlEvent error:', err);
                }

                // Additionally support inline split-video synchronization for play/pause/seek/close
                if (!data || !data.action) return;
                const action = data.action;
                if (action === 'close') {
                    setInlineVideo(null);
                    if (inlineVideoRef.current) {
                        try { inlineVideoRef.current.pause(); } catch { /* ignore */ }
                    }
                    return;
                }

                if (!isTrainer && inlineVideoRef.current) {
                    const videoEl = inlineVideoRef.current;
                    if (action === 'play') {
                        videoEl.currentTime = data.currentTime || 0;
                        videoEl.play().catch(err => console.error('Video play failed:', err));
                    } else if (action === 'pause') {
                        videoEl.currentTime = data.currentTime || videoEl.currentTime;
                        videoEl.pause();
                    } else if (action === 'seek') {
                        videoEl.currentTime = data.currentTime;
                    }
                }
            };
        }

        // Handle window resize
        const handleResize = () => {
            try {
                // Try to preserve image data, but catch cross-origin errors
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                canvas.width = canvas.offsetWidth * dpr;
                canvas.height = canvas.offsetHeight * dpr;
                ctx.scale(dpr, dpr);
                ctx.putImageData(imageData, 0, 0);
            } catch (error) {
                // If cross-origin error, just resize without preserving data
                // console.warn('[Whiteboard] Could not preserve canvas data during resize:', error.message);
                canvas.width = canvas.offsetWidth * dpr;
                canvas.height = canvas.offsetHeight * dpr;
                ctx.scale(dpr, dpr);
                // Redraw canvas items instead
                redrawCanvas();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            if (whiteboardService) {
                whiteboardService.onDraw = null;
                whiteboardService.onClear = null;
                whiteboardService.onImage = null;
                whiteboardService.onTextAdded = null;
                whiteboardService.onBucketAdded = null;
                whiteboardService.onBucketUpdate = null;
                whiteboardService.onMediaControl = null;
            }
            window.removeEventListener('resize', handleResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [whiteboardService, mediaControl]);

    // Register media control callback with whiteboardService
    useEffect(() => {
        mediaControl.setMediaControlCallback((mediaControlEvent) => {
            console.log('[Whiteboard] Sending media control event to server:', mediaControlEvent);
            whiteboardService?.sendMediaControl(mediaControlEvent);
        });
    }, [mediaControl, whiteboardService]);

    // Request media snapshot when learner joins (for reconnection support)
    useEffect(() => {
        if (!isTrainer && whiteboardService) {
            console.log('[Whiteboard] Learner requesting media snapshot');
            // Send request_snapshot to get current media state
            whiteboardService?.sendMediaControl({
                action: 'request_snapshot'
            });
        }
    }, [whiteboardService, isTrainer]);

    // Handle clear canvas trigger (clears pen strokes + canvas + video)
    useEffect(() => {
        if (clearCanvasTrigger > 0) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                // Clear entire canvas including pen strokes
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            // Also clear inline video if present
            if (inlineVideoRef.current) {
                inlineVideoRef.current.pause();
            }
            setInlineVideo(null);
        }
    }, [clearCanvasTrigger]);

    // Handle erase pen trigger (clears only pen strokes, redraws items)
    useEffect(() => {
        if (erasePenTrigger > 0) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                // Clear entire canvas to remove pen strokes
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Redraw canvas items after clearing pen strokes
                setTimeout(() => {
                    redrawCanvas();
                }, 10);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [erasePenTrigger]);

    // Handle redraw canvas trigger (forces redraw of canvas items)
    useEffect(() => {
        if (redrawCanvasTrigger > 0) {
            // Schedule redraw after clearing
            const timer = setTimeout(() => {
                redrawCanvas();
            }, 10);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redrawCanvasTrigger]);

    // Clear animation state after drop animation completes
    useEffect(() => {
        if (animatingItemId) {
            const timer = setTimeout(() => {
                setAnimatingItemId(null);
            }, 400); // Match the animation duration in CSS
            return () => clearTimeout(timer);
        }
    }, [animatingItemId]);

    // Optimized redraw effect - debounced to prevent excessive renders when adding videos
    useEffect(() => {
        const timer = setTimeout(() => {
            redrawCanvas();
        }, 16); // 60fps, only redraw once per frame max
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canvasItems]);

    // Redraw when learner selection changes (remote or local) - also debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            redrawCanvas();
        }, 16);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [learnerSelectedItemIds, selectedItems]);

    const redrawCanvas = useCallback((items = canvasItems) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        // Don't clear the canvas to preserve pen strokes drawn directly on canvas
        // Canvas items (images, PDFs) will render on top of existing pen strokes

        // Draw all items using cached images
        items.forEach(item => {
            // Skip text items as they're displayed as alerts, not on canvas
            if (item.type === 'text') {
                return;
            }

            // Skip images as they're rendered as overlays, not on canvas
            if (item.src && !isVideoItem(item) && !isPdfItem(item)) {
                return;
            }

            if (item.src) {
                // Use cached image if available (for videos/PDFs only now)
                const cachedImg = imageCacheRef.current.get(item.src);
                if (cachedImg && (isVideoItem(item) || isPdfItem(item))) {
                    // Determine if item is selected by trainer or learner
                    const isSelectedByTrainer = isTrainer && selectedItems.some(si => si.id === item.id);
                    const isSelectedByLearner = !isTrainer && selectedItems.some(si => si.id === item.id);
                    const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemIds.includes(item.id);

                    // Set border color and width based on who selected it
                    if (isSelectedByRemoteLearner) {
                        ctx.strokeStyle = '#4caf50';
                        ctx.lineWidth = 4;
                    } else if (isSelectedByLearner) {
                        ctx.strokeStyle = '#4caf50';
                        ctx.lineWidth = 4;
                    } else if (isSelectedByTrainer) {
                        ctx.strokeStyle = '#007bff';
                        ctx.lineWidth = 3;
                    } else {
                        ctx.strokeStyle = '#000000';
                        ctx.lineWidth = 2;
                    }

                    ctx.strokeRect(item.x, item.y, item.width, item.height);
                    ctx.drawImage(cachedImg, item.x, item.y, item.width, item.height);

                    // Draw resize handle only for trainer's own selection
                    if (isSelectedByTrainer) {
                        ctx.fillStyle = '#007bff';
                        ctx.fillRect(item.x + item.width - 8, item.y + item.height - 8, 8, 8);
                    }

                    // Draw indicator label for remote learner's selection
                    if (isSelectedByRemoteLearner) {
                        ctx.fillStyle = '#4caf50';
                        ctx.font = 'bold 12px Arial';
                        ctx.fillText('👤 Learner', item.x, item.y - 5);
                    }

                    // Draw indicator for learner's own selection
                    if (isSelectedByLearner) {
                        ctx.fillStyle = '#4caf50';
                        ctx.font = 'bold 12px Arial';
                        ctx.fillText('✓ Selected', item.x, item.y - 5);
                    }
                } else if (isVideoItem(item) || isPdfItem(item)) {
                    // If video/PDF not cached, trigger preload
                    console.warn('[Whiteboard] Video/PDF not cached:', item.src);
                    preloadImages([item]);
                }
                // Videos and PDFs are rendered as HTML overlays, not on canvas
                // Images are also rendered as HTML overlays only
            } else if (item.shape) {
                if (item.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                } else if (item.shape === 'square') {
                    ctx.fillStyle = color;
                    ctx.fillRect(item.x, item.y, item.width, item.height);
                }
            }
        });
    }, [canvasItems, isTrainer, selectedItems, learnerSelectedItemIds, color, isVideoItem, isPdfItem, preloadImages]);

    const drawOnCanvas = (data) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.moveTo(data.prevX, data.prevY);
        ctx.lineTo(data.currX, data.currY);

        // Handle eraser tool with proper erasing instead of white drawing
        if (data.tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)'; // Any color works for destination-out
            ctx.lineWidth = data.lineWidth || 20;
        } else {
            ctx.globalCompositeOperation = 'source-over'; // Default drawing mode
            ctx.strokeStyle = data.color;
            ctx.lineWidth = data.lineWidth;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.closePath();

        // Reset to default composite operation
        ctx.globalCompositeOperation = 'source-over';
    };

    // Unused - keeping for reference
    // const drawImageOnCanvas = (data) => {
    //     const canvas = canvasRef.current;
    //     const ctx = canvas.getContext('2d');
    //     const img = new Image();
    //     img.crossOrigin = 'anonymous'; // Allow cross-origin images

    //     img.onload = () => {
    //         ctx.drawImage(img, data.x, data.y, data.width, data.height);
    //     };

    //     img.src = data.src;
    // };



    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Bucket functions
    // Unused - keeping for reference
    // const addBucket = () => {
    //     // Calculate position for new bucket (place next to previous one)
    //     const lastBucket = buckets[buckets.length - 1];
    //     const newX = lastBucket ? lastBucket.x + lastBucket.width + 20 : 100;
    //     const newY = lastBucket ? lastBucket.y : 100;

    //     const newBucket = {
    //         id: Date.now(),
    //         x: newX,
    //         y: newY,
    //         width: 150,
    //         height: 150,
    //         label: 'Bucket',
    //         color: bucketColor,
    //         items: [] // Items inside bucket
    //     };
    //     setBuckets(prev => [...prev, newBucket]);

    //     // Send to other participants
    //     whiteboardService?.send('bucket_added', newBucket);
    // };

    const removeBucket = (bucketId) => {
        setBuckets(prev => prev.filter(b => b.id !== bucketId));

        // Send update to other participants
        whiteboardService?.send('bucket_update', { id: bucketId, removed: true });
    };

    const removeItemFromBucket = (itemId, bucketId) => {
        // Remove item from bucket's items array
        setBuckets(prev => prev.map(bucket =>
            bucket.id === bucketId
                ? { ...bucket, items: (bucket.items || []).filter(id => id !== itemId) }
                : bucket
        ));

        // Update the item to remove inBucket property and restore original size
        setCanvasItems(prev => prev.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    inBucket: null,
                    width: item.originalWidth || item.width,
                    height: item.originalHeight || item.height
                };
            }
            return item;
        }));

        // Deselect item if it was selected
        if (selectedItems.some(si => si.id === itemId)) {
            setSelectedItems(prev => prev.filter(si => si.id !== itemId));
        }

        // Send update to other participants
        whiteboardService?.send('item_update', {
            id: itemId,
            inBucket: null,
            removed_from_bucket: bucketId
        });
    };

    const getBucketAtPosition = (x, y) => {
        return buckets.find(bucket =>
            x >= bucket.x && x <= bucket.x + bucket.width &&
            y >= bucket.y && y <= bucket.y + bucket.height
        );
    };

    const isBucketResizeHandle = (x, y, bucket) => {
        const handleSize = 20; // Larger hit area for easier resizing
        return x >= bucket.x + bucket.width - handleSize &&
            x <= bucket.x + bucket.width &&
            y >= bucket.y + bucket.height - handleSize &&
            y <= bucket.y + bucket.height;
    };

    const handleBucketLabelClick = (bucket, e) => {
        e.stopPropagation();
        setEditingBucketId(bucket.id);
        setEditingBucketLabel(bucket.label);
    };

    const handleBucketLabelChange = (e) => {
        setEditingBucketLabel(e.target.value);
    };

    const handleBucketLabelBlur = () => {
        if (editingBucketId) {
            const updatedBuckets = buckets.map(bucket =>
                bucket.id === editingBucketId
                    ? { ...bucket, label: editingBucketLabel }
                    : bucket
            );
            setBuckets(updatedBuckets);

            // Send update to other participants
            const updatedBucket = updatedBuckets.find(b => b.id === editingBucketId);
            whiteboardService?.send('bucket_update', updatedBucket);

            setEditingBucketId(null);
            setEditingBucketLabel('');
        }
    };

    const isItemInBucket = (itemX, itemY, itemWidth, itemHeight, bucket) => {
        // Check if any part of the item overlaps with the bucket
        return !(itemX + itemWidth < bucket.x ||  // item is to the left
            itemX > bucket.x + bucket.width ||  // item is to the right
            itemY + itemHeight < bucket.y ||   // item is above
            itemY > bucket.y + bucket.height); // item is below
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Handle both mouse and touch events
        let x, y;
        if (e.touches) {
            // Touch event
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            // Mouse event
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        // Check if clicking on a bucket (trainer only can drag buckets)
        if (isTrainer) {
            const bucket = getBucketAtPosition(x, y);
            if (bucket) {
                // Check if clicking on resize handle
                if (isBucketResizeHandle(x, y, bucket)) {
                    setSelectedItems([{ ...bucket, type: 'bucket' }]);
                    setIsResizingItem(true);
                    prevPosRef.current = { x, y };
                    e.preventDefault();
                    return;
                }

                // Otherwise, drag the bucket
                setSelectedItems([{ ...bucket, type: 'bucket' }]);
                setIsDraggingItem(true);
                prevPosRef.current = { x, y };
                e.preventDefault();
                return;
            }
        }

        const item = getItemAtPosition(x, y);
        if (item) {
            // Store original size when selecting item for potential bucket interaction
            const itemWithOriginalSize = {
                ...item,
                originalWidth: item.originalWidth || item.width,
                originalHeight: item.originalHeight || item.height
            };

            // Check permissions for learners
            if (!isTrainer) {
                // Learner needs select permission to interact with items
                if (!toolAccess.select) {
                    return; // No permission - do nothing
                }

                const isAlreadySelected = selectedItems.some(si => si.id === item.id);

                // When drag permission is active, only allow single-item selection for dragging
                // Disable multiselect to prevent confusion during drag operations
                if (toolAccess.drag) {
                    // Single selection mode when drag is enabled
                    setSelectedItems([itemWithOriginalSize]);

                    // Send selection to trainer via websocket
                    if (whiteboardService) {
                        whiteboardService.send('item_selected', {
                            itemIds: [item.id],
                            selectedBy: 'learner',
                            timestamp: Date.now()
                        });
                    }

                    // Start dragging or resizing
                    if (isResizeHandle(x, y, item)) {
                        setIsResizingItem(true);
                    } else {
                        // Store offset from cursor to item's top-left corner for smooth dragging
                        dragOffsetRef.current = {
                            x: x - item.x,
                            y: y - item.y
                        };
                        setIsDraggingItem(true);
                    }
                    prevPosRef.current = { x, y };
                } else {
                    // Multiselect mode when drag is disabled (select-only permission)
                    // Handle multiple selection - toggle items on/off
                    if (isAlreadySelected) {
                        // Unselect this item
                        setSelectedItems(prev => prev.filter(si => si.id !== item.id));
                    } else {
                        // Add to selection
                        setSelectedItems(prev => [...prev, itemWithOriginalSize]);
                    }

                    // Send selection to trainer via websocket
                    if (whiteboardService) {
                        const newSelectedIds = isAlreadySelected
                            ? selectedItems.filter(si => si.id !== item.id).map(si => si.id)
                            : [...selectedItems.map(si => si.id), item.id];

                        whiteboardService.send('item_selected', {
                            itemIds: newSelectedIds,
                            selectedBy: 'learner',
                            timestamp: Date.now()
                        });
                    }
                }
                return;
            }

            // Trainer has full access
            setSelectedItems([itemWithOriginalSize]);
            if (isResizeHandle(x, y, item)) {
                setIsResizingItem(true);
            } else {
                // Store offset from cursor to item's top-left corner for smooth dragging
                dragOffsetRef.current = {
                    x: x - item.x,
                    y: y - item.y
                };
                setIsDraggingItem(true);
            }
            prevPosRef.current = { x, y };
            return;
        }

        // Only trainer can draw
        if (!isTrainer) return;

        // Check if drawing tool is active (pen or eraser)
        if ((tool === 'pen' || tool === 'eraser') && !toolActive) {
            return; // Tool not active, don't allow drawing
        }

        setIsDrawing(true);
        prevPosRef.current = { x, y };

        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        // Use requestAnimationFrame for smooth 60fps updates
        if (rafIdRef.current !== null) {
            return; // Already scheduled, skip duplicate calls
        }

        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            performDraw(e);
        });
    };

    // Throttled state update for drag operations - update state at most every 16ms (60fps)
    const updateDragState = useCallback((updatedItem, updatedItems) => {
        const now = Date.now();
        // Throttle state updates to 16ms (60fps) to reduce re-renders
        if (now - dragStateUpdateTimeRef.current > 16) {
            setCanvasItems(updatedItems);
            setSelectedItems([updatedItem]);
            dragStateUpdateTimeRef.current = now;
        }
    }, []);

    const performDraw = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Handle both mouse and touch events
        let currX, currY;
        if (e.touches) {
            // Touch event
            currX = e.touches[0].clientX - rect.left;
            currY = e.touches[0].clientY - rect.top;
        } else {
            // Mouse event
            currX = e.clientX - rect.left;
            currY = e.clientY - rect.top;
        }

        // Handle video resizing
        if (resizingVideo) {
            if (!isTrainer) return;

            const dx = currX - prevPosRef.current.x;
            const _dy = currY - prevPosRef.current.y;

            // Maintain aspect ratio for video resizing
            const aspectRatio = resizingVideo.width / resizingVideo.height;
            const newWidth = Math.max(50, resizingVideo.width + dx);
            const newHeight = newWidth / aspectRatio;

            const updatedVideo = {
                ...resizingVideo,
                width: newWidth,
                height: newHeight
            };

            const newItems = canvasItems.map(item =>
                item.id === resizingVideo.id ? updatedVideo : item
            );

            // Performance: Throttle state updates to reduce re-renders (16ms = 60fps)
            const now = Date.now();
            if (now - dragStateUpdateTimeRef.current > 16) {
                setCanvasItems(newItems);
                dragStateUpdateTimeRef.current = now;
            }

            // Throttle network updates to every 50ms
            if (now - lastNetworkUpdateRef.current > 50) {
                whiteboardService?.sendItemUpdate({
                    id: resizingVideo.id,
                    x: updatedVideo.x,
                    y: updatedVideo.y,
                    width: updatedVideo.width,
                    height: updatedVideo.height
                });
                lastNetworkUpdateRef.current = now;
            }

            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Handle dragging buckets (trainer only)
        if (isDraggingItem && selectedItems.length > 0 && selectedItems[0].type === 'bucket') {
            if (!isTrainer) return;

            const selectedItem = selectedItems[0];
            const dx = currX - prevPosRef.current.x;
            const dy = currY - prevPosRef.current.y;
            const updatedBucket = {
                ...selectedItem,
                x: selectedItem.x + dx,
                y: selectedItem.y + dy
            };

            // Also move items inside this bucket
            const updatedItems = canvasItems.map(item => {
                if (item.inBucket === selectedItem.id) {
                    return {
                        ...item,
                        x: item.x + dx,
                        y: item.y + dy
                    };
                }
                return item;
            });

            // Performance: Throttle state updates to reduce re-renders (16ms = 60fps)
            const now = Date.now();
            if (now - dragStateUpdateTimeRef.current > 16) {
                setCanvasItems(updatedItems);
                setBuckets(prev => prev.map(bucket =>
                    bucket.id === selectedItem.id ? updatedBucket : bucket
                ));
                setSelectedItems([updatedBucket]);
                dragStateUpdateTimeRef.current = now;
            }

            // Throttle network updates to every 50ms
            if (now - lastNetworkUpdateRef.current > 50) {
                whiteboardService?.send('bucket_update', updatedBucket);
                updatedItems.forEach(item => {
                    if (item.inBucket === selectedItem.id) {
                        whiteboardService?.sendItemUpdate({
                            id: item.id,
                            x: item.x,
                            y: item.y,
                            width: item.width,
                            height: item.height
                        });
                    }
                });
                lastNetworkUpdateRef.current = now;
            }

            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Handle dragging items (for both trainer and learner with permission)
        if (isDraggingItem && selectedItems.length > 0 && selectedItems[0].type !== 'bucket') {
            // Learners need drag permission
            if (!isTrainer && !toolAccess.drag) {
                return;
            }

            const selectedItem = selectedItems[0];
            // Use cursor position with stored offset for precise positioning
            // This keeps the item at the exact same position relative to cursor as when drag started
            const updatedItem = {
                ...selectedItem,
                x: currX - dragOffsetRef.current.x,
                y: currY - dragOffsetRef.current.y
            };

            // Find if item is in any bucket now
            let foundBucket = null;
            for (let bucket of buckets) {
                if (isItemInBucket(updatedItem.x, updatedItem.y, updatedItem.width, updatedItem.height, bucket)) {
                    foundBucket = bucket;
                    break;
                }
            }

            // If item should be in a bucket
            if (foundBucket) {
                // Only shrink if not already in this bucket
                if (updatedItem.inBucket !== foundBucket.id) {
                    // Save original dimensions before shrinking
                    if (!updatedItem.originalWidth) {
                        updatedItem.originalWidth = updatedItem.width;
                    }
                    if (!updatedItem.originalHeight) {
                        updatedItem.originalHeight = updatedItem.height;
                    }

                    updatedItem.width = 40;
                    updatedItem.height = 40;

                    // Trigger drop animation
                    setAnimatingItemId(updatedItem.id);

                    // Update bucket's items list if it's a new bucket
                    if (updatedItem.inBucket) {
                        // Remove from old bucket
                        setBuckets(prev => prev.map(b =>
                            b.id === updatedItem.inBucket
                                ? { ...b, items: (b.items || []).filter(id => id !== selectedItem.id) }
                                : b
                        ));
                    }

                    // Add to new bucket
                    setBuckets(prev => prev.map(b =>
                        b.id === foundBucket.id && !(b.items || []).includes(selectedItem.id)
                            ? { ...b, items: [...(b.items || []), selectedItem.id] }
                            : b
                    ));

                    updatedItem.inBucket = foundBucket.id;
                }
            } else {
                // Item is outside all buckets - unshrink if it was in a bucket
                if (updatedItem.inBucket) {
                    // Remove from old bucket
                    setBuckets(prev => prev.map(b =>
                        b.id === updatedItem.inBucket
                            ? { ...b, items: (b.items || []).filter(id => id !== selectedItem.id) }
                            : b
                    ));
                    updatedItem.inBucket = null;
                    // Restore original size - expand back to normal
                    updatedItem.width = selectedItem.originalWidth || updatedItem.width;
                    updatedItem.height = selectedItem.originalHeight || updatedItem.height;
                    setAnimatingItemId(null); // Stop animation when leaving bucket
                }
            }

            // Preserve original dimensions for future bucket operations
            updatedItem.originalWidth = selectedItem.originalWidth || updatedItem.width;
            updatedItem.originalHeight = selectedItem.originalHeight || updatedItem.height;

            const newItems = canvasItems.map(item =>
                item.id === selectedItem.id ? updatedItem : item
            );

            // Performance: Throttle state updates to reduce re-renders (16ms = 60fps)
            updateDragState(updatedItem, newItems);

            // Throttle network updates to every 50ms for smooth performance
            const now = Date.now();
            if (now - lastNetworkUpdateRef.current > 50) {
                whiteboardService?.sendItemUpdate({
                    id: selectedItem.id,
                    x: updatedItem.x,
                    y: updatedItem.y,
                    width: updatedItem.width,
                    height: updatedItem.height,
                    inBucket: updatedItem.inBucket || null
                });
                lastNetworkUpdateRef.current = now;
            }
            // No need to update prevPosRef - we use absolute cursor position with stored offset
            return;
        }

        // Handle resizing items (for both trainer and learner with permission)
        if (isResizingItem && selectedItems.length > 0) {
            const selectedItem = selectedItems[0];
            // Handle bucket resizing (trainer only)
            if (selectedItem.type === 'bucket') {
                if (!isTrainer) return;

                const dx = currX - prevPosRef.current.x;
                const dy = currY - prevPosRef.current.y;
                const updatedBucket = {
                    ...selectedItem,
                    width: Math.max(100, selectedItem.width + dx),
                    height: Math.max(100, selectedItem.height + dy)
                };

                // Performance: Throttle state updates to reduce re-renders (16ms = 60fps)
                const now = Date.now();
                if (now - dragStateUpdateTimeRef.current > 16) {
                    setBuckets(prev => prev.map(bucket =>
                        bucket.id === selectedItem.id ? updatedBucket : bucket
                    ));
                    setSelectedItems([updatedBucket]);
                    dragStateUpdateTimeRef.current = now;
                }

                // Throttle network updates to every 50ms
                if (now - lastNetworkUpdateRef.current > 50) {
                    whiteboardService?.send('bucket_update', updatedBucket);
                    lastNetworkUpdateRef.current = now;
                }

                prevPosRef.current = { x: currX, y: currY };
                return;
            }

            // Learners need drag permission for resizing too
            if (!isTrainer && !toolAccess.drag) {
                return;
            }

            const dx = currX - prevPosRef.current.x;
            const dy = currY - prevPosRef.current.y;
            const updatedItem = {
                ...selectedItem,
                width: Math.max(20, selectedItem.width + dx),
                height: Math.max(20, selectedItem.height + dy)
            };
            const newItems = canvasItems.map(item =>
                item.id === selectedItem.id ? updatedItem : item
            );

            // Performance: Throttle state updates to reduce re-renders (16ms = 60fps)
            updateDragState(updatedItem, newItems);

            // Throttle network updates to every 50ms
            const now = Date.now();
            if (now - lastNetworkUpdateRef.current > 50) {
                whiteboardService?.sendItemUpdate({
                    id: selectedItem.id,
                    x: updatedItem.x,
                    y: updatedItem.y,
                    width: updatedItem.width,
                    height: updatedItem.height
                });
                lastNetworkUpdateRef.current = now;
            }
            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Drawing is only for trainer
        if (!isTrainer) return;

        // Check if drawing is active
        if (!isDrawing) return;

        const drawData = {
            prevX: prevPosRef.current.x,
            prevY: prevPosRef.current.y,
            currX,
            currY,
            color: tool === 'eraser' ? '#ffffff' : color,
            lineWidth: tool === 'eraser' ? 20 : lineWidth,
            tool: tool // Add tool information for proper erasing
        };

        drawOnCanvas(drawData);
        whiteboardService?.sendDrawData(drawData);

        prevPosRef.current = { x: currX, y: currY };
    };

    const stopDrawing = () => {
        // Cancel any pending animation frame
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }

        // No need to check bucket on stop - it's handled in draw() in real-time
        setIsDrawing(false);
        setIsDraggingItem(false);
        setIsResizingItem(false);
        setResizingVideo(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverCanvas(false);

        if (!isTrainer) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Try to get external learning content data first
        let droppedData = null;
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (jsonData) {
                droppedData = JSON.parse(jsonData);
            }
        } catch (error) {
            console.error('Error parsing dropped data:', error);
        }

        // Handle external learning content drop
        if (droppedData && droppedData.url) {
            // Construct full URL properly - handle both relative and absolute URLs
            let fullUrl = droppedData.url;
            let fileUrl = fullUrl; // Store canonical fileUrl for learning content API

            // Only prepend backend URL if it's a relative path
            // Presigned URLs (starting with https://s3.amazonaws.com) should be used as-is
            if (!fullUrl.startsWith('http') && !fullUrl.startsWith('s3://')) {
                // It's a relative URL like /uploads/learning_content/file.png
                // Use the same backend URL that the frontend uses
                const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://43.204.218.16:8000/api';
                const backendUrl = apiBaseUrl.replace('/api', ''); // Remove /api to get base URL
                fullUrl = `${backendUrl}${fullUrl}`;
                fileUrl = fullUrl; // Store full URL
            }

            // console.log('[Whiteboard] Dropping content on trainer canvas:', {
            //     originalUrl: droppedData.url,
            //     fullUrl,
            //     thumbnail: droppedData.thumbnail,
            //     type: droppedData.type,
            //     finalSrc: droppedData.thumbnail || fullUrl
            // });

            // Check if it's a video - if so, enable inline split mode
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv'];
            const isVideo = videoExtensions.some(ext => fullUrl.toLowerCase().includes(ext)) ||
                droppedData.type === 'video';

            if (isVideo) {
                const videoData = {
                    id: Date.now(),
                    src: fullUrl
                };

                console.log('[Whiteboard] Activating inline video split mode:', videoData);
                setInlineVideo({ id: videoData.id, src: videoData.src });

                // Send video data to learners (no title)
                whiteboardService?.sendMediaControl({
                    action: 'open',
                    videoId: videoData.id,
                    src: videoData.src
                });
                return;
            }

            // For non-video items, add to canvas as overlay
            const newItem = {
                id: Date.now(),
                src: droppedData.thumbnail || fullUrl,
                x: x - 50,
                y: y - 50,
                width: 100,
                height: 100,
                title: droppedData.title,
                type: droppedData.type,
                // Store canonical file metadata for learning content API
                fileUrl: fileUrl,
                thumbnail: droppedData.thumbnail,
                originalFilename: droppedData.originalFilename || droppedData.title || 'image',
                mimeType: droppedData.mimeType || 'image/jpeg'
            };

            // console.log('[Whiteboard] Adding new item to trainer canvas:', newItem);
            setCanvasItems(prev => {
                const updated = [...prev, newItem];
                // console.log('[Whiteboard] Trainer canvasItems updated:', updated);
                return updated;
            });

            // Send image data to other participants
            whiteboardService?.sendImage({
                id: newItem.id,
                src: newItem.src,
                x: newItem.x,
                y: newItem.y,
                width: newItem.width,
                height: newItem.height,
                title: newItem.title,
                type: newItem.type,
                fileUrl: newItem.fileUrl,
                thumbnail: newItem.thumbnail,
                originalFilename: newItem.originalFilename,
                mimeType: newItem.mimeType
            });

            return;
        }

        // Handle internal whiteboard item drop
        if (!draggedItem) return;

        const newItem = {
            id: Date.now(),
            ...draggedItem,
            x: x - 25,
            y: y - 25,
            width: 50,
            height: 50,
        };

        setCanvasItems(prev => [...prev, newItem]);

        // Send image data to other participants
        if (newItem.src) {
            whiteboardService?.sendImage({
                id: newItem.id,
                src: newItem.src,
                x: newItem.x,
                y: newItem.y,
                width: newItem.width,
                height: newItem.height,
                title: newItem.title,
                type: newItem.type,
                fileUrl: newItem.fileUrl,
                thumbnail: newItem.thumbnail,
                originalFilename: newItem.originalFilename,
                mimeType: newItem.mimeType
            });
        }

        setDraggedItem(null);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverCanvas(true);
        // Allow the drop by setting the effect
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDragLeave = (e) => {
        // Only set to false if leaving the canvas element itself, not child elements
        if (e.target === canvasRef.current) {
            setIsDragOverCanvas(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    // Video control handlers for inline split mode
    const handleVideoPlay = useCallback(() => {
        if (isTrainer && inlineVideo && whiteboardService) {
            const videoEl = inlineVideoRef.current;
            if (videoEl) {
                whiteboardService.sendMediaControl({
                    action: 'play',
                    videoId: inlineVideo.id,
                    currentTime: videoEl.currentTime
                });
            }
        }
    }, [isTrainer, inlineVideo, whiteboardService]);

    const handleVideoPause = useCallback(() => {
        if (isTrainer && inlineVideo && whiteboardService) {
            const videoEl = inlineVideoRef.current;
            if (videoEl) {
                whiteboardService.sendMediaControl({
                    action: 'pause',
                    videoId: inlineVideo.id,
                    currentTime: videoEl.currentTime
                });
            }
        }
    }, [isTrainer, inlineVideo, whiteboardService]);

    const handleVideoSeeked = useCallback(() => {
        if (isTrainer && inlineVideo && whiteboardService) {
            const videoEl = inlineVideoRef.current;
            if (videoEl) {
                whiteboardService.sendMediaControl({
                    action: 'seek',
                    videoId: inlineVideo.id,
                    currentTime: videoEl.currentTime
                });
            }
        }
    }, [isTrainer, inlineVideo, whiteboardService]);

    const handleVideoClose = useCallback(() => {
        if (isTrainer && whiteboardService) {
            whiteboardService.sendMediaControl({
                action: 'close',
                videoId: inlineVideo?.id
            });
        }
        setInlineVideo(null);
        if (inlineVideoRef.current) {
            inlineVideoRef.current.pause();
        }
    }, [isTrainer, inlineVideo, whiteboardService]);

    const getItemAtPosition = (x, y) => {
        // Search in reverse order to find topmost item (last item has highest z-index)
        for (let i = canvasItems.length - 1; i >= 0; i--) {
            const item = canvasItems[i];
            if (x >= item.x && x <= item.x + item.width &&
                y >= item.y && y <= item.y + item.height) {
                return item;
            }
        }
        return null;
    };

    const isResizeHandle = (x, y, item) => {
        const handleSize = 8;
        return x >= item.x + item.width - handleSize && x <= item.x + item.width &&
            y >= item.y + item.height - handleSize && y <= item.y + item.height;
    };

    return (
        <div className={`whiteboard-container ${isTrainer ? 'trainer-mode' : 'learner-mode'}`}>
            {/* Gesture Hints Tutorial - First Time Users */}
            {showGestureHints && (
                <div className="gesture-hints-overlay">
                    <div className="gesture-hints-container">
                        <button
                            className="gesture-hints-close"
                            onClick={() => {
                                setShowGestureHints(false);
                                localStorage.setItem('whiteboard_gesture_hints_seen', 'true');
                            }}
                            title="Close hints"
                        >
                            ×
                        </button>
                        <h3 className="gesture-hints-title">🎯 Touch Gestures Guide</h3>
                        <div className="gesture-hints-grid">
                            <div className="gesture-hint-item">
                                <div className="gesture-hint-icon">👆</div>
                                <div className="gesture-hint-text">
                                    <strong>Drag to Whiteboard</strong>
                                    <p>Touch & drag content from sidebar</p>
                                </div>
                            </div>
                            <div className="gesture-hint-item">
                                <div className="gesture-hint-icon">↩️</div>
                                <div className="gesture-hint-text">
                                    <strong>Drag Back</strong>
                                    <p>Touch & drag items to sidebar to remove</p>
                                </div>
                            </div>
                            <div className="gesture-hint-item">
                                <div className="gesture-hint-icon">🤏</div>
                                <div className="gesture-hint-text">
                                    <strong>Pinch to Resize</strong>
                                    <p>Use two fingers to resize items</p>
                                </div>
                            </div>
                        </div>
                        <button
                            className="gesture-hints-got-it"
                            onClick={() => {
                                setShowGestureHints(false);
                                localStorage.setItem('whiteboard_gesture_hints_seen', 'true');
                            }}
                        >
                            Got it! 👍
                        </button>
                    </div>
                </div>
            )}

            {/* Stopwatch Display - Top Right Corner */}
            {stopwatchFormattedTime && (
                <div className="stopwatch-overlay">
                    <div className="stopwatch-overlay-inner">
                        <div className="stopwatch-content">
                            <span className="stopwatch-time">{stopwatchFormattedTime.display}</span>
                            {stopwatchIsRunning && <span className="stopwatch-indicator"></span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Text Messages Display - Top of Whiteboard */}
            {textMessages.length > 0 && (
                <div className="text-messages-container">
                    {textMessages.map((msg, index) => (
                        <div
                            key={msg.id}
                            className="text-message"
                            style={{
                                animationDelay: `${index * 100}ms`,
                                opacity: 0.95
                            }}
                        >
                            <div className="text-message-content">
                                <div className="text-message-body">
                                    <div className="text-message-header">
                                        <span className="text-message-icon">💬</span>
                                        <span className="text-message-sender">{msg.sender}</span>
                                    </div>
                                    <div className="text-message-text">{msg.text}</div>
                                </div>
                                <button
                                    onClick={() => setTextMessages(prev => prev.filter(m => m.id !== msg.id))}
                                    className="text-message-close"
                                    title="Close"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Whiteboard Wrapper - Always use consistent container structure */}
            <div className="whiteboard-main-wrapper">
                {/* Inline Video Section - Shows when video is dropped (50% width) */}
                {inlineVideo && (
                    <div className="whiteboard-split-video">
                        <video
                            ref={inlineVideoRef}
                            src={inlineVideo.src}
                            controls
                            controlsList="nodownload"
                            playsInline
                            webkit-playsinline="true"
                            onPlay={handleVideoPlay}
                            onPause={handleVideoPause}
                            onSeeked={handleVideoSeeked}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                backgroundColor: '#000'
                            }}
                        />
                        {isTrainer && (
                            <button
                                onClick={handleVideoClose}
                                className="video-close-button"
                                title="Close video"
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}

                {/* Canvas Section - Takes full width when no video, 50% width when video is present */}
                <div className={inlineVideo ? "whiteboard-split-canvas" : "whiteboard-full-canvas"}>
                    <div
                        className="canvas-container relative"
                    >
                        <canvas
                            ref={canvasRef}
                            className="whiteboard"
                            data-whiteboard="true"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            style={{
                                backgroundColor: isDragOverCanvas ? 'rgba(100, 200, 255, 0.1)' : 'transparent',
                                transition: 'background-color 0.2s ease'
                            }}
                        />

                        {/* PAUSE OVERLAY - When pause tool is active */}
                        {isPaused && (
                            <div className="pause-overlay">
                                <div className="pause-overlay-content">
                                    ⏸️ PAUSED - All interactions disabled
                                </div>
                            </div>
                        )}

                        {/* FREEZE OVERLAY - When freeze tool is active (learner side only) */}
                        {isFrozen && !isTrainer && (
                            <div className="freeze-overlay">
                                <div className="freeze-indicator">
                                    ❄️ Your whiteboard is FROZEN
                                </div>
                            </div>
                        )}

                        {/* WAIT OVERLAY - When wait tool is active */}
                        {/* (Need to pass waitActive state from parent) */}
                        {/* {waitActive && (
                            <div className="wait-overlay">
                                <div className="wait-spinner">
                                    <div className="wait-spinner-wheel"></div>
                                    <div className="wait-text">⏳ Please wait...</div>
                                </div>
                            </div>
                        )} */}

                        {/* Videos now render inline in split mode - no overlays needed */}

                        {/* Render PDF Items as Overlays */}
                        {canvasItems.filter(item => isPdfItem(item)).map(item => {
                            const isSelectedByTrainer = isTrainer && selectedItems.some(si => si.id === item.id);
                            const isSelectedByLearner = !isTrainer && selectedItems.some(si => si.id === item.id);
                            const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemIds.includes(item.id);
                            const selectionStyle = getSelectionStyles(isSelectedByTrainer, isSelectedByLearner, isSelectedByRemoteLearner);

                            return (
                                <div key={`pdf-wrapper-${item.id}`}>
                                    <PDFOverlay
                                        item={item}
                                        isSelectedByTrainer={isSelectedByTrainer}
                                        isSelectedByLearner={isSelectedByLearner}
                                        isSelectedByRemoteLearner={isSelectedByRemoteLearner}
                                        selectionStyle={selectionStyle}
                                        isDragging={isDraggingItem && selectedItems.some(si => si.id === item.id)}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            startDrawing(e);
                                        }}
                                        onMouseMove={(e) => {
                                            e.stopPropagation();
                                            draw(e);
                                        }}
                                        onMouseUp={(e) => {
                                            e.stopPropagation();
                                            stopDrawing();
                                        }}
                                        onTouchStart={(e) => {
                                            e.stopPropagation();
                                            if (!isTrainer && !toolAccess.select) {
                                                return;
                                            }

                                            // For trainer: enable touch drag-back to sidebar
                                            if (isTrainer) {
                                                handleItemTouchStart(e, item);
                                            }
                                            startDrawing(e);
                                        }}
                                        onTouchMove={(e) => {
                                            e.stopPropagation();
                                            if (isDraggingItem || isResizingItem) {
                                                // Note: Cannot use e.preventDefault() in passive listener - rely on CSS touch-action: none
                                                draw(e);
                                            }

                                            // Handle touch drag-back
                                            if (isTrainer && touchDragItemRef.current?.id === item.id) {
                                                handleItemTouchMove(e, item);
                                            }
                                        }}
                                        onTouchEnd={(e) => {
                                            e.stopPropagation();

                                            // Handle touch drag-back completion
                                            if (isTrainer && touchDragItemRef.current?.id === item.id) {
                                                handleItemTouchEnd(e, item);
                                            }
                                            stopDrawing();
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleMediaOpen(item);
                                        }}
                                    />

                                    {/* Resize Handle for Trainer */}
                                    {isSelectedByTrainer && (
                                        <div
                                            className="resize-handle"
                                            style={{
                                                left: `${item.x + item.width - 2}px`,
                                                top: `${item.y + item.height - 2}px`,
                                                zIndex: 21
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setSelectedItems([item]);
                                                setIsResizingItem(true);
                                                prevPosRef.current = { x: e.clientX, y: e.clientY };
                                            }}
                                            title="Resize PDF"
                                        />
                                    )}

                                    {/* Delete/Remove Button for PDF items in bucket - Trainer only */}
                                    {isSelectedByTrainer && item.inBucket && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeItemFromBucket(item.id, item.inBucket);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="item-delete-button"
                                            style={{
                                                left: `${item.x + item.width - 12}px`,
                                                top: `${item.y - 12}px`,
                                                zIndex: 22
                                            }}
                                            title="Remove from bucket"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Render Image Items as Overlays */}
                        {canvasItems.filter(item => item.src && !isVideoItem(item) && !isPdfItem(item)).map(item => {
                            const isSelectedByTrainer = isTrainer && selectedItems.some(si => si.id === item.id);
                            const isSelectedByLearner = !isTrainer && selectedItems.some(si => si.id === item.id);
                            const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemIds.includes(item.id);
                            const selectionStyle = getSelectionStyles(isSelectedByTrainer, isSelectedByLearner, isSelectedByRemoteLearner);
                            // console.log('[Whiteboard] Rendering image item:', { id: item.id, src: item.src, isVideo: isVideoItem(item), isPdf: isPdfItem(item) });

                            return (
                                <div key={`image-wrapper-${item.id}`}>
                                    <ImageOverlay
                                        item={item}
                                        isSelectedByTrainer={isSelectedByTrainer}
                                        isSelectedByLearner={isSelectedByLearner}
                                        isSelectedByRemoteLearner={isSelectedByRemoteLearner}
                                        selectionStyle={selectionStyle}
                                        isAnimating={animatingItemId === item.id}
                                        isDragging={isDraggingItem && selectedItems.some(si => si.id === item.id)}
                                        onMouseDown={(e) => {
                                            if (e.button === 0) {
                                                e.stopPropagation();
                                                startDrawing(e);
                                            }
                                        }}
                                        onMouseMove={(e) => {
                                            e.stopPropagation();
                                            draw(e);
                                        }}
                                        onMouseUp={(e) => {
                                            e.stopPropagation();
                                            stopDrawing();
                                        }}
                                        onTouchStart={(e) => {
                                            e.stopPropagation();
                                            // Check permissions for learners
                                            if (!isTrainer && !toolAccess.select) {
                                                return;
                                            }

                                            // For trainer: enable touch drag-back to sidebar
                                            if (isTrainer) {
                                                handleItemTouchStart(e, item);
                                            }
                                            startDrawing(e);
                                        }}
                                        onTouchMove={(e) => {
                                            e.stopPropagation();
                                            if (isDraggingItem || isResizingItem) {
                                                // Note: Cannot use e.preventDefault() in passive listener - rely on CSS touch-action: none
                                                draw(e);
                                            }

                                            // Handle touch drag-back
                                            if (isTrainer && touchDragItemRef.current?.id === item.id) {
                                                handleItemTouchMove(e, item);
                                            }
                                        }}
                                        onTouchEnd={(e) => {
                                            e.stopPropagation();

                                            // Handle touch drag-back completion
                                            if (isTrainer && touchDragItemRef.current?.id === item.id) {
                                                handleItemTouchEnd(e, item);
                                            }
                                            stopDrawing();
                                        }}
                                        onDragStart={(e) => {
                                            try {
                                                const dragPayload = {
                                                    whiteboardItemId: item.id,
                                                    src: item.src,
                                                    fileUrl: item.fileUrl || item.src,
                                                    title: item.title || item.originalFilename || 'Image',
                                                    mimeType: item.mimeType || 'image/jpeg',
                                                    originalFilename: item.originalFilename,
                                                    thumbnail: item.thumbnail,
                                                    action: 'remove-from-whiteboard'
                                                };
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));

                                                // No opacity change - keep content crisp during drag
                                            } catch (error) {
                                                console.error('[Whiteboard] Error preparing drag payload:', error);
                                            }
                                        }}
                                        onDragEnd={(e) => {
                                            // Drag ended - no opacity restoration needed
                                        }}
                                    />

                                    {/* Resize Handle for Trainer */}
                                    {isSelectedByTrainer && (
                                        <div
                                            className="resize-handle"
                                            style={{
                                                left: `${item.x + item.width - 2}px`,
                                                top: `${item.y + item.height - 2}px`,
                                                zIndex: 21
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setSelectedItems([item]);
                                                setIsResizingItem(true);
                                                prevPosRef.current = { x: e.clientX, y: e.clientY };
                                            }}
                                            title="Resize Image"
                                        />
                                    )}

                                    {/* Delete/Remove Button for items in bucket - Trainer only */}
                                    {isSelectedByTrainer && item.inBucket && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeItemFromBucket(item.id, item.inBucket);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="item-delete-button"
                                            style={{
                                                left: `${item.x + item.width - 12}px`,
                                                top: `${item.y - 12}px`,
                                                zIndex: 22
                                            }}
                                            title="Remove from bucket"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {/* Render Buckets as Overlays - Visible to both trainer and learner */}
                        {buckets.map(bucket => {
                            const dotSize = Math.max(12, Math.round(Math.min(bucket.width || 80, bucket.height || 80) * 0.12));
                            const borderPx = Math.max(1, Math.round(dotSize * 0.12));
                            // Map a fixed SVG anchor point (viewBox coords) to bucket pixels so the dot sits at the intended outline spot.
                            // Default anchor chosen near the bottom-right outline of the pot (viewBox 0..200): {x:142, y:148}.
                            const defaultAnchor = { x: 142, y: 148 };
                            const anchor = bucket.dotAnchor || defaultAnchor;
                            const offsetOut = bucket.dotOffset !== undefined ? bucket.dotOffset : 6; // px outward offset from anchor
                            const anchorPx = (anchor.x / 200) * (bucket.width || 80) + offsetOut;
                            const anchorPy = (anchor.y / 200) * (bucket.height || 80) + offsetOut;
                            return (
                                <div
                                    key={bucket.id}
                                    className="absolute"
                                    style={{
                                        left: `${bucket.x}px`,
                                        top: `${bucket.y}px`,
                                        width: `${bucket.width}px`,
                                        height: `${bucket.height}px`,
                                        pointerEvents: 'none',
                                        zIndex: 10,
                                        cursor: 'default'
                                    }}
                                >
                                    {/* Fish Bowl - Rounded Pot Shape */}
                                    <svg width={bucket.width} height={bucket.height} style={{ position: 'absolute', top: 0, left: 0 }} viewBox="0 0 200 200">
                                        <defs>
                                            {/* Glass material - soft blue tint */}
                                            <linearGradient id={`glassColor-${bucket.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                <stop offset="0%" style={{ stopColor: '#E3F2FD', stopOpacity: 0.9 }} />
                                                <stop offset="100%" style={{ stopColor: '#B3E5FC', stopOpacity: 0.8 }} />
                                            </linearGradient>

                                            {/* Rim material - smooth metallic finish */}
                                            <linearGradient id={`rimFinish-${bucket.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" style={{ stopColor: '#FFFFFF', stopOpacity: 1 }} />
                                                <stop offset="50%" style={{ stopColor: '#64B5F6', stopOpacity: 0.7 }} />
                                                <stop offset="100%" style={{ stopColor: '#1976D2', stopOpacity: 0.8 }} />
                                            </linearGradient>

                                            {/* Subtle distortion filter */}
                                            <filter id={`glassDistort-${bucket.id}`}>
                                                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" />
                                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.5" />
                                            </filter>
                                        </defs>

                                        {/* Main pot body - rounded bulbous shape */}
                                        <path
                                            d="M 45 50 Q 30 65 32 90 Q 35 115 65 135 Q 100 155 135 135 Q 165 115 168 90 Q 170 65 155 50"
                                            fill={`url(#glassColor-${bucket.id})`}
                                            stroke="#0D47A1"
                                            strokeWidth="5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {/* Top rim - rounded collar */}
                                        <g>
                                            {/* Rim outer edge */}
                                            <ellipse
                                                cx="100"
                                                cy="35"
                                                rx="65"
                                                ry="12"
                                                fill="#1976D2"
                                                stroke="#0D47A1"
                                                strokeWidth="3"
                                            />

                                            {/* Rim main surface */}
                                            <ellipse
                                                cx="100"
                                                cy="32"
                                                rx="62"
                                                ry="9"
                                                fill={`url(#rimFinish-${bucket.id})`}
                                            />

                                            {/* Rim bright highlight */}
                                            <ellipse
                                                cx="100"
                                                cy="28"
                                                rx="60"
                                                ry="6"
                                                fill="white"
                                                opacity="0.9"
                                            />

                                            {/* Rim inner shadow */}
                                            <ellipse
                                                cx="100"
                                                cy="38"
                                                rx="58"
                                                ry="5"
                                                fill="rgba(13, 71, 161, 0.3)"
                                            />
                                        </g>

                                        {/* Pot body outer contour - depth */}
                                        <path
                                            d="M 48 52 Q 35 68 37 92 Q 40 113 65 130 Q 100 150 135 130 Q 160 113 163 92 Q 165 68 152 52"
                                            fill="none"
                                            stroke="rgba(13, 71, 161, 0.2)"
                                            strokeWidth="3"
                                        />

                                        {/* Primary light reflection - left side */}
                                        <ellipse
                                            cx="55"
                                            cy="65"
                                            rx="16"
                                            ry="32"
                                            fill="white"
                                            opacity="0.45"
                                            filter={`url(#glassDistort-${bucket.id})`}
                                        />

                                        {/* Secondary light reflection - center left */}
                                        <ellipse
                                            cx="75"
                                            cy="95"
                                            rx="14"
                                            ry="24"
                                            fill="rgba(255, 255, 255, 0.3)"
                                        />

                                        {/* Tertiary reflection - right side softer */}
                                        <ellipse
                                            cx="140"
                                            cy="75"
                                            rx="13"
                                            ry="28"
                                            fill="rgba(179, 229, 252, 0.35)"
                                        />

                                        {/* Bottom curve - rounded base */}
                                        <ellipse
                                            cx="100"
                                            cy="143"
                                            rx="38"
                                            ry="10"
                                            fill="rgba(13, 71, 161, 0.2)"
                                        />

                                        {/* Bottom highlight - rounded bottom */}
                                        <ellipse
                                            cx="100"
                                            cy="140"
                                            rx="36"
                                            ry="8"
                                            fill="rgba(227, 242, 253, 0.4)"
                                        />

                                        {/* Glass surface shine spots */}
                                        <g opacity="0.65">
                                            <circle cx="52" cy="60" r="2.5" fill="white" />
                                            <circle cx="90" cy="70" r="2" fill="white" />
                                            <circle cx="145" cy="65" r="2" fill="white" />
                                        </g>
                                    </svg>

                                    {/* Bucket Label - Editable for trainers only */}
                                    <div
                                        className="bucket-label"
                                        style={{
                                            backgroundColor: bucket.color || bucketColor,
                                            pointerEvents: isTrainer ? 'auto' : 'none',
                                            cursor: editingBucketId !== bucket.id ? 'pointer' : 'default',
                                            // place label at the top of the bowl (slightly above the rim)
                                            top: `-${bucket.height * 0.12}px`
                                        }}
                                    >
                                        <span
                                            onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (!isTrainer) return;
                                                handleBucketLabelClick(bucket, e);
                                            }}
                                            style={{ cursor: editingBucketId !== bucket.id ? 'pointer' : 'default' }}
                                        >
                                            {editingBucketId === bucket.id ? (
                                                <input
                                                    type="text"
                                                    value={editingBucketLabel}
                                                    onChange={handleBucketLabelChange}
                                                    onBlur={handleBucketLabelBlur}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleBucketLabelBlur()}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    className="bucket-input"
                                                    style={{ backgroundColor: bucket.color || bucketColor }}
                                                />
                                            ) : (
                                                <span>{bucket.label}</span>
                                            )}
                                        </span>

                                        {/* Remove Bucket Button */}
                                        {isTrainer && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeBucket(bucket.id);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="bucket-close-button"
                                                title="Remove Bucket"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>

                                    {/* Resize Handle Visual (Trainer only) - Larger and more visible */}
                                    {isTrainer && (
                                        <div
                                            className="bucket-color-indicator"
                                            style={{
                                                backgroundColor: bucket.color || bucketColor,
                                                pointerEvents: 'auto',
                                                width: `${dotSize}px`,
                                                height: `${dotSize}px`,
                                                left: `${Math.round(anchorPx - dotSize / 2)}px`,
                                                top: `${Math.round(anchorPy - dotSize / 2)}px`,
                                                transform: 'translate(0,0)',
                                                cursor: 'nwse-resize',
                                                border: `${borderPx}px solid white`,
                                                borderRadius: '9999px'
                                            }}
                                            title="Drag to resize"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSelectedItems([{ ...bucket, type: 'bucket' }]);
                                                setIsResizingItem(true);
                                                prevPosRef.current = { x: e.clientX - canvasRef.current.getBoundingClientRect().left, y: e.clientY - canvasRef.current.getBoundingClientRect().top };
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}

                        {/* Fill-in-the-blanks exercises removed */}

                        {/* REACTION BUTTONS - Show button labels */}
                        {canvasItems.filter(item => item.type === 'reaction').map(reaction => (
                            <div
                                key={reaction.id}
                                style={{
                                    position: 'absolute',
                                    left: `${reaction.x}px`,
                                    top: `${reaction.y}px`,
                                    padding: '8px 12px',
                                    backgroundColor: '#f0f0f0',
                                    border: '2px solid #333',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    zIndex: 50,
                                    pointerEvents: 'none',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                                }}
                            >
                                {reaction.label}
                            </div>
                        ))}

                        {/* BUBBLES ANIMATION */}
                        {!hasActiveFloatingAnimation('bubble') && canvasItems.filter(item => item.type === 'animation' && item.animationType === 'bubbles').map((animation, idx) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={`bubble-${idx}-${i}`} className="bubble" style={{ bottom: '0%' }} />
                                ))}
                            </div>
                        ))}

                        {/* SMILEYS ANIMATION */}
                        {!hasActiveFloatingAnimation('smiley') && canvasItems.filter(item => item.type === 'animation' && item.animationType === 'smileys').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%', bottom: '0' }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={`smiley-${animation.id}-${i}`} className="smiley" style={{ bottom: '0%' }}>
                                        <Emoji emoji="😊" size="3xl" />
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* BALLOONS ANIMATION */}
                        {!hasActiveFloatingAnimation('balloon') && canvasItems.filter(item => item.type === 'animation' && item.animationType === 'balloons').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%', bottom: '0' }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={`balloon-${animation.id}-${i}`} className="balloon" style={{ bottom: '0%' }} />
                                ))}
                            </div>
                        ))}

                        {/* STARS ANIMATION */}
                        {!hasActiveFloatingAnimation('star') && canvasItems.filter(item => item.type === 'animation' && item.animationType === 'stars').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                    <div key={`star-${animation.id}-${i}`} className="star">
                                        <Emoji emoji="⭐" size="3xl" />
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* FEEDBACK ANIMATION (Wait emoji) */}
                        {canvasItems.filter(item => item.type === 'feedback_animation').map((animation) => (
                            <div
                                key={animation.id}
                                style={{
                                    position: 'absolute',
                                    left: `${animation.x}px`,
                                    top: `${animation.y}px`,
                                    width: `${animation.width}px`,
                                    height: `${animation.height}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '72px',
                                    animation: 'pulse 1s ease-in-out infinite',
                                    background: 'linear-gradient(135deg, rgba(255,240,245,0.8) 0%, rgba(240,255,250,0.8) 100%)',
                                    borderRadius: '50%',
                                    border: '4px solid rgba(255,255,255,0.8)',
                                    boxShadow: '0 6px 20px rgba(220,200,255,0.35)',
                                    zIndex: 100,
                                    pointerEvents: 'none'
                                }}
                            >
                                <Emoji emoji={animation.emoji} size="3xl" />
                            </div>
                        ))}

                        {/* FEEDBACK MESSAGE DISPLAY */}
                        {feedbackMessage && (
                            <div
                                className="feedback-bubble"
                                role="status"
                                aria-live="polite"
                            >
                                {/* Decorative confetti dots - friendly pastel colors */}
                                <div className="confetti-container" aria-hidden="true">
                                    <div className="confetti-dot confetti-1" />
                                    <div className="confetti-dot confetti-2" />
                                    <div className="confetti-dot confetti-3" />
                                    <div className="confetti-dot confetti-4" />
                                    <div className="confetti-dot confetti-5" />
                                </div>
                                <div className="feedback-text">{feedbackMessage}</div>
                            </div>
                        )}

                        {/* WAITING MESSAGE DISPLAY */}
                        {waitingMessage && (
                            <div
                                className="waiting-bubble"
                                role="status"
                                aria-live="polite"
                            >
                                <div className="waiting-spinner" />
                                <div className="waiting-text">{waitingMessage}</div>
                            </div>
                        )}

                        {/* FLOATING ANIMATIONS (Bubbles, Smileys, Balloons, Stars) */}
                        {floatingAnimations.map((animation) => (
                            <div
                                key={animation.id}
                                className={`floating-animation ${animation.type} ${animation.popped ? 'popped' : ''}`}
                                style={{
                                    left: `${animation.x}%`,
                                    animationDelay: `${animation.startDelay}ms`,
                                    animationDuration: `${animation.duration}ms`,
                                    cursor: !isTrainer && !animation.popped ? 'pointer' : 'default',
                                    pointerEvents: animation.popped ? 'none' : (!isTrainer ? 'auto' : 'none'),
                                }}
                                onClick={(e) => {
                                    if (!isTrainer && !animation.popped) {
                                        // Get current position before popping
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const poppedLeft = rect.left + (rect.width / 2);
                                        const poppedTop = rect.top + (rect.height / 2);
                                        console.log('Star clicked at:', poppedLeft, poppedTop);
                                        onAnimationPop(animation.id, poppedLeft, poppedTop);
                                    }
                                }}
                            >
                                {!animation.popped ? (
                                    <span className="floating-emoji">
                                        {animation.asset?.type === 'svg' && animation.asset?.src ? (
                                            <img
                                                src={animation.asset.src}
                                                alt={animation.asset.alt || animation.type}
                                                loading="lazy"
                                            />
                                        ) : (
                                            <Emoji emoji={animation.emoji || '✨'} size="clamp(40px, 3vw, 80px)" />
                                        )}
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>

                    {/* Sparkle Effects for Popped Stars */}
                    {floatingAnimations
                        .filter(animation => animation.popped && animation.type === 'star' && animation.poppedLeft && animation.poppedTop)
                        .map((animation) => {
                            // Generate sparkle particles with varied properties for organic feel
                            const sparkleCount = 20;
                            const sparkles = Array.from({ length: sparkleCount }, (_, i) => ({
                                angle: (360 / sparkleCount) * i,
                                delay: i * 0.04,
                                distance: 90 + (i % 4) * 15, // Varied distance for depth
                                size: 1.2 + (i % 3) * 0.3 // Varied size multiplier
                            }));

                            return (
                                <div
                                    key={`sparkle-${animation.id}`}
                                    style={{
                                        position: 'fixed',
                                        left: `${animation.poppedLeft}px`,
                                        top: `${animation.poppedTop}px`,
                                        pointerEvents: 'none',
                                        zIndex: 10000,
                                        width: '0',
                                        height: '0',
                                        willChange: 'transform'
                                    }}
                                >
                                    {/* Radiating Diamond Sparkles - Main Wave */}
                                    {sparkles.map((sparkle, index) => (
                                        <div
                                            key={index}
                                            className="sparkle-particle"
                                            style={{
                                                '--angle': `${sparkle.angle}deg`,
                                                '--distance': `${sparkle.distance}px`,
                                                '--delay': `${sparkle.delay}s`,
                                                '--size': sparkle.size
                                            }}
                                        />
                                    ))}

                                    {/* Secondary Wave of Diamond Sparkles */}
                                    {sparkles.slice(0, 10).map((sparkle, index) => (
                                        <div
                                            key={`wave2-${index}`}
                                            className="sparkle-particle sparkle-wave-2"
                                            style={{
                                                '--angle': `${sparkle.angle + 18}deg`,
                                                '--distance': `${sparkle.distance * 0.65}px`,
                                                '--delay': `${sparkle.delay + 0.2}s`,
                                                '--size': sparkle.size * 0.8
                                            }}
                                        />
                                    ))}
                                </div>
                            );
                        })}

                    {/* TEXT BOXES - Invisible container, only text and cursor visible */}
                    {textBoxes.map((textBox) => (
                        <div
                            key={textBox.id}
                            className="text-box-container"
                            style={{
                                position: 'absolute',
                                left: textBox.x,
                                top: textBox.y,
                                width: 'auto',
                                height: 'auto',
                                minWidth: '100px',
                                maxWidth: '800px',
                                border: activeTextBoxId === textBox.id ? '2px dashed #3b82f6' : 'none',
                                backgroundColor: 'transparent',
                                padding: activeTextBoxId === textBox.id ? '4px' : '0',
                                cursor: activeTextBoxId === textBox.id ? 'move' : 'text',
                                zIndex: activeTextBoxId === textBox.id ? 1000 : 50,
                                transition: 'border 0.1s, padding 0.1s',
                                display: 'inline-block'
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isTrainer) {
                                    setActiveTextBoxId(textBox.id);
                                }
                            }}
                            onMouseDown={(e) => {
                                if (isTrainer && activeTextBoxId === textBox.id && e.target.tagName !== 'TEXTAREA') {
                                    e.preventDefault();
                                    const startX = e.clientX - textBox.x;
                                    const startY = e.clientY - textBox.y;
                                    
                                    const handleMouseMove = (moveEvent) => {
                                        onTextBoxMove(
                                            textBox.id,
                                            moveEvent.clientX - startX,
                                            moveEvent.clientY - startY
                                        );
                                    };
                                    
                                    const handleMouseUp = () => {
                                        document.removeEventListener('mousemove', handleMouseMove);
                                        document.removeEventListener('mouseup', handleMouseUp);
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                }
                            }}
                        >
                            {isTrainer && (
                                <button
                                    className="text-box-remove-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveTextBox(textBox.id);
                                    }}
                                    style={{
                                    position: 'absolute',
                                    top: '-8px',
                                    right: '-8px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    border: 'none',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 10,
                                    opacity: activeTextBoxId === textBox.id ? 1 : 0,
                                    transition: 'opacity 0.2s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                                title="Remove text box"
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                >
                                    ×
                                </button>
                            )}
                            <textarea
                                ref={(el) => {
                                    if (el && textBox.text) {
                                        // Auto-resize textarea for all users when content changes
                                        el.style.height = 'auto';
                                        el.style.height = el.scrollHeight + 'px';
                                    }
                                }}
                                value={textBox.text}
                                onChange={(e) => {
                                    if (isTrainer) {
                                        onTextBoxChange(textBox.id, e.target.value);
                                        // Auto-resize textarea
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }
                                }}
                                onInput={(e) => {
                                    if (isTrainer) {
                                        // Auto-resize on input
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }
                                }}
                                readOnly={!isTrainer}
                                placeholder={isTrainer ? "Type here..." : ""}
                                style={{
                                    width: 'auto',
                                    minWidth: '100px',
                                    maxWidth: '800px',
                                    height: 'auto',
                                    minHeight: '24px',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: `${textBox.fontSize}px`,
                                    color: textBox.fontColor,
                                    backgroundColor: 'transparent',
                                    resize: 'none',
                                    fontFamily: 'Arial, sans-serif',
                                    lineHeight: '1.5',
                                    caretColor: textBox.fontColor || '#000000',
                                    overflow: 'hidden',
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word',
                                    pointerEvents: isTrainer ? 'auto' : 'none'
                                }}
                            />
                        </div>
                    ))}

                    {/* Media Popup for Video/PDF */}
                    {mediaControl.currentMedia.isVisible && (
                        <MediaPopup
                            mediaId={mediaControl.currentMedia.mediaId}
                            mediaType={mediaControl.currentMedia.mediaType}
                            mediaUrl={mediaControl.currentMedia.mediaUrl}
                            status={mediaControl.currentMedia.status}
                            currentTime={mediaControl.currentMedia.currentTime}
                            currentPage={mediaControl.currentMedia.currentPage}
                            isTrainer={isTrainer}
                            isFullscreen={false}
                            onClose={() => mediaControl.closeMedia()}
                            onPlay={(data) => {
                                if (isTrainer) {
                                    mediaControl.playMedia(data.mediaId);
                                }
                            }}
                            onPause={(data) => {
                                if (isTrainer) {
                                    mediaControl.pauseMedia(data.mediaId);
                                }
                            }}
                            onSeek={(data) => {
                                if (isTrainer) {
                                    mediaControl.seekMedia(data.mediaId, data.currentTime);
                                }
                            }}
                            onPageChange={(data) => {
                                if (isTrainer) {
                                    mediaControl.changePageMedia(data.mediaId, data.page);
                                }
                            }}
                        />
                    )}
                </div>

            </div>

            {/* Pinch-to-Resize Indicator */}
            {pinchToResizeActive && (
                <div className="pinch-resize-indicator">
                    🤏 Pinch to resize
                </div>
            )}
        </div>
    );

};


export default Whiteboard;