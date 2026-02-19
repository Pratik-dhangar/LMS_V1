import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaCalendar, FaArrowLeft, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import vlogService from '../../api/services/vlogService';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/ManageUsersLayout.css';
import '../../styles/pages/VlogList.css';

const VlogDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [vlog, setVlog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Video player state
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const wasPlayingRef = useRef(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

    useEffect(() => {
        fetchVlog();
    }, [id]);

    const fetchVlog = async () => {
        try {
            setLoading(true);
            const data = await vlogService.getPublicVlogById(id);
            setVlog(data);
            setError(null);

            // Update page title for SEO
            document.title = `${data.title} | HurshBinTech Vlogs`;
        } catch (err) {
            console.error('Error fetching vlog:', err);
            if (err.response?.status === 404) {
                setError('Vlog not found');
            } else {
                setError('Failed to fetch vlog. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatFileSize = (sizeInMB) => {
        if (!sizeInMB) return '';
        if (sizeInMB >= 1024) {
            return (sizeInMB / 1024).toFixed(2) + ' GB';
        }
        return sizeInMB.toFixed(2) + ' MB';
    };

    // Video player functions
    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e) => {
        const percent = parseFloat(e.target.value);
        const seekTime = (percent / 100) * duration;
        if (videoRef.current && !isNaN(seekTime)) {
            videoRef.current.currentTime = seekTime;
        }
    };

    const handleSeekStart = () => {
        if (videoRef.current) {
            // Store the current playing state
            wasPlayingRef.current = !videoRef.current.paused;
            if (wasPlayingRef.current) {
                videoRef.current.pause();
            }
        }
    };

    const handleSeekEnd = () => {
        if (videoRef.current && wasPlayingRef.current) {
            videoRef.current.play();
            wasPlayingRef.current = false;
        }
    };

    const handleVolumeChange = (e) => {
        const newVolume = e.target.value / 100;
        setVolume(newVolume);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = volume || 0.5;
                setVolume(volume || 0.5);
                setIsMuted(false);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (loading) return <Loader />;
    if (error) return <ErrorState message={error} />;
    if (!vlog) return <ErrorState message="Vlog not found" />;

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header with Back Button */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/vlogs')}
                            className="back-button"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Vlogs
                        </button>
                        <div>
                            <h1 className="page-title">Video Blog</h1>
                        </div>
                    </div>

                    {/* Main Content */}
                    <article className="vlog-detail-article">
                        {/* Header */}
                        <header className="vlog-detail-header">
                            <h1 className="vlog-detail-title">
                                {vlog.title}
                            </h1>

                            {/* Meta Information */}
                            <div className="vlog-detail-meta">
                                <div className="vlog-detail-meta-item">
                                    <FaCalendar className="vlog-detail-meta-icon" />
                                    <span>{formatDate(vlog.created_at)}</span>
                                </div>
                            </div>
                        </header>

                        {/* Video Container with Custom Controls */}
                        <div
                            ref={containerRef}
                            className="vlog-detail-video-container"
                            onMouseEnter={() => setShowControls(true)}
                            onMouseLeave={() => setShowControls(isPlaying ? false : true)}
                        >
                            <video
                                ref={videoRef}
                                className="vlog-detail-video"
                                poster={getFileUrl(vlog.thumbnail_url)}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onEnded={() => setIsPlaying(false)}
                                onClick={togglePlay}
                            >
                                <source src={getFileUrl(vlog.file_url)} type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>

                            {/* Custom Controls Overlay */}
                            <div className={`vlog-detail-controls ${showControls ? '' : 'hidden'}`}>
                                {/* Progress Bar */}
                                <div className="vlog-detail-progress">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={(currentTime / duration) * 100 || 0}
                                        onChange={handleSeek}
                                        onMouseDown={handleSeekStart}
                                        onMouseUp={handleSeekEnd}
                                        onTouchStart={handleSeekStart}
                                        onTouchEnd={handleSeekEnd}
                                        className="vlog-detail-progress-bar"
                                        style={{
                                            background: `linear-gradient(to right, #db9d32 0%, #db9d32 ${(currentTime / duration) * 100 || 0}%, #4b5563 ${(currentTime / duration) * 100 || 0}%, #4b5563 100%)`,
                                            WebkitAppearance: 'none',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                {/* Control Buttons */}
                                <div className="vlog-detail-control-buttons">
                                    <div className="vlog-detail-control-left">
                                        {/* Play/Pause Button */}
                                        <button
                                            onClick={togglePlay}
                                            className="vlog-detail-control-button"
                                            aria-label={isPlaying ? 'Pause' : 'Play'}
                                        >
                                            {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
                                        </button>

                                        {/* Volume Controls */}
                                        <div className="vlog-detail-volume-controls">
                                            <button
                                                onClick={toggleMute}
                                                className="vlog-detail-control-button"
                                                aria-label={isMuted ? 'Unmute' : 'Mute'}
                                            >
                                                {isMuted ? <FaVolumeMute size={20} /> : <FaVolumeUp size={20} />}
                                            </button>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={isMuted ? 0 : volume * 100}
                                                onChange={handleVolumeChange}
                                                className="vlog-detail-volume-bar"
                                                style={{
                                                    background: `linear-gradient(to right, #db9d32 0%, #db9d32 ${isMuted ? 0 : volume * 100}%, #4b5563 ${isMuted ? 0 : volume * 100}%, #4b5563 100%)`
                                                }}
                                            />
                                        </div>

                                        {/* Time Display */}
                                        <div className="vlog-detail-time">
                                            {formatTime(currentTime)} / {formatTime(duration)}
                                        </div>
                                    </div>

                                    {/* Fullscreen Button */}
                                    <button
                                        onClick={toggleFullscreen}
                                        className="vlog-detail-control-button"
                                        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                    >
                                        {isFullscreen ? <FaCompress size={20} /> : <FaExpand size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Play Button Overlay (when paused) */}
                            {!isPlaying && (
                                <div className="vlog-detail-play-overlay" onClick={togglePlay}>
                                    <div className="vlog-detail-play-button">
                                        <FaPlay size={30} className="vlog-detail-play-icon" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {vlog.description && (
                            <div className="vlog-detail-description">
                                <h2 className="vlog-detail-description-title">About this Vlog</h2>
                                <div className="vlog-detail-description-text">
                                    <p>{vlog.description}</p>
                                </div>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="vlog-detail-navigation">
                            <Link
                                to="/vlogs"
                                className="vlog-detail-back-button"
                            >
                                <FaArrowLeft />
                                Back to All Vlogs
                            </Link>
                        </div>
                    </article>
                </div>
            </main>
        </div>
    );
};

export default VlogDetail;
