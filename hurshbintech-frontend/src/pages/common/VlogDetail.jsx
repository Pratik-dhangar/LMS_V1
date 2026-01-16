import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaCalendar, FaArrowLeft, FaPlay, FaPause, FaVolumeUp, FaVolumeMute, FaExpand, FaCompress } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import vlogService from '../../api/services/vlogService';

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
        <>
            <div className="bg-gray-50">
                {/* Breadcrumb */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                    <nav className="mb-4 text-sm">
                        <ol className="flex items-center space-x-2">
                            <li>
                                <Link to="/" className="text-blue-600 hover:text-blue-800">
                                    Home
                                </Link>
                            </li>
                            <li className="text-gray-400">/</li>
                            <li>
                                <Link to="/vlogs" className="text-blue-600 hover:text-blue-800">
                                    Vlogs
                                </Link>
                            </li>
                            <li className="text-gray-400">/</li>
                            <li className="text-gray-600 line-clamp-1">{vlog.title}</li>
                        </ol>
                    </nav>

                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/vlogs')}
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-8 font-medium"
                    >
                        <FaArrowLeft />
                        Back to Vlogs
                    </button>
                </div>

                {/* Main Content */}
                <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                    {/* Header */}
                    <header className="mb-8">
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            {vlog.title}
                        </h1>

                        {/* Meta Information */}
                        <div className="flex items-center gap-6 text-gray-600 border-b border-gray-200 pb-6">
                            <div className="flex items-center gap-2">
                                <FaCalendar className="text-blue-600" />
                                <span>{formatDate(vlog.created_at)}</span>
                            </div>
                            {/* <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                                    {formatFileSize(vlog.file_size)}
                                </span>
                            </div> */}
                        </div>
                    </header>

                    {/* Video Container with Custom Controls */}
                    <div
                        ref={containerRef}
                        className="mb-12 w-full relative bg-black rounded-lg overflow-hidden"
                        style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                        onMouseEnter={() => setShowControls(true)}
                        onMouseLeave={() => setShowControls(isPlaying ? false : true)}
                    >
                        <video
                            ref={videoRef}
                            className="w-full h-auto"
                            poster={vlog.thumbnail_url}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            onEnded={() => setIsPlaying(false)}
                            onClick={togglePlay}
                            style={{ display: 'block', maxWidth: '100%' }}
                        >
                            <source src={vlog.file_url} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>

                        {/* Custom Controls Overlay */}
                        <div
                            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                            style={{ padding: '20px 15px 15px' }}
                        >
                            {/* Progress Bar */}
                            <div className="mb-3 group">
                                <div className="relative">
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
                                        className="w-full h-2 rounded-lg appearance-none cursor-pointer hover:h-3 transition-all"
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100 || 0}%, #4b5563 ${(currentTime / duration) * 100 || 0}%, #4b5563 100%)`,
                                            WebkitAppearance: 'none',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center justify-between text-white">
                                <div className="flex items-center gap-4">
                                    {/* Play/Pause Button */}
                                    <button
                                        onClick={togglePlay}
                                        className="hover:text-blue-400 transition-colors p-2"
                                        aria-label={isPlaying ? 'Pause' : 'Play'}
                                    >
                                        {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
                                    </button>

                                    {/* Volume Controls */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleMute}
                                            className="hover:text-blue-400 transition-colors p-2"
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
                                            className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                            style={{
                                                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${isMuted ? 0 : volume * 100}%, #4b5563 ${isMuted ? 0 : volume * 100}%, #4b5563 100%)`
                                            }}
                                        />
                                    </div>

                                    {/* Time Display */}
                                    <div className="text-sm font-medium">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </div>
                                </div>

                                {/* Fullscreen Button */}
                                <button
                                    onClick={toggleFullscreen}
                                    className="hover:text-blue-400 transition-colors p-2"
                                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                >
                                    {isFullscreen ? <FaCompress size={20} /> : <FaExpand size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Play Button Overlay (when paused) */}
                        {!isPlaying && (
                            <div
                                className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                                onClick={togglePlay}
                            >
                                <div className="w-20 h-20 flex items-center justify-center bg-blue-600 rounded-full hover:bg-blue-700 transition-colors">
                                    <FaPlay size={30} className="text-white ml-1" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Thumbnail Preview
                    {vlog.thumbnail_url && (
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Thumbnail</h2>
                            <img
                                src={vlog.thumbnail_url}
                                alt={vlog.title}
                                className="w-full rounded-lg shadow-lg max-h-96 object-cover"
                            />
                        </div>
                    )} */}

                    {/* Description */}
                    {vlog.description && (
                        <div className="mb-12">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">About this Vlog</h2>
                            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                                <p>{vlog.description}</p>
                            </div>
                        </div>
                    )}

                    {/* Video Information */}
                    {/* <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Video Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">File Size</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {formatFileSize(vlog.file_size)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Published Date</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {formatDate(vlog.created_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Vlog ID</p>
                                <p className="text-lg font-semibold text-gray-900">{vlog.id}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Last Updated</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {formatDate(vlog.updated_at)}
                                </p>
                            </div>
                        </div>
                    </div> */}

                    {/* Navigation */}
                    <div className="mt-12 pt-8 border-t border-gray-200">
                        <Link
                            to="/vlogs"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 font-medium"
                        >
                            <FaArrowLeft />
                            Back to All Vlogs
                        </Link>
                    </div>
                </article>
            </div>
        </>
    );
};

export default VlogDetail;
