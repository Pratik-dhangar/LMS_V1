import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Table.css';
import '../../styles/admin/AdminManageLearningGoals.css';
import '../../styles/ManageUsersLayout.css';
import blogService from '../../api/services/blogService';

const ManageBlogs = () => {
    const navigate = useNavigate();
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [selectedBlog, setSelectedBlog] = useState(null);
    const [activeSearchQuery, setActiveSearchQuery] = useState('');

    const fetchBlogs = async () => {
        try {
            setLoading(true);
            const response = await blogService.getAdminBlogs({
                page: currentPage,
                per_page: 10,
                status_filter: statusFilter || undefined,
                search: searchTerm || undefined,
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
    }, [currentPage, statusFilter, searchTerm]);

    const handleSearch = (query) => {
        setActiveSearchQuery(query);
        setSearchTerm(query);
        setCurrentPage(1); // Reset to first page on search
    };

    const handleStatusFilter = (e) => {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleCreate = () => {
        navigate('/admin/blogs/create');
    };

    const handleEdit = (blog) => {
        navigate(`/admin/blogs/${blog.id}/edit`);
    };

    const handleDeleteClick = (blog) => {
        if (!window.confirm(`Delete "${blog.title}"?`)) return;
        handleDelete(blog.id);
    };

    const handleDelete = async (blogId) => {
        try {
            await blogService.deleteBlog(blogId);
            toast.success('Blog deleted successfully');
            await fetchBlogs();
        } catch (err) {
            console.error('Error deleting blog:', err);
            toast.error(err.response?.data?.detail || 'Failed to delete blog');
        }
    };

    const handleViewPublic = (blog) => {
        navigate(`/blogs/${blog.slug}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const truncateText = (text, length) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    };

    const filteredBlogs = blogs.filter((blog) =>
        blog.title.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
        (blog.excerpt && blog.excerpt.toLowerCase().includes(activeSearchQuery.toLowerCase())) ||
        (blog.author && blog.author.name.toLowerCase().includes(activeSearchQuery.toLowerCase()))
    );

    return (
        <div className="page-container">
            <Navbar />
            <div className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
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
                            Back to Dashboard
                        </button>
                        <div>
                            <h1 className="page-title">Manage Blogs</h1>
                            <p className="page-description">
                                Create and manage blog posts ({total} total)
                            </p>
                        </div>
                    </div>

                    {/* Search Bar and Add Button */}
                    <div className="search-section">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search by title, author, or content..."
                        />
                        <button
                            onClick={handleCreate}
                            className="btn-success"
                        >
                            + Create Blog
                        </button>
                    </div>
                    {activeSearchQuery && (
                        <div className="search-results-info">
                            <p className="search-results-text">
                                Found {filteredBlogs.length} of {blogs.length} blogs
                            </p>
                        </div>
                    )}

                    {/* Table */}
                    {loading ? (
                        <div className="loading-container">
                            <div className="loading-spinner"></div>
                        </div>
                    ) : filteredBlogs.length === 0 ? (
                        <div className="empty-state">
                            <p className="empty-state-description">
                                {activeSearchQuery
                                    ? 'No blogs match your search'
                                    : 'No blogs found. Create your first blog to get started!'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-primary-container">
                            {/* Desktop Table */}
                            <div className="table-primary-wrapper table-desktop">
                                <table className="table-primary">
                                    <thead className="table-primary-header">
                                        <tr>
                                            <th className="table-primary-th table-primary-th-center">Sr. No.</th>
                                            <th className="table-primary-th">Title</th>
                                            <th className="table-primary-th">Author</th>
                                            <th className="table-primary-th">Status</th>
                                            <th className="table-primary-th">Created</th>
                                            <th className="table-primary-th table-primary-th-center">View</th>
                                            <th className="table-primary-th table-primary-th-center">Edit</th>
                                            <th className="table-primary-th table-primary-th-center">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-primary-body">
                                        {filteredBlogs.map((blog, index) => (
                                            <tr key={blog.id} className="table-primary-row">
                                                <td className="table-primary-td table-primary-td-center">
                                                    {(currentPage - 1) * 10 + index + 1}
                                                </td>
                                                <td className="table-primary-td">
                                                    <div className="table-primary-cell-name">
                                                        <div className="table-primary-cell-name-text">
                                                            {truncateText(blog.title, 50)}
                                                        </div>
                                                        {blog.excerpt && (
                                                            <div className="table-primary-cell-subtitle">
                                                                {truncateText(blog.excerpt, 60)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="table-primary-td">
                                                    {blog.author?.name || 'N/A'}
                                                </td>
                                                <td className="table-primary-td">
                                                    <span className={`admin-content-status-badge ${blog.status === 'published' ? 'admin-content-status-published' : 'admin-content-status-draft'}`}>
                                                        {blog.status}
                                                    </span>
                                                </td>
                                                <td className="table-primary-td">
                                                    {formatDate(blog.created_at)}
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    {blog.status === 'published' && (
                                                        <button
                                                            onClick={() => handleViewPublic(blog)}
                                                            className="btn-primary btn-sm btn-icon"
                                                        >
                                                            <svg
                                                                className="table-primary-icon-sm"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                />
                                                                <path
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    strokeWidth={2}
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                />
                                                            </svg>
                                                            View
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <button
                                                        onClick={() => handleEdit(blog)}
                                                        className="btn-primary btn-sm btn-icon"
                                                    >
                                                        <svg
                                                            className="table-primary-icon-sm"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                            />
                                                        </svg>
                                                        Edit
                                                    </button>
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <button
                                                        onClick={() => handleDeleteClick(blog)}
                                                        className="btn-danger btn-sm btn-icon"
                                                    >
                                                        <svg
                                                            className="table-primary-icon-sm"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeWidth={2}
                                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                            />
                                                        </svg>
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default ManageBlogs;
