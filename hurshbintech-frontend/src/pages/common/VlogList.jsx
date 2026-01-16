import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaSearch, FaCalendar, FaPlay } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import vlogService from '../../api/services/vlogService';

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
        <>
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 text-white py-20 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 20px 20px, white 2px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }}></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight">Our Vlogs</h1>
                        <p className="text-xl md:text-2xl text-purple-100 mb-10 font-light">
                            Watch video tutorials and insights from our experts
                        </p>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full blur-lg opacity-30"></div>
                                <div className="relative bg-white rounded-full shadow-2xl overflow-hidden flex items-center">
                                    <input
                                        type="text"
                                        placeholder="Search vlogs..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 px-8 py-5 pl-16 text-gray-900 text-base md:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 bg-white border-0"
                                    />
                                    <FaSearch className="absolute left-6 top-1/2 transform -translate-y-1/2 text-purple-500 text-lg md:text-xl flex-shrink-0" />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setCurrentPage(1);
                                            }}
                                            className="px-6 py-2 mr-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all duration-200 font-semibold text-sm flex-shrink-0"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Vlog Grid */}
            <div className="max-w-8xl  px-4 sm:px-6 lg:px-8 py-16 bg-gray-50">
                {/* Breadcrumb */}
                <nav className="mb-10 text-sm">
                    <ol className="flex items-center space-x-2">
                        <li>
                            <Link to="/" className="text-purple-600 hover:text-purple-800 font-medium transition-colors">
                                Home
                            </Link>
                        </li>
                        <li className="text-gray-400">/</li>
                        <li className="text-gray-700 font-semibold">Vlogs</li>
                    </ol>
                </nav>

                {vlogs.length === 0 ? (
                    <div className="flex items-center justify-center min-h-96 animate-fadeIn">
                        <div className="text-center">
                            <div className="inline-block p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
                                <p className="text-3xl font-bold text-gray-900 mb-3">No vlogs found</p>
                                <p className="text-gray-500 mb-6 text-lg">Try adjusting your search</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 animate-fadeIn">
                            {vlogs.map((vlog, index) => (
                                <article
                                    key={vlog.id}
                                    className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 animate-fadeIn"
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                    }}
                                    onClick={() => navigate(`/vlogs/${vlog.id}`)}
                                >
                                    {/* Thumbnail */}
                                    <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-indigo-900 group overflow-hidden">
                                        {vlog.thumbnail_url ? (
                                            <img
                                                src={vlog.thumbnail_url}
                                                alt={vlog.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600"></div>
                                        )}

                                        {/* Play Button Overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black bg-opacity-40">
                                            <div className="bg-white rounded-full p-5 shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                                                <FaPlay className="text-purple-600 text-4xl ml-1" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-7">
                                        <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-purple-600 line-clamp-2 transition-colors">
                                            {vlog.title}
                                        </h2>

                                        {vlog.description && (
                                            <p className="text-gray-600 mb-5 line-clamp-2 leading-relaxed">
                                                {vlog.description}
                                            </p>
                                        )}

                                        {/* Meta Info */}
                                        <div className="flex items-center text-sm text-gray-500 pt-4 border-t border-gray-100">
                                            <FaCalendar className="mr-2 text-purple-500" />
                                            <span className="font-medium">{formatDate(vlog.created_at)}</span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3 flex-wrap">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-6 py-3 bg-white border-2 border-purple-200 rounded-xl text-purple-700 font-semibold hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                >
                                    Previous
                                </button>

                                <div className="flex gap-2">
                                    {[...Array(totalPages)].map((_, idx) => {
                                        const pageNum = idx + 1;
                                        // Show first, last, current, and pages around current
                                        if (
                                            pageNum === 1 ||
                                            pageNum === totalPages ||
                                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                        ) {
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`px-5 py-3 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md ${currentPage === pageNum
                                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white scale-110 shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-purple-200'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                            return (
                                                <span key={idx} className="px-3 py-3 text-gray-400 font-bold">
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
                                    className="px-6 py-3 bg-white border-2 border-purple-200 rounded-xl text-purple-700 font-semibold hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {/* Results Info */}
                        <div className="text-center mt-10 text-gray-600 text-lg font-medium bg-white py-4 rounded-xl shadow-sm">
                            Showing <span className="text-purple-600 font-bold">{(currentPage - 1) * 10 + 1}</span> - <span className="text-purple-600 font-bold">{Math.min(currentPage * 10, total)}</span> of <span className="text-purple-600 font-bold">{total}</span>{' '}
                            vlogs
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default VlogList;
