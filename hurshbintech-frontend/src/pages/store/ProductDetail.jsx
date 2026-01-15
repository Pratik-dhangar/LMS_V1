import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import storeService from '../../api/services/ecommerce/storeService';
import cartService from '../../api/services/ecommerce/cartService';
import { toast } from 'react-toastify';
import { getFileUrl } from '../../utils/fileUrlBuilder';

const ProductDetail = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProduct();
    }, [productId]);

    const loadProduct = async () => {
        try {
            setLoading(true);
            const data = await storeService.getProductDetail(productId);
            setProduct(data);
        } catch (error) {
            console.error('Failed to load product:', error);
            toast.error('Product not found');
            navigate('/store');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToCart = async () => {
        try {
            await cartService.addToCart({ product_id: productId, quantity });
            toast.success('Added to cart!');
            navigate('/store/cart');
        } catch (error) {
            if (error.response?.status === 401) {
                toast.info('Please login to add items to cart');
                navigate('/login');
            } else {
                toast.error(error.response?.data?.detail || 'Failed to add to cart');
            }
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '18px', color: '#7f8c8d' }}>Loading product...</p>
            </div>
        );
    }

    if (!product) return null;

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '30px 20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Breadcrumb */}
                <div style={{ marginBottom: '20px', fontSize: '13px', color: '#7f8c8d' }}>
                    <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Home</span>
                    {' > '}
                    <span style={{ cursor: 'pointer' }} onClick={() => navigate('/store')}>Learning Materials</span>
                    {product.category && (
                        <>
                            {' > '}
                            <span>{product.category.name}</span>
                        </>
                    )}
                    {' > '}
                    <span>{product.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
                    {/* Product Images & Description */}
                    <div style={{ flex: 2 }}>
                        {/* Header with thumbnail and title */}
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            padding: '12px 16px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px'
                        }}>
                            <div style={{ width: '120px', height: '80px', background: '#f8f9fa', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {product.thumbnail_url || product.image_url ? (
                                    (() => {
                                        const thumbnail = product.thumbnail_url || product.image_url;
                                        let src;
                                        if (thumbnail.startsWith('https://') || thumbnail.startsWith('http://')) {
                                            // Already a full URL from backend
                                            src = thumbnail;
                                        } else {
                                            // Local path or S3 key, use getFileUrl helper
                                            const normalized = thumbnail.startsWith('/') ? thumbnail.slice(1) : thumbnail;
                                            src = getFileUrl(normalized);
                                        }
                                        return (
                                            <img
                                                src={src}
                                                alt={product.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '<div style="font-size: 36px">📦</div>';
                                                }}
                                            />
                                        );
                                    })()
                                ) : (
                                    <div style={{ fontSize: '36px' }}>📦</div>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#2c3e50' }}>{product.name}</h2>
                            </div>
                        </div>

                        {/* Product Description */}
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            padding: '20px',
                            marginTop: '15px'
                        }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#2c3e50' }}>
                                Product Description
                            </h3>
                            <p style={{ lineHeight: '1.8', color: '#555', margin: '10px 0', fontSize: '14px' }}>
                                {(product.description && product.description.toString().trim()) ? product.description : 'No description available.'}
                            </p>
                            {product.features && product.features.length > 0 && (
                                <ul style={{ lineHeight: '1.8', color: '#555', marginLeft: '20px', fontSize: '14px', marginTop: '15px' }}>
                                    {product.features.map((feature, index) => (
                                        <li key={index}>{feature}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Product Info & Purchase */}
                    <div style={{ flex: 1 }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            padding: '20px'
                        }}>
                            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50', marginBottom: '10px' }}>
                                {product.name}
                            </h1>
                            <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '15px' }}>
                                {product.age_groups && product.age_groups.map(age => `${age.min_age}-${age.max_age} years`).join(', ')}
                                {product.skills && product.skills.length > 0 && (
                                    <> | {product.skills.map(s => s.name).join(', ')}</>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '15px 0' }}>
                                <div>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2c3e50' }}>
                                        ₹{product.final_price}
                                    </div>
                                    {product.discount_percentage > 0 && (
                                        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                                            <del>₹{product.price}</del>
                                            <span style={{ color: '#27ae60', marginLeft: '8px', fontWeight: '600' }}>
                                                {product.discount_percentage}% OFF
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quantity Selector */}
                            <div style={{ margin: '15px 0' }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginBottom: '8px' }}>
                                    Quantity
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        style={{
                                            background: '#ecf0f1',
                                            border: '1px solid #ddd',
                                            padding: '8px 15px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            fontSize: '16px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        -
                                    </button>
                                    <div style={{ padding: '8px 20px', border: '1px solid #ddd', borderRadius: '4px', minWidth: '60px', textAlign: 'center' }}>
                                        {quantity}
                                    </div>
                                    <button
                                        onClick={() => setQuantity(quantity + 1)}
                                        style={{
                                            background: '#ecf0f1',
                                            border: '1px solid #ddd',
                                            padding: '8px 15px',
                                            cursor: 'pointer',
                                            borderRadius: '4px',
                                            fontSize: '16px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Add to Cart Button */}
                            <button
                                onClick={handleAddToCart}
                                disabled={!product.stock_available}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: product.stock_available ? '#27ae60' : '#95a5a6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: product.stock_available ? 'pointer' : 'not-allowed',
                                    margin: '15px 0'
                                }}
                            >
                                {product.stock_available ? '🛒 Add to Cart' : 'Out of Stock'}
                            </button>

                            {/* Back to Store Button */}
                            <button
                                onClick={() => navigate('/store')}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'white',
                                    color: '#3498db',
                                    border: '2px solid #3498db',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                ← Continue Shopping
                            </button>
                        </div>

                        {/* Delivery & Returns */}
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            padding: '20px',
                            marginTop: '15px'
                        }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#2c3e50' }}>
                                Delivery & Returns
                            </h3>
                            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
                                🚚 Free Delivery on orders above ₹1000<br />
                                📦 Standard: 5-7 business days<br />
                                ⚡ Express: 2-3 business days (+₹99)<br />
                                🔄 Easy 15-day return policy
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
