import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FaCalendar, FaUser, FaArrowLeft } from 'react-icons/fa';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import blogService from '../../api/services/blogService';
import '../../styles/ManageUsersLayout.css';
import '../../styles/pages/BlogList.css';

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
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header with Back Button */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/blogs')}
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
                            Back to Blogs
                        </button>
                        <div>
                            <h1 className="page-title">Blog Article</h1>
                        </div>
                    </div>

                    {/* Featured Image Banner */}
                    {blog.featured_image_url && (
                        <div className="blog-detail-featured-image">
                            <img
                                src={blog.featured_image_url}
                                alt={blog.title}
                                className="blog-detail-featured-img"
                                onClick={() => handleImageClick(blog.featured_image_url)}
                            />
                        </div>
                    )}

                    {/* Article Content */}
                    <article className="blog-detail-article">
                        <div className="blog-detail-card">
                            {/* Title */}
                            <h1 className="blog-detail-title">
                                {blog.title}
                            </h1>

                            {/* Meta Information */}
                            <div className="blog-detail-meta">
                                <div className="blog-detail-meta-item">
                                    <FaUser className="blog-detail-meta-icon" />
                                    <span>{blog.author.name}</span>
                                </div>
                                <div className="blog-detail-meta-item">
                                    <FaCalendar className="blog-detail-meta-icon" />
                                    <time dateTime={blog.created_at}>{formatDate(blog.created_at)}</time>
                                </div>
                            </div>

                            {/* Excerpt */}
                            {blog.excerpt && (
                                <div className="blog-detail-excerpt">
                                    {blog.excerpt}
                                </div>
                            )}

                            {/* Blog Content */}
                            <div
                                className="blog-detail-content"
                                dangerouslySetInnerHTML={{ __html: blog.content }}
                            />

                            {/* Author Attribution */}
                            <div className="blog-detail-author">
                                <div className="blog-detail-author-wrapper">
                                    <div className="blog-detail-author-avatar">
                                        {blog.author.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                    <div className="blog-detail-author-info">
                                        <p className="blog-detail-author-name">
                                            {blog.author.name}
                                        </p>
                                        <p className="blog-detail-author-role">Author</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Back to Blogs Button */}
                        <div className="blog-detail-back-button-wrapper">
                            <button
                                onClick={() => navigate('/blogs')}
                                className="blog-detail-back-button"
                            >
                                <FaArrowLeft />
                                Back to All Blogs
                            </button>
                        </div>
                    </article>
                </div>
            </main>

            {/* Image Modal */}
            {showImageModal && (
                <div
                    className="blog-image-modal"
                    onClick={handleCloseModal}
                >
                    <button
                        onClick={handleCloseModal}
                        className="blog-image-modal-close"
                        aria-label="Close"
                    >
                        ×
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full size"
                        className="blog-image-modal-img"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default BlogDetail;
