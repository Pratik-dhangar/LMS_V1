import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaCalendar, FaUser, FaArrowLeft } from 'react-icons/fa';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import blogService from '../../api/services/blogService';

const BlogDetail = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [blog, setBlog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        fetchBlog();
    }, [slug]);

    const fetchBlog = async () => {
        try {
            setLoading(true);
            const data = await blogService.getPublicBlogBySlug(slug);
            setBlog(data);
            setError(null);

            // Update page title and meta description for SEO
            document.title = `${data.title} | HurshBinTech Blog`;
            if (data.excerpt) {
                const metaDescription = document.querySelector('meta[name="description"]');
                if (metaDescription) {
                    metaDescription.setAttribute('content', data.excerpt);
                }
            }
        } catch (err) {
            console.error('Error fetching blog:', err);
            if (err.response?.status === 404) {
                setError('Blog post not found');
            } else {
                setError('Failed to fetch blog post. Please try again later.');
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
        });
    };

    const handleImageClick = (imageSrc) => {
        setSelectedImage(imageSrc);
        setShowImageModal(true);
    };

    const handleCloseModal = () => {
        setShowImageModal(false);
        setSelectedImage(null);
    };

    if (loading) return <Loader />;
    if (error) return <ErrorState message={error} />;
    if (!blog) return <ErrorState message="Blog not found" />;

    return (
        <>
            <Navbar />

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
                                <Link to="/blogs" className="text-blue-600 hover:text-blue-800">
                                    Blogs
                                </Link>
                            </li>
                            <li className="text-gray-400">/</li>
                            <li className="text-gray-600 truncate max-w-xs">{blog.title}</li>
                        </ol>
                    </nav>

                    <button
                        onClick={() => navigate('/blogs')}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6"
                    >
                        <FaArrowLeft className="mr-2" />
                        Back to Blogs
                    </button>
                </div>

                {/* Featured Image Banner */}
                {blog.featured_image_url && (
                    <div className="w-full h-96 bg-gray-200 overflow-hidden">
                        <img
                            src={blog.featured_image_url}
                            alt={blog.title}
                            className="w-full h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick(blog.featured_image_url)}
                        />
                    </div>
                )}

                {/* Article Content */}
                <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="bg-white rounded-lg shadow-lg p-8 lg:p-12">
                        {/* Title */}
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            {blog.title}
                        </h1>

                        {/* Meta Information */}
                        <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-8 pb-8 border-b border-gray-200">
                            <div className="flex items-center">
                                <FaUser className="mr-2" />
                                <span className="font-medium">
                                    {blog.author.name}
                                </span>
                            </div>
                            <div className="flex items-center">
                                <FaCalendar className="mr-2" />
                                <time dateTime={blog.created_at}>{formatDate(blog.created_at)}</time>
                            </div>
                        </div>

                        {/* Excerpt */}
                        {blog.excerpt && (
                            <div className="text-xl text-gray-600 italic mb-8 pb-8 border-b border-gray-200">
                                {blog.excerpt}
                            </div>
                        )}

                        {/* Blog Content */}
                        <div
                            className="prose prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-4xl prose-h1:mb-6
                prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-8
                prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-6
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900 prose-strong:font-bold
                prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
                prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
                prose-li:my-2 prose-li:text-gray-700
                prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                prose-img:rounded-lg prose-img:shadow-md prose-img:my-8"
                            dangerouslySetInnerHTML={{ __html: blog.content }}
                        />

                        {/* Author Attribution */}
                        <div className="mt-12 pt-8 border-t border-gray-200">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
                                        {blog.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <p className="text-lg font-semibold text-gray-900">
                                        {blog.author.name}
                                    </p>
                                    <p className="text-sm text-gray-600">Author</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Back to Blogs Button */}
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => navigate('/blogs')}
                            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <FaArrowLeft className="mr-2" />
                            Back to All Blogs
                        </button>
                    </div>
                </article>
            </div>

            {/* Image Modal */}
            {showImageModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
                    onClick={handleCloseModal}
                >
                    <button
                        onClick={handleCloseModal}
                        className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 transition-colors z-10"
                        aria-label="Close"
                    >
                        ×
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            <Footer />
        </>
    );
};

export default BlogDetail;
