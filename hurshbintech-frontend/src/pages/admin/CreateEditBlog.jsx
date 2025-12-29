import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import Loader from '../../components/common/Loader';
import RichTextEditor from '../../components/RichTextEditor';
import { FaSave, FaTimes, FaImage } from 'react-icons/fa';
import blogService from '../../api/services/blogService';

const CreateEditBlog = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        excerpt: '',
        content: '',
        status: 'draft',
    });
    const [featuredImage, setFeaturedImage] = useState(null);
    const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (isEdit) {
            fetchBlog();
        }
    }, [id]);

    const fetchBlog = async () => {
        try {
            setLoading(true);
            const blog = await blogService.getAdminBlog(id);
            setFormData({
                title: blog.title,
                excerpt: blog.excerpt || '',
                content: blog.content,
                status: blog.status,
            });
            if (blog.featured_image_url) {
                setFeaturedImagePreview(blog.featured_image_url);
            }
        } catch (err) {
            console.error('Error fetching blog:', err);
            toast.error('Failed to fetch blog');
            navigate('/admin/blogs');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    const handleContentChange = (html) => {
        setFormData((prev) => ({ ...prev, content: html }));
        if (errors.content) {
            setErrors((prev) => ({ ...prev, content: '' }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
                return;
            }

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size too large. Maximum size is 5MB.');
                return;
            }

            setFeaturedImage(file);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFeaturedImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setFeaturedImage(null);
        setFeaturedImagePreview(null);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        }

        if (!formData.content.trim() || formData.content === '<p></p>') {
            newErrors.content = 'Content is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            setSaving(true);

            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('content', formData.content);
            if (formData.excerpt) {
                formDataToSend.append('excerpt', formData.excerpt);
            }
            formDataToSend.append('status', formData.status);

            if (featuredImage) {
                formDataToSend.append('featured_image', featuredImage);
            }

            if (isEdit) {
                await blogService.updateBlog(id, formDataToSend);
                toast.success('Blog updated successfully');
            } else {
                await blogService.createBlog(formDataToSend);
                toast.success('Blog created successfully');
            }

            navigate('/admin/blogs');
        } catch (err) {
            console.error('Error saving blog:', err);
            toast.error(isEdit ? 'Failed to update blog' : 'Failed to create blog');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        navigate('/admin/blogs');
    };

    if (loading) return <Loader />;

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {isEdit ? 'Edit Blog' : 'Create New Blog'}
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            {isEdit ? 'Update your blog post' : 'Create and publish a new blog post'}
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
                        {/* Title */}
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                className={`w-full px-4 py-2 border ${errors.title ? 'border-red-500' : 'border-gray-300'
                                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                placeholder="Enter blog title"
                            />
                            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
                        </div>

                        {/* Excerpt */}
                        <div>
                            <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700 mb-2">
                                Excerpt
                            </label>
                            <textarea
                                id="excerpt"
                                name="excerpt"
                                value={formData.excerpt}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Brief summary of the blog post (optional)"
                                maxLength={500}
                            />
                            <p className="mt-1 text-sm text-gray-500">
                                {formData.excerpt.length}/500 characters
                            </p>
                        </div>

                        {/* Featured Image */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Featured Image
                            </label>
                            {featuredImagePreview ? (
                                <div className="relative">
                                    <img
                                        src={featuredImagePreview}
                                        alt="Featured"
                                        className="w-full h-64 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                    <FaImage className="mx-auto text-4xl text-gray-400 mb-4" />
                                    <label
                                        htmlFor="featured_image"
                                        className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Choose Image
                                    </label>
                                    <input
                                        type="file"
                                        id="featured_image"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                    <p className="mt-2 text-sm text-gray-500">
                                        JPEG, PNG, or WebP. Max size: 5MB. Recommended: 16:9 aspect ratio
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Content <span className="text-red-500">*</span>
                            </label>
                            <RichTextEditor
                                value={formData.content}
                                onChange={handleContentChange}
                                placeholder="Write your blog content here..."
                            />
                            {errors.content && <p className="mt-1 text-sm text-red-500">{errors.content}</p>}
                        </div>

                        {/* Status */}
                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                            <p className="mt-1 text-sm text-gray-500">
                                {formData.status === 'published'
                                    ? 'Blog will be visible to all users'
                                    : 'Blog will be saved as draft'}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-4 pt-4 border-t">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <svg
                                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FaSave className="mr-2" />
                                        {isEdit ? 'Update Blog' : 'Create Blog'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default CreateEditBlog;
