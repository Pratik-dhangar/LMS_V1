import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaImage } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import galleryService from '../../api/services/galleryService';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/ManageUsersLayout.css';
import '../../styles/pages/GalleryList.css';

const GalleryVideoPreview = ({ src, poster }) => {
    const videoRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(0.5);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onTime = () => {
            if (!v.duration || isNaN(v.duration)) return;
            setProgress((v.currentTime / v.duration) * 100);
        };

        const onLoaded = () => {
            setDuration(v.duration || 0);
        };

        v.addEventListener('timeupdate', onTime);
        v.addEventListener('loadedmetadata', onLoaded);

        return () => {
            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('loadedmetadata', onLoaded);
        };
    }, []);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = volume;
        v.muted = muted;
    }, [volume, muted]);

    const togglePlay = (e) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            v.play().catch(() => { });
            setPlaying(true);
        } else {
            v.pause();
            setPlaying(false);
        }
    };

    const toggleMute = (e) => {
        e.stopPropagation();
        setMuted((m) => !m);
    };

    const increaseVolume = (e) => {
        e.stopPropagation();
        setVolume((vol) => Math.min(1, +(vol + 0.1).toFixed(2)));
        setMuted(false);
    };

    const decreaseVolume = (e) => {
        e.stopPropagation();
        setVolume((vol) => Math.max(0, +(vol - 0.1).toFixed(2)));
        if (volume - 0.1 <= 0) setMuted(true);
    };

    const onSeek = (e) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const percent = Number(e.target.value);
        v.currentTime = (percent / 100) * v.duration;
        setProgress(percent);
    };

    return (
        <div className="gallery-video-preview" onClick={(e) => e.stopPropagation()}>
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                className="gallery-card-video"
                muted={muted}
                loop
                playsInline
                preload="metadata"
            />

            <div className="gallery-video-controls">
                <button className="gv-btn gv-play" onClick={togglePlay} aria-label="Play/Pause">
                    {playing ? '❚❚' : '►'}
                </button>
                <button className="gv-btn gv-vol-down" onClick={decreaseVolume} aria-label="Volume down">-</button>
                <button className="gv-btn gv-vol-up" onClick={increaseVolume} aria-label="Volume up">+</button>
                <button className="gv-btn gv-mute" onClick={toggleMute} aria-label="Mute/Unmute">{muted ? '🔈' : '🔊'}</button>

                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={onSeek}
                    className="gv-progress"
                    aria-label="Seek"
                />
            </div>
        </div>
    );
};

