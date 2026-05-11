import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaCalendar, FaImage } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import galleryService from '../../api/services/galleryService';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/ManageUsersLayout.css';
import '../../styles/pages/GalleryList.css';

const GalleryList = () => {
    const [galleries, setGalleries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const navigate = useNavigate();
    const debounceTimerRef = useRef(null);

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

    const fetchGalleries = async () => {
        try {
            setLoading(true);
            const response = await galleryService.getPublicGalleries({
                page: currentPage,
                per_page: 12,
                search: debouncedSearchTerm || undefined,
            });
            setGalleries(response.galleries || []);
            setTotal(response.total || 0);
            setTotalPages(response.total_pages || 1);
            setError(null);
        } catch (err) {
            console.error('Error fetching gallery photos:', err);
            setError('Failed to fetch gallery photos. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGalleries();
    }, [currentPage, debouncedSearchTerm]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setSelectedImageUrl(null);
                setZoomLevel(1);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, []);

    useEffect(() => {
        if (!selectedImageUrl) return undefined;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [selectedImageUrl]);

    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
    };

    const clampZoom = (value) => Math.min(4, Math.max(0.5, value));

    const handleOpenImage = (url) => {
        setSelectedImageUrl(url);
        setZoomLevel(1);
    };

    const handleCloseLightbox = () => {
        setSelectedImageUrl(null);
        setZoomLevel(1);
    };

    const handleZoomIn = () => setZoomLevel((prev) => clampZoom(prev + 0.2));
    const handleZoomOut = () => setZoomLevel((prev) => clampZoom(prev - 0.2));
    const handleZoomReset = () => setZoomLevel(1);

    const handleWheelZoom = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
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
                            <p className="page-description">
                                Moments, memories, and visual stories from our journey
                            </p>
                        </div>
                    </div>

                    <div className="gallery-search-section">
                        <form onSubmit={handleSearch} className="gallery-search-form">
                            <div className="gallery-search-wrapper">
                                <input
                                    type="text"
                                    placeholder="Search gallery photos..."
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
                                    <p className="gallery-no-results-title">No gallery photos found</p>
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
                                            onClick={() => handleOpenImage(getFileUrl(gallery.photo_url))}
                                        >
                                            <div className="gallery-card-image">
                                                {gallery.thumbnail_url || gallery.photo_url ? (
                                                    <img
                                                        src={getFileUrl(gallery.thumbnail_url || gallery.photo_url)}
                                                        alt={`Gallery image ${gallery.id}`}
                                                        className="gallery-card-img"
                                                    />
                                                ) : (
                                                    <div className="gallery-card-img-placeholder"></div>
                                                )}
                                                <div className="gallery-card-overlay">
                                                    <div className="gallery-card-icon">
                                                        <FaImage className="gallery-card-icon-svg" />
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
                                        <span className="pagination-info">
                                            Page {currentPage} of {totalPages}
                                        </span>
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

            {selectedImageUrl && (
                <div
                    className="gallery-lightbox"
                    onClick={handleCloseLightbox}
                    onWheel={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Close image preview"
                >
                    <div className="gallery-lightbox-content" onClick={(e) => e.stopPropagation()} onWheel={handleWheelZoom}>
                        <div className="gallery-lightbox-toolbar">
                            <button
                                type="button"
                                className="gallery-lightbox-action"
                                onClick={handleZoomOut}
                                aria-label="Zoom out"
                            >
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
                            <button
                                type="button"
                                className="gallery-lightbox-action"
                                onClick={handleZoomIn}
                                aria-label="Zoom in"
                            >
                                +
                            </button>
                        </div>
                        <button
                            type="button"
                            className="gallery-lightbox-close"
                            onClick={handleCloseLightbox}
                            aria-label="Close popup"
                        >
                            ×
                        </button>
                        <img
                            src={selectedImageUrl}
                            alt="Gallery preview"
                            className="gallery-lightbox-image"
                            style={{ transform: `scale(${zoomLevel})` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default GalleryList;
