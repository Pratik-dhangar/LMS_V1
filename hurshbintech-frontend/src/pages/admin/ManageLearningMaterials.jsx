import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Upload, ArrowLeft } from 'lucide-react';
import SearchBar from '../../components/common/SearchBar';
import { getFileUrl } from '../../utils/urlHelper';
import '../../styles/admin/index.css';
import '../../styles/ManageUsersLayout.css';
import '../../styles/Table.css';
import '../../styles/admin/ManageLearningMaterials.css';

const ManageLearningMaterials = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imagePreviewType, setImagePreviewType] = useState(null); // 'image' | 'video' | 'pdf' | null
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        category_id: '',
        price: '',
        discount_percentage: 0,
        stock_quantity: '',
        age_group_ids: [],
        skill_ids: [],
        tags: [],
        visibility: 'DRAFT'
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        setFilteredProducts(products);
    }, [products]);

    const handleSearch = (query) => {
        setSearchTerm(query);
        if (query.trim() === '') {
            setFilteredProducts(products);
        } else {
            const filtered = products.filter(product => {
                const searchLower = query.toLowerCase();
                return (
                    product.name.toLowerCase().includes(searchLower) ||
                    product.description?.toLowerCase().includes(searchLower) ||
                    product.category?.name.toLowerCase().includes(searchLower) ||
                    product.tags?.some(tag => tag.toLowerCase().includes(searchLower))
                );
            });
            setFilteredProducts(filtered);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [productsRes, categoriesRes, ageGroupsRes, skillsRes] = await Promise.all([
                axios.get('/products'),
                axios.get('/products/categories'),
                axios.get('/products/age-groups'),
                axios.get('/products/skills')
            ]);
            setProducts(productsRes.data || []);
            setCategories(categoriesRes.data || []);
            setAgeGroups(ageGroupsRes.data || []);
            setSkills(skillsRes.data || []);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (name, value) => {
        setFormData(prev => {
            const currentArray = prev[name];
            const newArray = currentArray.includes(value)
                ? currentArray.filter(v => v !== value)
                : [...currentArray, value];
            return { ...prev, [name]: newArray };
        });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Allow images, PDFs and common videos (mp4, webm, ogg)
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            const allowedDocTypes = ['application/pdf'];

            // Size limits
            const maxImageSize = 5 * 1024 * 1024; // 5MB
            const maxVideoSize = 50 * 1024 * 1024; // 50MB
            const maxDocSize = 10 * 1024 * 1024; // 10MB

            const type = file.type;
            if (
                !allowedImageTypes.includes(type) &&
                !allowedVideoTypes.includes(type) &&
                !allowedDocTypes.includes(type)
            ) {
                toast.error('Invalid file type. Allowed: JPG/PNG/PDF/MP4/WebM/OGG');
                return;
            }

            if (allowedImageTypes.includes(type) && file.size > maxImageSize) {
                toast.error('Image is too large. Max size is 5MB.');
                return;
            }
            if (allowedVideoTypes.includes(type) && file.size > maxVideoSize) {
                toast.error('Video is too large. Max size is 50MB.');
                return;
            }
            if (allowedDocTypes.includes(type) && file.size > maxDocSize) {
                toast.error('Document is too large. Max size is 10MB.');
                return;
            }

            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                // For images, videos and PDFs, reader.result is a data URL
                setImagePreview(reader.result);
                // determine preview type
                if (allowedImageTypes.includes(type)) setImagePreviewType('image');
                else if (allowedVideoTypes.includes(type)) setImagePreviewType('video');
                else if (allowedDocTypes.includes(type)) setImagePreviewType('pdf');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedThumbTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
            const maxThumbSize = 1 * 1024 * 1024; // 1MB
            if (!allowedThumbTypes.includes(file.type)) {
                toast.error('Invalid thumbnail type. Allowed: JPG/PNG/WEBP');
                return;
            }
            if (file.size > maxThumbSize) {
                toast.error('Thumbnail is too large. Max size is 1MB.');
                return;
            }
            setThumbnailFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setThumbnailPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.category_id || !formData.price || !formData.stock_quantity) {
            toast.error('Please fill all required fields');
            return;
        }

        try {
            const submitData = new FormData();
            submitData.append('name', formData.name);
            submitData.append('description', formData.description);
            submitData.append('category_id', formData.category_id);
            submitData.append('price', formData.price);
            submitData.append('discount_percentage', formData.discount_percentage);
            submitData.append('stock_quantity', formData.stock_quantity);
            submitData.append('visibility', formData.visibility);

            formData.age_group_ids.forEach(id => submitData.append('age_group_ids', id));
            formData.skill_ids.forEach(id => submitData.append('skill_ids', id));
            formData.tags.forEach(tag => submitData.append('tags', tag));

            if (imageFile) {
                submitData.append('image', imageFile);
            }
            if (thumbnailFile) {
                submitData.append('thumbnail', thumbnailFile);
            }

            if (editingId) {
                await axios.put(`/products/${editingId}`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Product updated successfully!');
            } else {
                await axios.post('/products', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Product created successfully!');
            }

            resetForm();
            loadData();
        } catch (error) {
            console.error('Error submitting form:', error);
            toast.error(error.response?.data?.detail || 'Failed to save product');
        }
    };

    const handleEdit = (product) => {
        setEditingId(product.id);
        setFormData({
            name: product.name,
            description: product.description || '',
            category_id: product.category_id,
            price: product.price,
            discount_percentage: product.discount_percentage || 0,
            stock_quantity: product.stock_quantity,
            age_group_ids: product.age_groups?.map(ag => ag.id) || [],
            skill_ids: product.skills?.map(s => s.id) || [],
            tags: product.tags || [],
            visibility: product.visibility || 'DRAFT'
        });
        // Normalize existing image URL so preview can load (handles local uploads and S3)
        if (product.image_url) {
            const raw = product.image_url || '';
            const normalized = raw.startsWith('/') ? raw.slice(1) : raw;
            const previewUrl = getFileUrl(normalized) || product.image_url;
            setImagePreview(previewUrl);
            // derive preview type from extension
            const ext = normalized.split('.').pop().toLowerCase();
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) setImagePreviewType('image');
            else if (['mp4', 'webm', 'ogg'].includes(ext)) setImagePreviewType('video');
            else if (ext === 'pdf') setImagePreviewType('pdf');
            else setImagePreviewType(null);
        } else {
            setImagePreview(null);
        }
        // thumbnail
        if (product.thumbnail_url) {
            const rawThumb = product.thumbnail_url || '';
            const normalizedThumb = rawThumb.startsWith('/') ? rawThumb.slice(1) : rawThumb;
            const thumbPreviewUrl = getFileUrl(normalizedThumb) || product.thumbnail_url;
            setThumbnailPreview(thumbPreviewUrl);
        } else {
            setThumbnailPreview(null);
        }
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                await axios.delete(`/products/${id}`);
                toast.success('Product deleted successfully!');
                loadData();
            } catch (error) {
                console.error('Error deleting product:', error);
                toast.error('Failed to delete product');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            category_id: '',
            price: '',
            discount_percentage: 0,
            stock_quantity: '',
            age_group_ids: [],
            skill_ids: [],
            tags: [],
            visibility: 'DRAFT'
        });
        setImageFile(null);
        setImagePreview(null);
        setThumbnailFile(null);
        setThumbnailPreview(null);
        setEditingId(null);
        setShowForm(false);
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-container">
                    <div className="loading-spinner-icon"></div>
                    <p className="loading-text">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
                <main className="page-main">
                    <div className="page-content">
                        {/* Page Header */}
                        <div className="page-header">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="back-button"
                            >
                                <ArrowLeft size={20} />
                                Back to Dashboard
                            </button>
                            <div>
                                <h1 className="page-title">
                                    Manage Learning Materials
                                </h1>
                                <p className="page-description">
                                    Create, edit, and manage learning products and materials
                                </p>
                            </div>
                        </div>

                        {/* Search and Add Button Section */}
                        <div className="manage-users-search-section">
                            <SearchBar
                                onSearch={handleSearch}
                                placeholder="Search by name, description, category, or tags..."
                            />
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowForm(true);
                                }}
                                className="app-modal-btn app-modal-btn--success"
                            >
                                <Plus size={20} /> Add New Product
                            </button>
                        </div>

                    {/* Form Modal */}
                    {showForm && (
                        <div className="learning-materials-modal-overlay">
                            <div className="learning-materials-modal">
                                <div className="learning-materials-modal-header">
                                    <h2 className="learning-materials-modal-title">
                                        {editingId ? 'Edit Product' : 'Add New Product'}
                                    </h2>
                                    <button
                                        onClick={resetForm}
                                        className="learning-materials-close-btn"
                                    >
                                        <X size={24} color="#666" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="learning-materials-form">
                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Product Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Sensory Texture Balls Set"
                                            className="learning-materials-input"
                                            required
                                        />
                                    </div>

                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Description
                                        </label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Product description..."
                                            rows="4"
                                            className="learning-materials-textarea"
                                        />
                                    </div>

                                    <div className="learning-materials-grid-2">
                                        <div className="learning-materials-form-group">
                                            <label className="learning-materials-label">
                                                Category *
                                            </label>
                                            <select
                                                name="category_id"
                                                value={formData.category_id}
                                                onChange={handleInputChange}
                                                className="learning-materials-select"
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="learning-materials-form-group">
                                            <label className="learning-materials-label">
                                                Visibility
                                            </label>
                                            <select
                                                name="visibility"
                                                value={formData.visibility}
                                                onChange={handleInputChange}
                                                className="learning-materials-select"
                                            >
                                                <option value="DRAFT">Draft</option>
                                                <option value="PUBLISHED">Published</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="learning-materials-grid-3">
                                        <div className="learning-materials-form-group">
                                            <label className="learning-materials-label">
                                                Price (₹) *
                                            </label>
                                            <input
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="1"
                                                step="0.01"
                                                className="learning-materials-input"
                                                required
                                            />
                                        </div>

                                        <div className="learning-materials-form-group">
                                            <label className="learning-materials-label">
                                                Discount (%)
                                            </label>
                                            <input
                                                type="number"
                                                name="discount_percentage"
                                                value={formData.discount_percentage}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="0"
                                                max="100"
                                                className="learning-materials-input"
                                            />
                                        </div>

                                        <div className="learning-materials-form-group">
                                            <label className="learning-materials-label">
                                                Stock Quantity *
                                            </label>
                                            <input
                                                type="number"
                                                name="stock_quantity"
                                                value={formData.stock_quantity}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="0"
                                                className="learning-materials-input"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Age Groups
                                        </label>
                                        <div className="learning-materials-checkbox-grid">
                                            {ageGroups.map(age => (
                                                <label key={age.id} className="learning-materials-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.age_group_ids.includes(age.id)}
                                                        onChange={() => handleCheckboxChange('age_group_ids', age.id)}
                                                        className="learning-materials-checkbox"
                                                    />
                                                    <span className="learning-materials-checkbox-text">{age.min_age}-{age.max_age} years</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Skill Focus
                                        </label>
                                        <div className="learning-materials-checkbox-grid">
                                            {skills.map(skill => (
                                                <label key={skill.id} className="learning-materials-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.skill_ids.includes(skill.id)}
                                                        onChange={() => handleCheckboxChange('skill_ids', skill.id)}
                                                        className="learning-materials-checkbox"
                                                    />
                                                    <span className="learning-materials-checkbox-text">{skill.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Product Tags
                                        </label>
                                        <div className="learning-materials-tags-wrapper">
                                            {['Recommended', 'Bestseller', 'New'].map(tag => (
                                                <label key={tag} className="learning-materials-checkbox-label">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.tags.includes(tag)}
                                                        onChange={() => handleCheckboxChange('tags', tag)}
                                                        className="learning-materials-checkbox"
                                                    />
                                                    <span className="learning-materials-checkbox-text">{tag}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="learning-materials-form-group">
                                        <label className="learning-materials-label">
                                            Product Image
                                        </label>
                                        {imagePreview && (
                                            <div className="learning-materials-preview-container">
                                                {imagePreviewType === 'video' ? (
                                                    <video src={imagePreview} controls className="learning-materials-preview-video" />
                                                ) : imagePreviewType === 'pdf' ? (
                                                    <iframe src={imagePreview} title="PDF Preview" className="learning-materials-preview-pdf" />
                                                ) : (
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        className="learning-materials-preview-image"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div className="learning-materials-thumbnail-section">
                                            <label className="learning-materials-label">
                                                Thumbnail (optional)
                                            </label>
                                            <div style={{ marginBottom: '8px' }}>
                                                {thumbnailPreview ? (
                                                    <img src={thumbnailPreview} alt="Thumbnail preview" className="learning-materials-thumbnail-preview" />
                                                ) : (
                                                    <div className="learning-materials-no-thumbnail">No thumbnail</div>
                                                )}
                                            </div>
                                            <label className="learning-materials-thumbnail-upload">
                                                <Upload size={16} color="#666" />
                                                <span className="learning-materials-thumbnail-text">
                                                    {thumbnailFile ? thumbnailFile.name : 'Click to upload thumbnail (JPG/PNG, Max 1MB)'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={handleThumbnailChange}
                                                    className="learning-materials-upload-input"
                                                />
                                            </label>
                                        </div>
                                        <label className="learning-materials-upload-area">
                                            <Upload size={20} color="#3498db" />
                                            <span className="learning-materials-upload-text">
                                                {imageFile ? imageFile.name : 'Click to upload image (JPG/PNG, MP4, PDF, Max 50MB)'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,video/mp4,application/pdf"
                                                onChange={handleImageChange}
                                                className="learning-materials-upload-input"
                                            />
                                        </label>
                                    </div>

                                    <div className="learning-materials-form-actions">
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="learning-materials-btn-cancel"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="learning-materials-btn-submit"
                                        >
                                            {editingId ? 'Update Product' : 'Create Product'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Products Table */}
                    <div className="table-primary-container">
                        {filteredProducts.length === 0 ? (
                            <div className="table-primary-empty">
                                <div className="table-primary-empty-icon">
                                    {searchTerm ? '🔍' : '📦'}
                                </div>
                                <h3 className="table-primary-empty-title">
                                    {searchTerm ? 'No Products Found' : 'No Products Yet'}
                                </h3>
                                <p className="table-primary-empty-description">
                                    {searchTerm 
                                        ? `No products match your search "${searchTerm}". Try a different search term.`
                                        : 'Click "Add New Product" to get started with your first learning material.'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="table-primary-wrapper">
                                <table className="table-primary">
                                    <thead className="table-primary-header">
                                        <tr>
                                            <th className="table-primary-th">Product Name</th>
                                            <th className="table-primary-th">Category</th>
                                            <th className="table-primary-th table-primary-th-center">Price</th>
                                            <th className="table-primary-th table-primary-th-center">Stock</th>
                                            <th className="table-primary-th table-primary-th-center">Status</th>
                                            <th className="table-primary-th table-primary-th-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="table-primary-body">
                                        {filteredProducts.map((product) => (
                                            <tr key={product.id} className="table-primary-row">
                                                <td className="table-primary-td">
                                                    <div className="table-primary-cell-name">
                                                        <span className="table-primary-cell-name-text">{product.name}</span>
                                                        {product.description && (
                                                            <span className="table-primary-cell-subtitle">
                                                                {product.description.substring(0, 50)}{product.description.length > 50 ? '...' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="table-primary-td">
                                                    {product.category?.name || 'N/A'}
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <span className="table-primary-badge table-primary-badge-success">
                                                        ₹{product.price}
                                                    </span>
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <span className={`table-primary-badge ${product.stock_quantity > 0 ? 'table-primary-badge-success' : 'table-primary-badge-danger'}`}>
                                                        {product.stock_quantity}
                                                    </span>
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <span className={`table-primary-badge ${product.visibility === 'PUBLISHED' ? 'table-primary-badge-info' : 'table-primary-badge-warning'}`}>
                                                        {product.visibility}
                                                    </span>
                                                </td>
                                                <td className="table-primary-td table-primary-td-center">
                                                    <div className="table-primary-actions">
                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            className="table-primary-icon-btn"
                                                            title="Edit"
                                                        >
                                                            <Edit className="table-primary-icon-sm" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            className="table-primary-icon-btn"
                                                            title="Delete"
                                                            style={{ borderColor: '#e74c3c', color: '#e74c3c' }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#e74c3c';
                                                                e.currentTarget.style.color = '#ffffff';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = '#fffbf0';
                                                                e.currentTarget.style.color = '#e74c3c';
                                                            }}
                                                        >
                                                            <Trash2 className="table-primary-icon-sm" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ManageLearningMaterials;