const GalleryList = () => {
    const navigate = useNavigate();
    const debounceTimerRef = useRef(null);

    const [galleries, setGalleries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [searchTerm]);

    useEffect(() => {
        const fetchGalleries = async () => {
            try {
                setLoading(true);
                const response = await galleryService.getPublicGalleries({
                    page: currentPage,
                    per_page: 12,
                    search: debouncedSearchTerm || undefined,
                });

                setGalleries(response.galleries || []);
                setTotalPages(response.total_pages || 1);
                setError(null);
            } catch (err) {
                console.error('Error fetching gallery items:', err);
                setError('Failed to fetch gallery items. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchGalleries();
    }, [currentPage, debouncedSearchTerm]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setSelectedMedia(null);
                setZoomLevel(1);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        if (!selectedMedia) return undefined;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [selectedMedia]);

    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
    };

    const clampZoom = (value) => Math.min(4, Math.max(0.5, value));

    const handleOpenMedia = (media) => {
        setSelectedMedia(media);
        setZoomLevel(1);
    };

    const handleCloseLightbox = () => {
        setSelectedMedia(null);
        setZoomLevel(1);
    };

    const handleZoomIn = () => setZoomLevel((prev) => clampZoom(prev + 0.2));
    const handleZoomOut = () => setZoomLevel((prev) => clampZoom(prev - 0.2));
    const handleZoomReset = () => setZoomLevel(1);

    const handleWheelZoom = (event) => {
        if (!selectedMedia || selectedMedia.type === 'video') return;

        event.preventDefault();
        event.stopPropagation();

        if (event.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    if (loading && galleries.length === 0) return <Loader />;
    if (error && galleries.length === 0) return <ErrorState message={error} />;

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    <div className="page-header">
                        <button onClick={() => navigate('/')} className="back-button">
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
                            Go Back
                        </button>
                        <div>
                            <h1 className="page-title">Our Gallery</h1>
                            <p className="page-description">Moments, memories, and visual stories from our journey</p>
                        </div>
                    </div>

                    <div className="gallery-search-section">
                        <form onSubmit={handleSearch} className="gallery-search-form">
                            <div className="gallery-search-wrapper">
                                <input
                                    type="text"
                                    placeholder="Search gallery photos and videos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="gallery-search-input"
                                />
                                <FaSearch className="gallery-search-icon" />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setCurrentPage(1);
                                        }}
                                        className="gallery-search-clear-btn"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="page-content">
                        {galleries.length === 0 ? (
                            <div className="gallery-no-results">
                                <div className="gallery-no-results-content">
                                    <p className="gallery-no-results-title">No gallery items found</p>
                                    <p className="gallery-no-results-text">Try adjusting your search</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="gallery-grid">
                                    {galleries.map((gallery) => (
                                        <article
                                            key={gallery.id}
                                            className="gallery-card"
                                            onClick={() => {
                                                if (gallery.video_url) {
                                                    handleOpenMedia({
                                                        type: 'video',
                                                        url: getFileUrl(gallery.video_url),
                                                        poster: getFileUrl(gallery.video_thumbnail_url || gallery.thumbnail_url),
                                                    });
                                                } else {
                                                    handleOpenMedia({
                                                        type: 'image',
                                                        url: getFileUrl(gallery.photo_url),
                                                    });
                                                }
                                            }}
                                        >
                                            <div className="gallery-card-image">
                                                {(() => {
                                                    const thumbSource = gallery.video_thumbnail_url || gallery.thumbnail_url || gallery.photo_url;
                                                    if (thumbSource) {
                                                        return (
                                                            <img
                                                                src={getFileUrl(thumbSource)}
                                                                alt={`Gallery ${gallery.video_url ? 'video' : 'image'} ${gallery.id}`}
                                                                className="gallery-card-img"
                                                            />
                                                        );
                                                    }

                                                    // If it's a video without a thumbnail, render a muted looping <video> preview.
                                                    if (gallery.video_url) {
                                                        return (
                                                            <GalleryVideoPreview
                                                                src={getFileUrl(gallery.video_url)}
                                                                poster={gallery.video_thumbnail_url ? getFileUrl(gallery.video_thumbnail_url) : undefined}
                                                            />
                                                        );
                                                    }

                                                    return <div className="gallery-card-img-placeholder" />;
                                                })()}
                                                <div className="gallery-card-overlay">
                                                    <div className="gallery-card-icon">
                                                        {gallery.video_url ? (
                                                            <span style={{ fontSize: '2rem' }}>▶️</span>
                                                        ) : (
                                                            <FaImage className="gallery-card-icon-svg" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="gallery-pagination">
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="pagination-btn"
                                        >
                                            Previous
                                        </button>
                                        <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="pagination-btn"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>

            {selectedMedia && (
                <div
                    className="gallery-lightbox"
                    onClick={handleCloseLightbox}
                    onWheel={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Close media preview"
                >
                    <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()} onWheel={handleWheelZoom}>
                        {selectedMedia.type === 'image' && (
                            <div className="gallery-lightbox-toolbar">
                                <button type="button" className="gallery-lightbox-action" onClick={handleZoomOut} aria-label="Zoom out">
                                    -
                                </button>
                                <button
                                    type="button"
                                    className="gallery-lightbox-action gallery-lightbox-zoom-label"
                                    onClick={handleZoomReset}
                                    aria-label="Reset zoom"
                                >
                                    {Math.round(zoomLevel * 100)}%
                                </button>
                                <button type="button" className="gallery-lightbox-action" onClick={handleZoomIn} aria-label="Zoom in">
                                    +
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            className="gallery-lightbox-close"
                            onClick={handleCloseLightbox}
                            aria-label="Close popup"
                        >
                            ×
                        </button>

                        {selectedMedia.type === 'video' ? (
                            <video
                                src={selectedMedia.url}
                                poster={selectedMedia.poster || undefined}
                                className="gallery-lightbox-image"
                                controls
                                autoPlay
                                playsInline
                                preload="metadata"
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '80vh',
                                    borderRadius: '12px',
                                    backgroundColor: '#000',
                                }}
                            />
                        ) : (
                            <img
                                src={selectedMedia.url}
                                alt="Gallery preview"
                                className="gallery-lightbox-image"
                                style={{
                                    transform: `scale(${zoomLevel})`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.15s ease-out',
                                }}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryList;