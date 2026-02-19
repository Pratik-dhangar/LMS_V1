import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaSearch, FaCalendar, FaPlay } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import vlogService from '../../api/services/vlogService';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/ManageUsersLayout.css';
import '../../styles/pages/VlogList.css';

const VlogList = () => {
    const [vlogs, setVlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const navigate = useNavigate();
    const debounceTimerRef = useRef(null);

    // Debounce search term - only update after 500ms of no typing
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

    const fetchVlogs = async () => {
        try {
            setLoading(true);
            const response = await vlogService.getPublicVlogs({
                page: currentPage,
                per_page: 10,
                search: debouncedSearchTerm || undefined,
            });
            setVlogs(response.vlogs);
            setTotal(response.total);
            setTotalPages(response.total_pages);
            setError(null);
        } catch (err) {
            console.error('Error fetching vlogs:', err);
            setError('Failed to fetch vlogs. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVlogs();
    }, [currentPage, debouncedSearchTerm]);

    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const truncateText = (text, length) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    };

    const formatFileSize = (sizeInMB) => {
        if (!sizeInMB) return '';
        if (sizeInMB >= 1024) {
            return (sizeInMB / 1024).toFixed(2) + ' GB';
        }
        return sizeInMB.toFixed(2) + ' MB';
    };

    if (loading && vlogs.length === 0) return <Loader />;
    if (error && vlogs.length === 0) return <ErrorState message={error} />;

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/')}
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
                            Go Back
                        </button>
                        <div>
                            <h1 className="page-title">Our Vlogs</h1>
                            <p className="page-description">
                                Watch video tutorials and insights from our experts
                            </p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="vlog-search-section">
                        <form onSubmit={handleSearch} className="vlog-search-form">
                            <div className="vlog-search-wrapper">
                                <input
                                    type="text"
                                    placeholder="Search vlogs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="vlog-search-input"
                                />
                                <FaSearch className="vlog-search-icon" />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setCurrentPage(1);
                                        }}
                                        className="vlog-search-clear-btn"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="page-content">
                        {vlogs.length === 0 ? (
                            <div className="vlog-no-results">
                                <div className="vlog-no-results-content">
                                    <p className="vlog-no-results-title">No vlogs found</p>
                                    <p className="vlog-no-results-text">
                                        Try adjusting your search
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="vlog-grid">
                                    {vlogs.map((vlog, index) => (
                                        <article
                                            key={vlog.id}
                                            className="vlog-card"
                                            onClick={() => navigate(`/vlogs/${vlog.id}`)}
                                        >
                                            {/* Thumbnail */}
                                            <div className="vlog-card-image">
                                                {vlog.thumbnail_url ? (
                                                    <img
                                                        src={getFileUrl(vlog.thumbnail_url)}
                                                        alt={vlog.title}
                                                        className="vlog-card-img"
                                                    />
                                                ) : (
                                                    <div className="vlog-card-img-placeholder"></div>
                                                )}

                                                {/* Play Button Overlay */}
                                                <div className="vlog-card-play-overlay">
                                                    <div className="vlog-card-play-button">
                                                        <FaPlay className="vlog-card-play-icon" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="vlog-card-content">
                                                <h2 className="vlog-card-title">
                                                    {vlog.title}
                                                </h2>

                                                {vlog.description && (
                                                    <p className="vlog-card-description">
                                                        {vlog.description}
                                                    </p>
                                                )}

                                                {/* Meta Info */}
                                                <div className="vlog-card-meta">
                                                    <FaCalendar className="vlog-card-meta-icon" />
                                                    <span>{formatDate(vlog.created_at)}</span>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="vlog-pagination">
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="vlog-pagination-btn"
                                        >
                                            Previous
                                        </button>

                                        <div className="vlog-pagination-pages">
                                            {[...Array(totalPages)].map((_, idx) => {
                                                const pageNum = idx + 1;
                                                if (
                                                    pageNum === 1 ||
                                                    pageNum === totalPages ||
                                                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                ) {
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`vlog-pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                                    return (
                                                        <span key={idx} className="vlog-pagination-ellipsis">
                                                            ...
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="vlog-pagination-btn"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}

                                {/* Results Info */}
                                <div className="vlog-results-info">
                                    Showing <span className="vlog-results-highlight">{(currentPage - 1) * 10 + 1}</span> - <span className="vlog-results-highlight">{Math.min(currentPage * 10, total)}</span> of <span className="vlog-results-highlight">{total}</span> vlogs
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default VlogList;
