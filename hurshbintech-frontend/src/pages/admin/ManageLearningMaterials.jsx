import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import axios from '../../api/axios';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Upload } from 'lucide-react';
import { getFileUrl } from '../../utils/fileUrlBuilder';
import '../../styles/admin/index.css';

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
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <>
            <Navbar />
            <div style={{ minHeight: 'calc(100vh - 200px)', background: '#f5f6fa', padding: '30px 20px' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                        <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#2c3e50' }}>
                            Manage Learning Materials
                        </h1>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowForm(true);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '12px 24px',
                                background: '#27ae60',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '15px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            <Plus size={20} /> Add New Product
                        </button>
                    </div>

                    {/* Form Modal */}
                    {showForm && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '30px',
                                maxWidth: '800px',
                                width: '90%',
                                maxHeight: '90vh',
                                overflow: 'auto'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50' }}>
                                        {editingId ? 'Edit Product' : 'Add New Product'}
                                    </h2>
                                    <button
                                        onClick={resetForm}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px' }}
                                    >
                                        <X size={24} color="#666" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit}>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                            Product Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Sensory Texture Balls Set"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                boxSizing: 'border-box'
                                            }}
                                            required
                                        />
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                            Description
                                        </label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            placeholder="Product description..."
                                            rows="4"
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                border: '1px solid #ddd',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                Category *
                                            </label>
                                            <select
                                                name="category_id"
                                                value={formData.category_id}
                                                onChange={handleInputChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    background: 'white'
                                                }}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                Visibility
                                            </label>
                                            <select
                                                name="visibility"
                                                value={formData.visibility}
                                                onChange={handleInputChange}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    background: 'white'
                                                }}
                                            >
                                                <option value="DRAFT">Draft</option>
                                                <option value="PUBLISHED">Published</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
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
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    boxSizing: 'border-box'
                                                }}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
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
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                Stock Quantity *
                                            </label>
                                            <input
                                                type="number"
                                                name="stock_quantity"
                                                value={formData.stock_quantity}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="0"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    borderRadius: '6px',
                                                    fontSize: '14px',
                                                    boxSizing: 'border-box'
                                                }}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                                            Age Groups
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                            {ageGroups.map(age => (
                                                <label key={age.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.age_group_ids.includes(age.id)}
                                                        onChange={() => handleCheckboxChange('age_group_ids', age.id)}
                                                        style={{ marginRight: '8px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '14px' }}>{age.min_age}-{age.max_age} years</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                                            Skill Focus
                                        </label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                            {skills.map(skill => (
                                                <label key={skill.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.skill_ids.includes(skill.id)}
                                                        onChange={() => handleCheckboxChange('skill_ids', skill.id)}
                                                        style={{ marginRight: '8px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '14px' }}>{skill.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                                            Product Tags
                                        </label>
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                            {['Recommended', 'Bestseller', 'New'].map(tag => (
                                                <label key={tag} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.tags.includes(tag)}
                                                        onChange={() => handleCheckboxChange('tags', tag)}
                                                        style={{ marginRight: '8px', cursor: 'pointer' }}
                                                    />
                                                    <span style={{ fontSize: '14px' }}>{tag}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#2c3e50' }}>
                                            Product Image
                                        </label>
                                        {imagePreview && (
                                            <div style={{ marginBottom: '10px' }}>
                                                {imagePreviewType === 'video' ? (
                                                    <video src={imagePreview} controls style={{ maxWidth: '320px', maxHeight: '240px', borderRadius: '6px' }} />
                                                ) : imagePreviewType === 'pdf' ? (
                                                    <iframe src={imagePreview} title="PDF Preview" style={{ width: '320px', height: '240px', borderRadius: '6px', border: '1px solid #eee' }} />
                                                ) : (
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '6px' }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#2c3e50' }}>
                                                Thumbnail (optional)
                                            </label>
                                            <div style={{ marginBottom: '8px' }}>
                                                {thumbnailPreview ? (
                                                    <img src={thumbnailPreview} alt="Thumbnail preview" style={{ maxWidth: '120px', maxHeight: '80px', borderRadius: '4px' }} />
                                                ) : (
                                                    <div style={{ color: '#7f8c8d', fontSize: '13px' }}>No thumbnail</div>
                                                )}
                                            </div>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                padding: '10px',
                                                border: '1px dashed #95a5a6',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                background: '#fafafa',
                                                marginBottom: '8px'
                                            }}>
                                                <Upload size={16} color="#666" />
                                                <span style={{ fontSize: '13px', color: '#666' }}>
                                                    {thumbnailFile ? thumbnailFile.name : 'Click to upload thumbnail (JPG/PNG, Max 1MB)'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    onChange={handleThumbnailChange}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        </div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '20px',
                                            border: '2px dashed #3498db',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            background: '#f8f9fa'
                                        }}>
                                            <Upload size={20} color="#3498db" />
                                            <span style={{ fontSize: '14px', color: '#3498db' }}>
                                                {imageFile ? imageFile.name : 'Click to upload image (JPG/PNG, MP4, PDF, Max 50MB)'}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,video/mp4,application/pdf"
                                                onChange={handleImageChange}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            style={{
                                                padding: '10px 24px',
                                                background: '#ecf0f1',
                                                color: '#2c3e50',
                                                border: '1px solid #bdc3c7',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            style={{
                                                padding: '10px 24px',
                                                background: '#27ae60',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                fontWeight: '600',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {editingId ? 'Update Product' : 'Create Product'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Products Table */}
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        overflow: 'hidden'
                    }}>
                        {products.length === 0 ? (
                            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#7f8c8d' }}>
                                <p style={{ fontSize: '16px' }}>No products yet. Click "Add New Product" to get started.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Product Name</th>
                                        <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#2c3e50' }}>Category</th>
                                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>Price</th>
                                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>Stock</th>
                                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>Status</th>
                                        <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#2c3e50' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product, index) => (
                                        <tr
                                            key={product.id}
                                            style={{
                                                borderBottom: '1px solid #e0e0e0',
                                                background: index % 2 === 0 ? 'white' : '#f8f9fa'
                                            }}
                                        >
                                            <td style={{ padding: '15px', color: '#2c3e50', fontSize: '14px', fontWeight: '500' }}>
                                                {product.name}
                                            </td>
                                            <td style={{ padding: '15px', color: '#555', fontSize: '14px' }}>
                                                {product.category?.name || 'N/A'}
                                            </td>
                                            <td style={{ padding: '15px', textAlign: 'center', color: '#27ae60', fontWeight: '600' }}>
                                                ₹{product.price}
                                            </td>
                                            <td style={{ padding: '15px', textAlign: 'center', color: '#555' }}>
                                                <span style={{
                                                    background: product.stock_quantity > 0 ? '#e8f5e9' : '#ffebee',
                                                    color: product.stock_quantity > 0 ? '#27ae60' : '#e74c3c',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    {product.stock_quantity}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px', textAlign: 'center' }}>
                                                <span style={{
                                                    background: product.visibility === 'PUBLISHED' ? '#e3f2fd' : '#fff3e0',
                                                    color: product.visibility === 'PUBLISHED' ? '#2196F3' : '#f39c12',
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                }}>
                                                    {product.visibility}
                                                </span>
                                            </td>
                                            <td style={{ padding: '15px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#3498db',
                                                        cursor: 'pointer',
                                                        marginRight: '15px',
                                                        fontSize: '16px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Edit"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#e74c3c',
                                                        cursor: 'pointer',
                                                        fontSize: '16px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default ManageLearningMaterials;
