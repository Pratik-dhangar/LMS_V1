import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaSearch, FaCalendar, FaUser } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import blogService from '../../api/services/blogService';

const BlogList = () => {
    const [blogs, setBlogs] = useState([]);
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

    const fetchBlogs = async () => {
        try {
            setLoading(true);
            const response = await blogService.getPublicBlogs({
                page: currentPage,
                per_page: 10,
                search: debouncedSearchTerm || undefined,
            });
            setBlogs(response.blogs);
            setTotal(response.total);
            setTotalPages(response.total_pages);
            setError(null);
        } catch (err) {
            console.error('Error fetching blogs:', err);
            setError('Failed to fetch blogs. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlogs();
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
        const stripped = text.replace(/<[^>]*>/g, '');
        return stripped.length > length ? stripped.substring(0, length) + '...' : stripped;
    };

    if (loading && blogs.length === 0) return <Loader />;
    if (error && blogs.length === 0) return <ErrorState message={error} />;

    return (
        <>
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white py-20 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle at 20px 20px, white 2px, transparent 0)',
                        backgroundSize: '40px 40px'
                    }}></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight">Our Blog</h1>
                        <p className="text-xl md:text-2xl text-blue-100 mb-10 font-light">
                            Insights, stories, and updates from our team
                        </p>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-lg opacity-30"></div>
                                <div className="relative bg-white rounded-full shadow-2xl overflow-hidden flex items-center">
                                    <input
                                        type="text"
                                        placeholder="Search articles..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="flex-1 px-8 py-5 pl-16 text-gray-900 text-base md:text-lg placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-white focus:ring-opacity-50 bg-white border-0"
                                    />
                                    <FaSearch className="absolute left-6 top-1/2 transform -translate-y-1/2 text-blue-500 text-lg md:text-xl flex-shrink-0" />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setCurrentPage(1);
                                            }}
                                            className="px-6 py-2 mr-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg transition-all duration-200 font-semibold text-sm flex-shrink-0"
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

            {/* Blog Grid */}
            <div className="max-w-8xl  px-4 sm:px-6 lg:px-8 py-16 bg-white">
                {/* Breadcrumb */}
                <nav className="mb-10 text-sm">
                    <ol className="flex items-center space-x-2">
                        <li>
                            <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
                                Home
                            </Link>
                        </li>
                        <li className="text-gray-400">/</li>
                        <li className="text-gray-700 font-semibold">Blogs</li>
                    </ol>
                </nav>

                {blogs.length === 0 ? (
                    <div className="flex items-center justify-center min-h-96 animate-fadeIn">
                        <div className="text-center">
                            <div className="inline-block p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
                                <p className="text-3xl font-bold text-gray-900 mb-3">No blogs found</p>
                                <p className="text-gray-500 mb-6 text-lg">Try adjusting your search</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 animate-fadeIn">
                            {blogs.map((blog, index) => (
                                <article
                                    key={blog.id}
                                    className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 animate-fadeIn"
                                    style={{
                                        animationDelay: `${index * 50}ms`,
                                    }}
                                    onClick={() => navigate(`/blogs/${blog.slug}`)}
                                >
                                    {/* Featured Image */}
                                    <div className="relative aspect-video bg-gradient-to-br from-blue-900 to-indigo-900 group overflow-hidden">
                                        {blog.featured_image_url ? (
                                            <img
                                                src={blog.featured_image_url}
                                                alt={blog.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600"></div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-7">
                                        <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-blue-600 line-clamp-2 transition-colors">
                                            {blog.title}
                                        </h2>

                                        {blog.excerpt && (
                                            <p className="text-gray-600 mb-5 line-clamp-2 leading-relaxed">{blog.excerpt}</p>
                                        )}

                                        {/* Meta Info */}
                                        <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
                                            <div className="flex items-center">
                                                <FaUser className="mr-2" />
                                                <span>
                                                    {blog.author.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center">
                                                <FaCalendar className="mr-2" />
                                                <span>{formatDate(blog.created_at)}</span>
                                            </div>
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
                                    className="px-6 py-3 bg-white border-2 border-blue-200 rounded-xl text-blue-700 font-semibold hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
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
                                                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${currentPage === pageNum
                                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                                            : 'bg-white border-2 border-blue-200 text-blue-700 hover:bg-blue-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                            return (
                                                <span key={idx} className="px-2 py-2 text-gray-400">
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
                                    className="px-6 py-3 bg-white border-2 border-blue-200 rounded-xl text-blue-700 font-semibold hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {/* Results Info */}
                        <div className="text-center mt-10 text-gray-600 text-lg font-medium bg-gradient-to-r from-blue-50 to-indigo-50 py-4 rounded-xl shadow-sm">
                            Showing <span className="text-blue-600 font-bold">{(currentPage - 1) * 10 + 1}</span> - <span className="text-blue-600 font-bold">{Math.min(currentPage * 10, total)}</span> of <span className="text-blue-600 font-bold">{total}</span>{' '}
                            articles
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default BlogList;
