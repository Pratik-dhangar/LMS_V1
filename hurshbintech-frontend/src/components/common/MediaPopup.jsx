import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaTimes, FaPlay, FaPause, FaStepBackward, FaStepForward, FaExpand, FaCompress } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '../../styles/components/common/MediaPopup.css';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * MediaPopup Component
 * Displays video or PDF media in a popup with trainer controls
 * Learners see view-only version
 */
const MediaPopup = ({
    mediaId,
    mediaType,
    mediaUrl,
    status,
    currentTime,
    currentPage,
    isTrainer,
    isFullscreen,
    onClose,
    onPlay,
    onPause,
    onSeek,
    onPageChange,
}) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const pdfDocRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(status === 'playing');
    const [duration, setDuration] = useState(0);
    const [localCurrentTime, setLocalCurrentTime] = useState(currentTime || 0);
    const [totalPages, setTotalPages] = useState(1);
    const [localCurrentPage, setLocalCurrentPage] = useState(currentPage || 1);
    const [pdfScale, setPdfScale] = useState(1);
    const [isPdfLoading, setPdfLoading] = useState(false);

    // Handle video metadata loaded
    const handleVideoLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    // Handle video time update
    const handleVideoTimeUpdate = () => {
        if (videoRef.current) {
            setLocalCurrentTime(videoRef.current.currentTime);
        }
    };

    // Handle video play
    const handlePlayClick = () => {
        if (isTrainer && videoRef.current) {
            setIsPlaying(true);
            videoRef.current.play();
            onPlay && onPlay({ mediaId, currentTime: videoRef.current.currentTime });
        }
    };

    // Handle video pause
    const handlePauseClick = () => {
        if (isTrainer && videoRef.current) {
            setIsPlaying(false);
            videoRef.current.pause();
            onPause && onPause({ mediaId, currentTime: videoRef.current.currentTime });
        }
    };

    // Handle video seek
    const handleSeek = (newTime) => {
        if (isTrainer && videoRef.current) {
            videoRef.current.currentTime = newTime;
            setLocalCurrentTime(newTime);
            onSeek && onSeek({ mediaId, currentTime: newTime });
        }
    };

    // Format time for display
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Load PDF document
    const loadPdf = async () => {
        if (!mediaUrl) return;
        try {
            setPdfLoading(true);
            const pdf = await pdfjsLib.getDocument(mediaUrl).promise;
            pdfDocRef.current = pdf;
            setTotalPages(pdf.numPages);
            await renderPdfPage(localCurrentPage);
        } catch (error) {
            console.error('Error loading PDF:', error);
            toast.error('Failed to load PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    // Render specific PDF page
    const renderPdfPage = async (pageNumber) => {
        if (!pdfDocRef.current || !canvasRef.current) return;

        try {
            const page = await pdfDocRef.current.getPage(pageNumber);
            const viewport = page.getViewport({ scale: pdfScale });
            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
            const renderViewport = page.getViewport({ scale: pdfScale * dpr });
            const canvas = canvasRef.current;

            // Backing store at devicePixelRatio for sharp rendering
            canvas.width = Math.max(1, Math.floor(renderViewport.width));
            canvas.height = Math.max(1, Math.floor(renderViewport.height));
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }

            const renderContext = {
                canvasContext: ctx,
                viewport: renderViewport
            };

            await page.render(renderContext).promise;
            setLocalCurrentPage(pageNumber);
        } catch (error) {
            console.error('Error rendering PDF page:', error);
        }
    };

    // Handle PDF page navigation
    const handlePreviousPage = () => {
        if (isTrainer && localCurrentPage > 1) {
            const newPage = localCurrentPage - 1;
            setLocalCurrentPage(newPage);
            renderPdfPage(newPage);
            onPageChange && onPageChange({ mediaId, page: newPage });
        }
    };

    const handleNextPage = () => {
        if (isTrainer && localCurrentPage < totalPages) {
            const newPage = localCurrentPage + 1;
            setLocalCurrentPage(newPage);
            renderPdfPage(newPage);
            onPageChange && onPageChange({ mediaId, page: newPage });
        }
    };

    // Load PDF on mount or when mediaUrl changes
    useEffect(() => {
        if (mediaType === 'pdf' && mediaUrl) {
            loadPdf();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mediaType, mediaUrl]);

    // Update video time when currentTime prop changes (for sync from server)
    useEffect(() => {
        if (mediaType === 'video' && videoRef.current && currentTime !== undefined) {
            videoRef.current.currentTime = currentTime;
            setLocalCurrentTime(currentTime);
        }
    }, [currentTime, mediaType]);

    // Update video playing state when status prop changes (for sync from server)
    useEffect(() => {
        if (mediaType === 'video' && videoRef.current && status) {
            if (status === 'playing') {
                videoRef.current.play();
                setIsPlaying(true);
            } else if (status === 'paused') {
                videoRef.current.pause();
                setIsPlaying(false);
            }
        }
    }, [status, mediaType]);

    // Update PDF page when currentPage prop changes (for sync from server)
    useEffect(() => {
        if (mediaType === 'pdf' && currentPage && currentPage !== localCurrentPage) {
            renderPdfPage(currentPage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, mediaType]);

    if (!mediaUrl) {
        return null;
    }

    return (
        <div className={`media-popup-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
            <div className="media-popup-container">
                {/* Header */}
                <div className="media-popup-header">
                    <h3 className="media-popup-title">{mediaType === 'video' ? 'Video' : 'PDF'} Player</h3>
                    <button
                        className="media-popup-close-btn"
                        onClick={onClose}
                        title="Close"
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* Content */}
                <div className="media-popup-content">
                    {mediaType === 'video' ? (
                        <div className="video-player-wrapper">
                            <video
                                ref={videoRef}
                                src={mediaUrl}
                                onLoadedMetadata={handleVideoLoadedMetadata}
                                onTimeUpdate={handleVideoTimeUpdate}
                                controls={isTrainer}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        </div>
                    ) : (
                        <div className="pdf-viewer-wrapper">
                            {isPdfLoading && <div className="pdf-loading">Loading PDF...</div>}
                            <canvas ref={canvasRef} className="pdf-canvas" />
                        </div>
                    )}
                </div>

                {/* Controls - Only show for trainer */}
                {isTrainer && (
                    <div className="media-popup-controls">
                        {mediaType === 'video' ? (
                            <div className="video-controls">
                                {/* Play/Pause */}
                                <button
                                    className="control-btn"
                                    onClick={isPlaying ? handlePauseClick : handlePlayClick}
                                    title={isPlaying ? 'Pause' : 'Play'}
                                >
                                    {isPlaying ? <FaPause /> : <FaPlay />}
                                </button>

                                {/* Backward */}
                                <button
                                    className="control-btn"
                                    onClick={() => handleSeek(Math.max(0, localCurrentTime - 5))}
                                    title="Rewind 5s"
                                >
                                    <FaStepBackward />
                                </button>

                                {/* Time display */}
                                <span className="time-display">
                                    {formatTime(localCurrentTime)} / {formatTime(duration)}
                                </span>

                                {/* Progress bar */}
                                <input
                                    type="range"
                                    min="0"
                                    max={duration || 0}
                                    value={localCurrentTime}
                                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                    className="progress-bar"
                                    title="Seek"
                                />

                                {/* Forward */}
                                <button
                                    className="control-btn"
                                    onClick={() => handleSeek(Math.min(duration, localCurrentTime + 5))}
                                    title="Forward 5s"
                                >
                                    <FaStepForward />
                                </button>
                            </div>
                        ) : (
                            <div className="pdf-controls">
                                {/* Previous page */}
                                <button
                                    className="control-btn"
                                    onClick={handlePreviousPage}
                                    disabled={localCurrentPage <= 1}
                                    title="Previous page"
                                >
                                    <FaStepBackward />
                                </button>

                                {/* Page display */}
                                <span className="page-display">
                                    Page {localCurrentPage} / {totalPages}
                                </span>

                                {/* Next page */}
                                <button
                                    className="control-btn"
                                    onClick={handleNextPage}
                                    disabled={localCurrentPage >= totalPages}
                                    title="Next page"
                                >
                                    <FaStepForward />
                                </button>

                                {/* Zoom controls */}
                                <button
                                    className="control-btn"
                                    onClick={() => {
                                        const newScale = pdfScale - 0.1;
                                        if (newScale > 0.5) {
                                            setPdfScale(newScale);
                                            renderPdfPage(localCurrentPage);
                                        }
                                    }}
                                    disabled={pdfScale <= 0.5}
                                    title="Zoom out"
                                >
                                    -
                                </button>

                                <span className="zoom-display">{Math.round(pdfScale * 100)}%</span>

                                <button
                                    className="control-btn"
                                    onClick={() => {
                                        const newScale = pdfScale + 0.1;
                                        if (newScale < 3) {
                                            setPdfScale(newScale);
                                            renderPdfPage(localCurrentPage);
                                        }
                                    }}
                                    disabled={pdfScale >= 3}
                                    title="Zoom in"
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* View-only indicator for learners */}
                {!isTrainer && (
                    <div className="view-only-indicator">
                        View only - Waiting for trainer controls
                    </div>
                )}
            </div>
        </div>
    );
};

MediaPopup.propTypes = {
    mediaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    mediaType: PropTypes.oneOf(['video', 'pdf']).isRequired,
    mediaUrl: PropTypes.string.isRequired,
    status: PropTypes.oneOf(['playing', 'paused']),
    currentTime: PropTypes.number,
    currentPage: PropTypes.number,
    isTrainer: PropTypes.bool.isRequired,
    isFullscreen: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onPlay: PropTypes.func,
    onPause: PropTypes.func,
    onSeek: PropTypes.func,
    onPageChange: PropTypes.func,
};

MediaPopup.defaultProps = {
    status: 'paused',
    currentTime: 0,
    currentPage: 1,
    isFullscreen: false,
};

export default MediaPopup;
