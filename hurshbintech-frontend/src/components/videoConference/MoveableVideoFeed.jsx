/**
 * Moveable Video Feed Component
 * Displays live video stream as a draggable overlay on whiteboard
 * Can be moved and resized by trainer and learner
 */

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/videoConference.css';

const MoveableVideoFeed = ({
    videoStream,
    label,
    position = { x: 20, y: 20 },
    size = { width: 320, height: 240 },
    onPositionChange,
    onSizeChange,
    isDraggable = true,
    isResizable = true,
    connectionStatus = 'connecting',
    zIndex = 100
}) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [currentPos, setCurrentPos] = useState(position);
    const [currentSize, setCurrentSize] = useState(size);
    const [isMinimized, setIsMinimized] = useState(false);

    // Set up video stream
    useEffect(() => {
        const videoElement = videoRef.current;

        if (videoStream && videoElement) {
            videoElement.srcObject = videoStream;

            // Wait for metadata to load before playing
            const handleLoadedMetadata = () => {
                if (videoElement.srcObject === videoStream) {
                    videoElement.play().catch(error => {
                        // Ignore AbortError as it's expected when component unmounts
                        if (error.name !== 'AbortError') {
                            console.error('[MoveableVideo] Video play error:', error);
                        }
                    });
                }
            };

            videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);

            // If metadata already loaded, play immediately
            if (videoElement.readyState >= 1) {
                handleLoadedMetadata();
            }

            return () => {
                videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
                // Clean up on unmount
                if (videoElement.srcObject) {
                    videoElement.pause();
                    videoElement.srcObject = null;
                }
            };
        }
    }, [videoStream]);

    // Handle drag start
    const handleMouseDown = (e) => {
        if (!isDraggable || isResizing) return;
        e.preventDefault();
        e.stopPropagation();

        // Calculate offset from current position to mouse, not from element's top-left
        setDragOffset({
            x: e.clientX - currentPos.x,
            y: e.clientY - currentPos.y
        });
        setIsDragging(true);
    };

    // Handle resize start
    const handleResizeStart = (e) => {
        if (!isResizable) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    };

    // Handle mouse move
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;
                setCurrentPos({ x: newX, y: newY });
                if (onPositionChange) {
                    onPositionChange({ x: newX, y: newY });
                }
            } else if (isResizing) {
                const rect = containerRef.current.getBoundingClientRect();
                const newWidth = Math.max(200, e.clientX - rect.left);
                const newHeight = Math.max(150, e.clientY - rect.top);
                setCurrentSize({ width: newWidth, height: newHeight });
                if (onSizeChange) {
                    onSizeChange({ width: newWidth, height: newHeight });
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragOffset, onPositionChange, onSizeChange]);

    // Toggle minimize
    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    const getConnectionClass = () => {
        if (connectionStatus === 'connected') return 'connected';
        if (connectionStatus === 'connecting') return 'connecting';
        return 'disconnected';
    };

    return (
        <div
            ref={containerRef}
            className="moveable-video-feed"
            style={{
                position: 'absolute',
                left: `${currentPos.x}px`,
                top: `${currentPos.y}px`,
                width: isMinimized ? '180px' : `${currentSize.width}px`,
                height: isMinimized ? '40px' : `${currentSize.height}px`,
                zIndex: zIndex,
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: isMinimized ? 'all 0.3s ease' : 'none'
            }}
        >
            {/* Video Header */}
            <div
                className="moveable-video-header"
                onMouseDown={handleMouseDown}
            >
                <div className="moveable-video-label">
                    {/* <span className="video-icon">📹</span> */}
                    <span>{label}</span>
                </div>
                <div className="moveable-video-controls">
                    <div className={`connection-dot ${getConnectionClass()}`}></div>
                    <button
                        className="video-minimize-btn"
                        onClick={toggleMinimize}
                        title={isMinimized ? 'Maximize' : 'Minimize'}
                    >
                        {isMinimized ? '⬜' : '—'}
                    </button>
                </div>
            </div>

            {/* Video Content - Always rendered to preserve WebRTC connection */}
            <div
                className="moveable-video-content"
                style={{ display: isMinimized ? 'none' : 'block' }}
            >
                {!videoStream && (
                    <div className="video-placeholder-mini">
                        <div className="spinner-mini"></div>
                        <div>Connecting...</div>
                    </div>
                )}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={false}
                    className="moveable-video-player"
                    style={{ opacity: videoStream ? 1 : 0 }}
                />

            </div>

            {/* Resize Handle - Only show when not minimized */}
            {isResizable && !isMinimized && (
                <div
                    className="video-resize-handle"
                    onMouseDown={handleResizeStart}
                    title="Drag to resize"
                >
                    ⇲
                </div>
            )}
        </div>
    );
};

export default MoveableVideoFeed;
