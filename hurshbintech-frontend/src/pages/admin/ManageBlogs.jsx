import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchBar from '../../components/common/SearchBar';
import { FaEdit, FaTrash, FaPlus, FaEye, FaSearch } from 'react-icons/fa';
import blogService from '../../api/services/blogService';

const ManageBlogs = () => {
    const [blogs, setBlogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedBlog, setSelectedBlog] = useState(null);
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    const navigate = useNavigate();

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
        console.log('Delete clicked for blog:', blog);
        setSelectedBlog(blog);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        console.log('Confirming delete for blog ID:', selectedBlog?.id);
        try {
            console.log('Sending delete request for blog ID:', selectedBlog.id);
            const response = await blogService.deleteBlog(selectedBlog.id);
            console.log('Delete response:', response);
            toast.success('Blog deleted successfully');
            setShowDeleteModal(false);
            setSelectedBlog(null);
            // Refresh the blog list
            await fetchBlogs();
        } catch (err) {
            console.error('Error deleting blog:', err);
            console.error('Error response:', err.response?.data);
            toast.error(err.response?.data?.detail || 'Failed to delete blog');
            setShowDeleteModal(false);
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

    if (loading && blogs.length === 0) return <Loader />;
    if (error && blogs.length === 0) return <ErrorState message={error} />;

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Manage Blogs</h1>
                                <p className="mt-2 text-sm text-gray-600">
                                    Create and manage blog posts ({total} total)
                                </p>
                            </div>
                            <button
                                onClick={handleCreate}
                                className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <FaPlus className="mr-2" />
                                Create Blog
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-lg shadow p-4 mb-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <SearchBar
                                    onSearch={handleSearch}
                                    placeholder="Search by title, author, or content..."
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={handleStatusFilter}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
                            >
                                <option value="">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                    </div>

                    {/* Search Results Info */}
                    {activeSearchQuery && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p className="text-blue-800">
                                Found {blogs.length} blog(s) matching "{activeSearchQuery}"
                            </p>
                        </div>
                    )}

                    {/* Blog List */}
                    {blogs.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center">
                            <p className="text-gray-500 text-lg">
                                {activeSearchQuery ? 'No blogs match your search' : 'No blogs found'}
                            </p>
                            <button
                                onClick={handleCreate}
                                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <FaPlus className="mr-2" />
                                Create First Blog
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Title
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Author
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {blogs.map((blog) => (
                                            <tr key={blog.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        {blog.featured_image_url && (
                                                            <img
                                                                src={blog.featured_image_url}
                                                                alt={blog.title}
                                                                className="h-12 w-16 object-cover rounded mr-4"
                                                            />
                                                        )}
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {truncateText(blog.title, 50)}
                                                            </div>
                                                            {blog.excerpt && (
                                                                <div className="text-sm text-gray-500">
                                                                    {truncateText(blog.excerpt, 60)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">
                                                        {blog.author.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${blog.status === 'published'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                            }`}
                                                    >
                                                        {blog.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {formatDate(blog.created_at)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {blog.status === 'published' && (
                                                            <button
                                                                onClick={() => handleViewPublic(blog)}
                                                                className="text-blue-600 hover:text-blue-900"
                                                                title="View Public"
                                                            >
                                                                <FaEye className="text-lg" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleEdit(blog)}
                                                            className="text-indigo-600 hover:text-indigo-900"
                                                            title="Edit"
                                                        >
                                                            <FaEdit className="text-lg" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                console.log('Delete button clicked for blog:', blog);
                                                                handleDeleteClick(blog);
                                                            }}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Delete"
                                                        >
                                                            <FaTrash className="text-lg" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                    <div className="flex-1 flex justify-between sm:hidden">
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
                                                <span className="font-medium">
                                                    {Math.min(currentPage * 10, total)}
                                                </span>{' '}
                                                of <span className="font-medium">{total}</span> results
                                            </p>
                                        </div>
                                        <div>
                                            <nav
                                                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                                                aria-label="Pagination"
                                            >
                                                <button
                                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                    disabled={currentPage === 1}
                                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Previous
                                                </button>
                                                {[...Array(totalPages)].map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setCurrentPage(idx + 1)}
                                                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === idx + 1
                                                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Next
                                                </button>
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Footer />

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                show={showDeleteModal}
                title="Delete Blog"
                message={`Are you sure you want to delete "${selectedBlog?.title}"?`}
                onConfirm={handleDelete}
                onClose={() => {
                    setShowDeleteModal(false);
                    setSelectedBlog(null);
                }}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </>
    );
};

export default ManageBlogs;
