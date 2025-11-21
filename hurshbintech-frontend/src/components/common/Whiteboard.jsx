import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import './Whiteboard.css';
import appleImage from '../../assets/Red_Apple.jpg';
import bananaImage from '../../assets/banana.jpeg';
import MediaPopup from './MediaPopup';
import { useMediaControl } from '../../context/MediaControlContext';

// Memoized Video Overlay Component
const VideoOverlay = React.memo(({
    item,
    isSelectedByTrainer,
    isSelectedByLearner,
    isSelectedByRemoteLearner,
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
            position: 'absolute'
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
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick
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
            border: isSelectedByTrainer || isSelectedByLearner || isSelectedByRemoteLearner
                ? `3px solid ${isSelectedByRemoteLearner ? '#4caf50' : isSelectedByTrainer ? '#007bff' : '#4caf50'}`
                : 'none',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: '#f5f5f5',
            position: 'absolute'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
    >
        {/* PDF Icon and Label */}
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
            <div className="text-5xl mb-2">📄</div>
            <div className="text-center text-gray-700 text-sm font-semibold px-2 line-clamp-2">
                {item.src ? item.src.split('/').pop() : 'PDF Document'}
            </div>
            <div className="text-xs text-gray-500 mt-2">Double-click to open</div>
        </div>

        {/* Selection Indicators */}
        {isSelectedByRemoteLearner && (
            <div className="absolute -top-6 left-0 text-green-500 text-sm font-bold">
                👤 Learner
            </div>
        )}
        {isSelectedByLearner && (
            <div className="absolute -top-6 left-0 text-green-500 text-sm font-bold">
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
    onMouseDown: PropTypes.func,
    onMouseMove: PropTypes.func,
    onMouseUp: PropTypes.func,
    onDoubleClick: PropTypes.func
};

// Memoized Image Overlay Component - for images that can be dragged to sidebar
const ImageOverlay = React.memo(({
    item,
    isSelectedByTrainer,
    isSelectedByLearner,
    isSelectedByRemoteLearner,
    isAnimating,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onDragStart
}) => (
    <div
        key={`image-${item.id}`}
        className={`absolute group ${isAnimating ? 'bucket-drop-animation' : ''}`}
        draggable={isSelectedByTrainer || isSelectedByLearner}
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
            border: isSelectedByTrainer || isSelectedByLearner || isSelectedByRemoteLearner
                ? `3px solid ${isSelectedByRemoteLearner ? '#4caf50' : isSelectedByTrainer ? '#007bff' : '#4caf50'}`
                : '2px solid #ccc',
            borderRadius: '4px',
            overflow: 'hidden',
            cursor: isSelectedByTrainer || isSelectedByLearner ? 'grab' : 'pointer',
            backgroundColor: '#f5f5f5',
            position: 'absolute',
            userSelect: 'none',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
            boxShadow: isSelectedByTrainer || isSelectedByLearner ? '0 8px 16px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
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
                console.error('[Whiteboard] Failed to load image:', item.src);
                e.target.style.display = 'none';
            }}
            draggable={false}
        />

        {/* Selection Indicators */}
        {isSelectedByRemoteLearner && (
            <div className="absolute -top-6 left-0 text-green-500 text-sm font-bold">
                👤 Learner
            </div>
        )}
        {isSelectedByLearner && (
            <div className="absolute -top-6 left-0 text-green-500 text-sm font-bold">
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
    onMouseDown: PropTypes.func,
    onMouseMove: PropTypes.func,
    onMouseUp: PropTypes.func,
    onDoubleClick: PropTypes.func,
    onDragStart: PropTypes.func
};

// Helper function to lighten a hex color
const lightenColor = (color, percent = 30) => {
    const usePound = color[0] === "#";
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return (usePound ? "#" : "") + (0x1000000 + (R < 256 ? R < 0 ? 0 : R : 255) * 0x10000 +
        (G < 256 ? G < 0 ? 0 : G : 255) * 0x100 +
        (B < 256 ? B < 0 ? 0 : B : 255))
        .toString(16)
        .slice(1);
};

const Whiteboard = ({
    whiteboardService,
    isTrainer,
    canvasItems = [],
    setCanvasItems,
    toolAccess = { select: false, drag: false },
    learnerSelectedItemId = null,
    textMessages = [],
    setTextMessages = () => { },
    tool = 'pen',
    setTool = () => { },
    color = '#000000',
    setColor = () => { },
    lineWidth = 2,
    setLineWidth = () => { },
    bucketColor = '#9333ea',
    setBucketColor = () => { },
    buckets = [],
    setBuckets = () => { },
    isPaused = false,
    isFrozen = false,
    keyboardMode = false,
    keyboardText = '',
    setKeyboardText = () => { },
    keyboardPosition = { x: 0, y: 0 },
    setKeyboardPosition = () => { },
    clearCanvasTrigger = 0,
    erasePenTrigger = 0,
    redrawCanvasTrigger = 0
}) => {
    // Media control state management
    const mediaControl = useMediaControl();

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

    // Handle opening media (video/PDF)
    const handleMediaOpen = useCallback((item) => {
        if (isVideoItem(item) || isPdfItem(item)) {
            const mediaType = isVideoItem(item) ? 'video' : 'pdf';
            const mediaUrl = item.src;
            const mediaId = item.id;

            console.log('[Whiteboard] Opening media:', { mediaId, mediaType, mediaUrl });

            // Open media popup through MediaControlContext
            mediaControl.openMedia(mediaId, mediaType, mediaUrl);
        }
    }, [isVideoItem, isPdfItem, mediaControl]);

    const canvasRef = useRef(null);
    const prevPosRef = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    // const [canvasItems, setCanvasItems] = useState([]);
    const [draggedItem, setDraggedItem] = useState(null);
    const [isDraggingItem, setIsDraggingItem] = useState(false);
    const [isResizingItem, setIsResizingItem] = useState(false);
    const [resizingVideo, setResizingVideo] = useState(null); // For video/item resizing
    const [selectedItem, setSelectedItem] = useState(null);
    const [editingBucketId, setEditingBucketId] = useState(null);
    const [editingBucketLabel, setEditingBucketLabel] = useState('');
    const [animatingItemId, setAnimatingItemId] = useState(null); // For drop animation

    // Inline video state for 50-50 split mode
    const [inlineVideo, setInlineVideo] = useState(null); // { id, src, title }
    const inlineVideoRef = useRef(null);

    // Image caching system for performance
    const imageCacheRef = useRef(new Map());
    const [imageLoadQueue, setImageLoadQueue] = useState(new Set());

    const [materialsList, setMaterialsList] = useState([]);

    // const appleImage = require('../../assets/red_apple.jpeg');
    // const bananaImage = require('../../assets/banana.jpg');


    const availableItems = [
        { id: 'apple', name: 'Apple', src: appleImage },
        { id: 'banana', name: 'Banana', src: bananaImage },
        // { id: 'circle', name: 'Circle', src: null, shape: 'circle' },
        // { id: 'square', name: 'Square', src: null, shape: 'square' },
    ];

    const filteredItems = availableItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
        } catch (e) {
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
                console.error('[Whiteboard] Failed to load image:', src, err);
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
            } catch (error) {
                // console.warn('[Whiteboard] Some images failed to preload:', error);
            }
        }
    }, [loadImageToCache, isVideoItem]);

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
                                    console.log('[Whiteboard] Auto-opening media on add:', { id: data.id, mediaType });
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
                console.log('[Whiteboard] Item update received:', data);
                
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
                            inBucket: data.inBucket !== undefined ? data.inBucket : item.inBucket
                        }
                        : item
                ));
            };

            whiteboardService.onItemRemove = (data) => {
                console.log('[Whiteboard] Item removed:', data);
                setCanvasItems(prev => prev.filter(item => item.id !== data.id));
            };

            /* Inline video/media handler moved to consolidated onMediaControl handler below. */

            whiteboardService.onBucketAdded = (data) => {
                console.log('[Whiteboard] Bucket added:', data);
                setBuckets(prev => {
                    const exists = prev.find(bucket => bucket.id === data.id);
                    if (!exists) {
                        return [...prev, data];
                    }
                    return prev;
                });
            };

            whiteboardService.onBucketUpdate = (data) => {
                console.log('[Whiteboard] Bucket updated:', data);
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
                console.log('[Whiteboard] Text added:', data);
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
                console.log('[Whiteboard] Video state received:', data);
                // Apply video state synchronization from trainer to learners
                setVideoStates(prev => ({
                    ...prev,
                    [data.videoId]: {
                        ...prev[data.videoId],
                        isPlaying: data.isPlaying
                    }
                }));
            };

            whiteboardService.onMediaControl = (data) => {
                console.log('[Whiteboard] Media control event received:', data);

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
                    console.warn('[Whiteboard] mediaControl.handleMediaControlEvent error:', err);
                }

                // Additionally support inline split-video synchronization for play/pause/seek/close
                if (!data || !data.action) return;
                const action = data.action;
                if (action === 'close') {
                    setInlineVideo(null);
                    if (inlineVideoRef.current) {
                        try { inlineVideoRef.current.pause(); } catch (e) { }
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
                console.warn('[Whiteboard] Could not preserve canvas data during resize:', error.message);
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
    }, [canvasItems]);

    // Redraw when learner selection changes (remote or local) - also debounced
    useEffect(() => {
        const timer = setTimeout(() => {
            redrawCanvas();
        }, 16);
        return () => clearTimeout(timer);
    }, [learnerSelectedItemId, selectedItem]);

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
                    const isSelectedByTrainer = isTrainer && selectedItem && selectedItem.id === item.id;
                    const isSelectedByLearner = !isTrainer && selectedItem && selectedItem.id === item.id;
                    const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemId === item.id;

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
    }, [canvasItems, isTrainer, selectedItem, learnerSelectedItemId, color, isVideoItem, isPdfItem, preloadImages]);

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

    const drawImageOnCanvas = (data) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Allow cross-origin images

        img.onload = () => {
            ctx.drawImage(img, data.x, data.y, data.width, data.height);
        };

        img.src = data.src;
    };



    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Bucket functions
    const addBucket = () => {
        // Calculate position for new bucket (place next to previous one)
        const lastBucket = buckets[buckets.length - 1];
        const newX = lastBucket ? lastBucket.x + lastBucket.width + 20 : 100;
        const newY = lastBucket ? lastBucket.y : 100;

        const newBucket = {
            id: Date.now(),
            x: newX,
            y: newY,
            width: 150,
            height: 150,
            label: 'Bucket',
            color: bucketColor,
            items: [] // Items inside bucket
        };
        setBuckets(prev => [...prev, newBucket]);

        // Send to other participants
        whiteboardService?.send('bucket_added', newBucket);
    };

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
        if (selectedItem && selectedItem.id === itemId) {
            setSelectedItem(null);
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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on a bucket (trainer only can drag buckets)
        if (isTrainer) {
            const bucket = getBucketAtPosition(x, y);
            if (bucket) {
                // Check if clicking on resize handle
                if (isBucketResizeHandle(x, y, bucket)) {
                    setSelectedItem({ ...bucket, type: 'bucket' });
                    setIsResizingItem(true);
                    prevPosRef.current = { x, y };
                    e.preventDefault();
                    return;
                }

                // Otherwise, drag the bucket
                setSelectedItem({ ...bucket, type: 'bucket' });
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

                // Select the item (required for both select and drag)
                setSelectedItem(itemWithOriginalSize);

                // Send selection to trainer via websocket
                if (whiteboardService) {
                    whiteboardService.send('item_selected', {
                        itemId: item.id,
                        selectedBy: 'learner',
                        timestamp: Date.now()
                    });
                }

                // Check if learner can also drag
                if (toolAccess.drag) {
                    if (isResizeHandle(x, y, item)) {
                        setIsResizingItem(true);
                    } else {
                        setIsDraggingItem(true);
                    }
                    prevPosRef.current = { x, y };
                }
                return;
            }

            // Trainer has full access
            setSelectedItem(itemWithOriginalSize);
            if (isResizeHandle(x, y, item)) {
                setIsResizingItem(true);
            } else {
                setIsDraggingItem(true);
            }
            prevPosRef.current = { x, y };
            return;
        }

        // Only trainer can draw
        if (!isTrainer) return;

        setIsDrawing(true);
        prevPosRef.current = { x, y };

        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const currX = e.clientX - rect.left;
        const currY = e.clientY - rect.top;

        // Handle video resizing
        if (resizingVideo) {
            if (!isTrainer) return;

            const dx = currX - prevPosRef.current.x;
            const dy = currY - prevPosRef.current.y;

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
            setCanvasItems(newItems);

            // Send update to other participants
            whiteboardService?.sendItemUpdate({
                id: resizingVideo.id,
                x: updatedVideo.x,
                y: updatedVideo.y,
                width: updatedVideo.width,
                height: updatedVideo.height
            });

            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Handle dragging buckets (trainer only)
        if (isDraggingItem && selectedItem && selectedItem.type === 'bucket') {
            if (!isTrainer) return;

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
            setCanvasItems(updatedItems);

            setBuckets(prev => prev.map(bucket =>
                bucket.id === selectedItem.id ? updatedBucket : bucket
            ));
            setSelectedItem(updatedBucket);

            // Send update to other participants
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

            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Handle dragging items (for both trainer and learner with permission)
        if (isDraggingItem && selectedItem && selectedItem.type !== 'bucket') {
            // Learners need drag permission
            if (!isTrainer && !toolAccess.drag) {
                return;
            }

            const dx = currX - prevPosRef.current.x;
            const dy = currY - prevPosRef.current.y;
            const updatedItem = {
                ...selectedItem,
                x: selectedItem.x + dx,
                y: selectedItem.y + dy
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
            setCanvasItems(newItems);
            setSelectedItem(updatedItem);

            // Send update to other participants
            whiteboardService?.sendItemUpdate({
                id: selectedItem.id,
                x: updatedItem.x,
                y: updatedItem.y,
                width: updatedItem.width,
                height: updatedItem.height,
                inBucket: updatedItem.inBucket || null
            });
            prevPosRef.current = { x: currX, y: currY };
            return;
        }

        // Handle resizing items (for both trainer and learner with permission)
        if (isResizingItem && selectedItem) {
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

                setBuckets(prev => prev.map(bucket =>
                    bucket.id === selectedItem.id ? updatedBucket : bucket
                ));
                setSelectedItem(updatedBucket);

                // Send update to other participants
                whiteboardService?.send('bucket_update', updatedBucket);

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
            setCanvasItems(newItems);
            setSelectedItem(updatedItem);
            // Don't call redrawCanvas here - state update triggers redraw via useEffect
            whiteboardService?.sendItemUpdate({
                id: selectedItem.id,
                x: updatedItem.x,
                y: updatedItem.y,
                width: updatedItem.width,
                height: updatedItem.height
            });
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
        // No need to check bucket on stop - it's handled in draw() in real-time
        setIsDrawing(false);
        setIsDraggingItem(false);
        setIsResizingItem(false);
        setResizingVideo(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
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
            if (!fullUrl.startsWith('http')) {
                // It's a relative URL like /uploads/learning_content/file.png
                // Use the same backend URL that the frontend uses
                const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                fullUrl = `${backendUrl}${fullUrl}`;
                fileUrl = `${backendUrl}${droppedData.url}`; // Store full URL
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

    const handleDragOver = (e) => {
        e.preventDefault();
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
            {/* Text Messages Display - Top of Whiteboard */}
            {textMessages.length > 0 && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-[600px] space-y-2">
                    {textMessages.map((msg, index) => (
                        <div
                            key={msg.id}
                            className="bg-blue-600 text-white px-6 py-4 rounded-lg shadow-xl animate-fade-in border-2 border-blue-400"
                            style={{
                                animationDelay: `${index * 100}ms`,
                                opacity: 0.95
                            }}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <span className="text-2xl">💬</span>
                                        <span className="font-bold text-base">{msg.sender}</span>
                                    </div>
                                    <div className="text-base font-medium leading-relaxed">{msg.text}</div>
                                </div>
                                <button
                                    onClick={() => setTextMessages(prev => prev.filter(m => m.id !== msg.id))}
                                    className="text-white hover:text-red-200 text-2xl leading-none font-bold px-2 flex-shrink-0"
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
                            controls={isTrainer}
                            onPlay={handleVideoPlay}
                            onPause={handleVideoPause}
                            onSeeked={handleVideoSeeked}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                // backgroundColor: '#000'
                            }}
                        />
                        {isTrainer && (
                            <button
                                onClick={handleVideoClose}
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 z-30"
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
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
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
                            const isSelectedByTrainer = isTrainer && selectedItem && selectedItem.id === item.id;
                            const isSelectedByLearner = !isTrainer && selectedItem && selectedItem.id === item.id;
                            const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemId === item.id;

                            return (
                                <div key={`pdf-wrapper-${item.id}`}>
                                    <PDFOverlay
                                        item={item}
                                        isSelectedByTrainer={isSelectedByTrainer}
                                        isSelectedByLearner={isSelectedByLearner}
                                        isSelectedByRemoteLearner={isSelectedByRemoteLearner}
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
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            handleMediaOpen(item);
                                        }}
                                    />

                                    {/* Resize Handle for Trainer */}
                                    {isSelectedByTrainer && (
                                        <div
                                            className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize"
                                            style={{
                                                left: `${item.x + item.width - 2}px`,
                                                top: `${item.y + item.height - 2}px`,
                                                zIndex: 21
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setSelectedItem(item);
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
                                            className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 border-2 border-white shadow-md"
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
                            const isSelectedByTrainer = isTrainer && selectedItem && selectedItem.id === item.id;
                            const isSelectedByLearner = !isTrainer && selectedItem && selectedItem.id === item.id;
                            const isSelectedByRemoteLearner = isTrainer && learnerSelectedItemId === item.id;

                            return (
                                <div key={`image-wrapper-${item.id}`}>
                                    <ImageOverlay
                                        item={item}
                                        isSelectedByTrainer={isSelectedByTrainer}
                                        isSelectedByLearner={isSelectedByLearner}
                                        isSelectedByRemoteLearner={isSelectedByRemoteLearner}
                                        isAnimating={animatingItemId === item.id}
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
                                                e.dataTransfer.dropEffect = 'move';
                                                e.dataTransfer.setData('application/json', JSON.stringify(dragPayload));

                                                // Add smooth drag visual feedback
                                                const dragImage = new Image();
                                                dragImage.src = item.src;
                                                dragImage.onload = () => {
                                                    try {
                                                        e.dataTransfer.setDragImage(dragImage, 50, 50);
                                                    } catch (err) {
                                                        console.warn('[Whiteboard] Could not set drag image:', err);
                                                    }
                                                };
                                            } catch (error) {
                                                console.error('[Whiteboard] Error preparing drag payload:', error);
                                            }
                                        }}
                                    />

                                    {/* Resize Handle for Trainer */}
                                    {isSelectedByTrainer && (
                                        <div
                                            className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize"
                                            style={{
                                                left: `${item.x + item.width - 2}px`,
                                                top: `${item.y + item.height - 2}px`,
                                                zIndex: 21
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setSelectedItem(item);
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
                                            className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 border-2 border-white shadow-md"
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
                        {buckets.map(bucket => (
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
                                {/* Fish Pot Shape - Visual representation of a fish pot/container */}
                                <svg width={bucket.width} height={bucket.height} style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${bucket.width} ${bucket.height}`}>
                                    <defs>
                                        {/* Upper section - Cyan glass gradient */}
                                        <linearGradient id={`upperGradient-${bucket.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" style={{ stopColor: '#a8e6e1', stopOpacity: 0.6 }} />
                                            <stop offset="50%" style={{ stopColor: '#7dd3c0', stopOpacity: 0.7 }} />
                                            <stop offset="100%" style={{ stopColor: '#a8e6e1', stopOpacity: 0.6 }} />
                                        </linearGradient>

                                        {/* Water fill - Salmon/coral gradient */}
                                        <linearGradient id={`waterGradient-${bucket.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style={{ stopColor: '#f08778', stopOpacity: 0.85 }} />
                                            <stop offset="50%" style={{ stopColor: '#e85d4d', stopOpacity: 0.9 }} />
                                            <stop offset="100%" style={{ stopColor: '#d94037', stopOpacity: 0.85 }} />
                                        </linearGradient>
                                    </defs>

                                    {/* Fish Pot Shape - Visual representation of a fish pot/container */}
                                    <g>
                                        {/* Pot Rim - Solid turquoise top edge */}
                                        <rect
                                            x={bucket.width * 0.15}
                                            y={bucket.height * 0.1}
                                            width={bucket.width * 0.7}
                                            height={bucket.height * 0.08}
                                            rx={bucket.height * 0.04}
                                            fill="#7dd3c0"
                                            opacity="0.9"
                                        />

                                        {/* Pot rim inner shadow */}
                                        <rect
                                            x={bucket.width * 0.16}
                                            y={bucket.height * 0.12}
                                            width={bucket.width * 0.68}
                                            height={bucket.height * 0.04}
                                            rx={bucket.height * 0.02}
                                            fill="rgba(0, 0, 0, 0.1)"
                                        />

                                        {/* Upper pot body - Cyan/Turquoise glass section */}
                                        <path
                                            d={`M ${bucket.width * 0.15} ${bucket.height * 0.18} 
                                                L ${bucket.width * 0.08} ${bucket.height * 0.45}
                                                L ${bucket.width * 0.08} ${bucket.height * 0.52}
                                                L ${bucket.width * 0.92} ${bucket.height * 0.52}
                                                L ${bucket.width * 0.92} ${bucket.height * 0.45}
                                                L ${bucket.width * 0.85} ${bucket.height * 0.18} Z`}
                                            fill={`url(#upperGradient-${bucket.id})`}
                                            stroke="#6dd5f0"
                                            strokeWidth="2"
                                        />

                                        {/* Water level line - Clear horizontal division */}
                                        <line
                                            x1={bucket.width * 0.08}
                                            y1={bucket.height * 0.52}
                                            x2={bucket.width * 0.92}
                                            y2={bucket.height * 0.52}
                                            stroke="#e85d4d"
                                            strokeWidth="2.5"
                                            opacity="0.8"
                                        />

                                        {/* Lower pot body - Salmon/Coral water fill */}
                                        <path
                                            d={`M ${bucket.width * 0.08} ${bucket.height * 0.52}
                                                L ${bucket.width * 0.05} ${bucket.height * 0.75}
                                                Q ${bucket.width * 0.05} ${bucket.height * 0.92} ${bucket.width * 0.5} ${bucket.height * 0.98}
                                                Q ${bucket.width * 0.95} ${bucket.height * 0.92} ${bucket.width * 0.95} ${bucket.height * 0.75}
                                                L ${bucket.width * 0.92} ${bucket.height * 0.52} Z`}
                                            fill={`url(#waterGradient-${bucket.id})`}
                                            stroke="#d94037"
                                            strokeWidth="2"
                                        />

                                        {/* Left edge highlight - glass shine */}
                                        <path
                                            d={`M ${bucket.width * 0.15} ${bucket.height * 0.18} 
                                                L ${bucket.width * 0.08} ${bucket.height * 0.45}
                                                Q ${bucket.width * 0.07} ${bucket.height * 0.65} ${bucket.width * 0.1} ${bucket.height * 0.8}`}
                                            fill="none"
                                            stroke="rgba(255, 255, 255, 0.4)"
                                            strokeWidth="3"
                                            opacity="0.6"
                                        />

                                        {/* Left water edge - darker shadow */}
                                        <path
                                            d={`M ${bucket.width * 0.1} ${bucket.height * 0.52}
                                                Q ${bucket.width * 0.07} ${bucket.height * 0.7} ${bucket.width * 0.08} ${bucket.height * 0.85}`}
                                            fill="none"
                                            stroke="rgba(139, 63, 56, 0.4)"
                                            strokeWidth="2.5"
                                        />

                                        {/* Right edge shadow - subtle */}
                                        <path
                                            d={`M ${bucket.width * 0.85} ${bucket.height * 0.18} 
                                                L ${bucket.width * 0.92} ${bucket.height * 0.45}
                                                Q ${bucket.width * 0.93} ${bucket.height * 0.65} ${bucket.width * 0.9} ${bucket.height * 0.8}`}
                                            fill="none"
                                            stroke="rgba(0, 0, 0, 0.15)"
                                            strokeWidth="2.5"
                                            opacity="0.5"
                                        />

                                        {/* Bottom shadow - curved bottom emphasis */}
                                        <ellipse
                                            cx={bucket.width * 0.5}
                                            cy={bucket.height * 0.96}
                                            rx={bucket.width * 0.35}
                                            ry={bucket.height * 0.06}
                                            fill="rgba(0, 0, 0, 0.2)"
                                        />

                                        {/* Glass reflection - top area */}
                                        <ellipse
                                            cx={bucket.width * 0.3}
                                            cy={bucket.height * 0.35}
                                            rx={bucket.width * 0.1}
                                            ry={bucket.height * 0.12}
                                            fill="white"
                                            opacity="0.25"
                                        />
                                    </g>
                                </svg>

                                {/* Bucket Label - Draggable for trainers only */}
                                <div
                                    className="absolute left-1/2 transform -translate-x-1/2 text-white px-3 py-1 rounded text-xs font-semibold whitespace-nowrap flex items-center gap-2"
                                    style={{
                                        backgroundColor: bucket.color || bucketColor,
                                        pointerEvents: isTrainer ? 'auto' : 'none',
                                        cursor: isTrainer && editingBucketId !== bucket.id ? 'move' : 'default',
                                        top: `${bucket.height * 0.4}px`
                                    }}
                                    onMouseDown={(e) => {
                                        if (isTrainer && editingBucketId !== bucket.id) {
                                            // Start dragging bucket from label
                                            const canvas = canvasRef.current;
                                            const rect = canvas.getBoundingClientRect();
                                            setSelectedItem({ ...bucket, type: 'bucket' });
                                            setIsDraggingItem(true);
                                            prevPosRef.current = {
                                                x: e.clientX - rect.left,
                                                y: e.clientY - rect.top
                                            };
                                            e.stopPropagation();
                                            e.preventDefault();
                                        }
                                    }}
                                >
                                    <span
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            isTrainer && handleBucketLabelClick(bucket, e);
                                        }}
                                        className={isTrainer && editingBucketId !== bucket.id ? "cursor-move" : "cursor-pointer"}
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
                                                className="text-white px-1 border-none outline-none w-24 text-center text-xs"
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
                                            className="text-white hover:text-red-300 text-lg leading-none font-bold"
                                            title="Remove Bucket"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>

                                {/* Resize Handle Visual (Trainer only) - Larger and more visible */}
                                {isTrainer && (
                                    <div
                                        className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white shadow-lg"
                                        style={{
                                            backgroundColor: bucket.color || bucketColor,
                                            pointerEvents: 'none',
                                            transform: 'translate(25%, 25%)' // Position half outside for better visibility
                                        }}
                                        title="Drag to resize"
                                    />
                                )}
                            </div>
                        ))}

                        {/* REACTION EMOJIS - Floating emoji feedback */}
                        {canvasItems.filter(item => item.type === 'reaction').map(reaction => (
                            <div
                                key={reaction.id}
                                className="reaction-emoji"
                                style={{
                                    left: `${reaction.x}px`,
                                    top: `${reaction.y}px`
                                }}
                            >
                                {reaction.emoji}
                            </div>
                        ))}

                        {/* BUBBLES ANIMATION */}
                        {canvasItems.filter(item => item.type === 'animation' && item.animationType === 'bubbles').map((animation, idx) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={`bubble-${idx}-${i}`} className="bubble" style={{ bottom: '0%' }} />
                                ))}
                            </div>
                        ))}

                        {/* SMILEYS ANIMATION */}
                        {canvasItems.filter(item => item.type === 'animation' && item.animationType === 'smileys').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%', bottom: '0' }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={`smiley-${animation.id}-${i}`} className="smiley" style={{ bottom: '0%' }}>
                                        😊
                                    </div>
                                ))}
                            </div>
                        ))}

                        {/* BALLOONS ANIMATION */}
                        {canvasItems.filter(item => item.type === 'animation' && item.animationType === 'balloons').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', width: '100%', height: '100%', bottom: '0' }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={`balloon-${animation.id}-${i}`} className="balloon" style={{ bottom: '0%' }} />
                                ))}
                            </div>
                        ))}

                        {/* STARS ANIMATION */}
                        {canvasItems.filter(item => item.type === 'animation' && item.animationType === 'stars').map((animation) => (
                            <div key={animation.id} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                    <div key={`star-${animation.id}-${i}`} className="star">
                                        ⭐
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

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
        </div>
    );

};


export default Whiteboard;