import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cartService from '../../api/services/ecommerce/cartService';
import { toast } from 'react-toastify';

const Cart = () => {
    const navigate = useNavigate();
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCart();
    }, []);

    const loadCart = async () => {
        try {
            setLoading(true);
            const data = await cartService.getCart();
            setCart(data);
        } catch (error) {
            if (error.response?.status === 401) {
                toast.info('Please login to view your cart');
                navigate('/auth/login');
            } else {
                console.error('Failed to load cart:', error);
                toast.error('Failed to load cart');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveItem = async (itemId) => {
        try {
            await cartService.removeFromCart(itemId);
            toast.success('Item removed from cart');
            loadCart();
        } catch (error) {
            toast.error('Failed to remove item');
        }
    };

    const handleUpdateQuantity = async (itemId, newQuantity) => {
        if (newQuantity < 1) return;
        try {
            await cartService.updateCartItem(itemId, newQuantity);
            loadCart();
        } catch (error) {
            toast.error('Failed to update quantity');
        }
    };

    const handleClearCart = async () => {
        if (!window.confirm('Are you sure you want to clear your cart?')) return;
        try {
            await cartService.clearCart();
            toast.success('Cart cleared');
            loadCart();
        } catch (error) {
            toast.error('Failed to clear cart');
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '18px', color: '#7f8c8d' }}>Loading cart...</p>
            </div>
        );
    }

    const hasItems = cart && cart.items && cart.items.length > 0;

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '30px 20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    padding: '30px',
                    borderTop: '4px solid #27ae60'
                }}>
                    <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px' }}>
                        Shopping Cart ({hasItems ? cart.items.length : 0} items)
                    </h1>

                    {!hasItems ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🛒</div>
                            <h2 style={{ fontSize: '24px', color: '#2c3e50', marginBottom: '10px' }}>
                                Your cart is empty
                            </h2>
                            <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
                                Looks like you haven't added anything to your cart yet
                            </p>
                            <button
                                onClick={() => navigate('/store')}
                                style={{
                                    padding: '12px 30px',
                                    background: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Start Shopping
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '30px' }}>
                            {/* Cart Items */}
                            <div style={{ flex: 2 }}>
                                {cart.items.map(item => (
                                    <div
                                        key={item.id}
                                        style={{
                                            background: 'white',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '8px',
                                            padding: '20px',
                                            marginBottom: '15px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div
                                                style={{
                                                    width: '100px',
                                                    height: '100px',
                                                    background: '#f8f9fa',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderRadius: '6px',
                                                    flexShrink: 0,
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {item.product?.image_url ? (
                                                    <img
                                                        src={item.product.image_url}
                                                        alt={item.product.name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'cover'
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{ fontSize: '48px' }}>📦</div>
                                                )}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{
                                                    fontSize: '18px',
                                                    fontWeight: '600',
                                                    color: '#2c3e50',
                                                    marginBottom: '8px'
                                                }}>
                                                    {item.product?.name || 'Product'}
                                                </h3>
                                                <div style={{ fontSize: '14px', color: '#7f8c8d', marginBottom: '12px' }}>
                                                    Price: ₹{item.price_at_addition}
                                                    {item.discount_at_addition > 0 && (
                                                        <span style={{ color: '#27ae60', marginLeft: '8px' }}>
                                                            ({item.discount_at_addition}% off)
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                            style={{
                                                                background: '#ecf0f1',
                                                                border: '1px solid #ddd',
                                                                padding: '6px 12px',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                                fontSize: '16px'
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <div style={{
                                                            padding: '6px 15px',
                                                            border: '1px solid #ddd',
                                                            borderRadius: '4px',
                                                            minWidth: '50px',
                                                            textAlign: 'center',
                                                            fontSize: '14px',
                                                            fontWeight: '600'
                                                        }}>
                                                            {item.quantity}
                                                        </div>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                            style={{
                                                                background: '#ecf0f1',
                                                                border: '1px solid #ddd',
                                                                padding: '6px 12px',
                                                                cursor: 'pointer',
                                                                borderRadius: '4px',
                                                                fontSize: '16px'
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        style={{
                                                            color: '#e74c3c',
                                                            cursor: 'pointer',
                                                            fontSize: '14px',
                                                            background: 'none',
                                                            border: 'none',
                                                            textDecoration: 'underline'
                                                        }}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: '20px',
                                                    fontWeight: '700',
                                                    color: '#2c3e50'
                                                }}>
                                                    ₹{item.line_total}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Order Summary */}
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    background: 'white',
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '25px',
                                    position: 'sticky',
                                    top: '20px'
                                }}>
                                    <h3 style={{
                                        fontSize: '20px',
                                        fontWeight: '600',
                                        marginBottom: '20px',
                                        color: '#2c3e50',
                                        paddingBottom: '15px',
                                        borderBottom: '2px solid #f0f0f0'
                                    }}>
                                        Order Summary
                                    </h3>

                                    <div style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: '20px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '14px' }}>
                                            <span style={{ color: '#555' }}>Subtotal</span>
                                            <span style={{ fontWeight: '600', color: '#2c3e50' }}>₹{cart.subtotal}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '14px' }}>
                                            <span style={{ color: '#555' }}>Discount</span>
                                            <span style={{ color: '#27ae60', fontWeight: '600' }}>-₹{cart.discount_total}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0', fontSize: '14px' }}>
                                            <span style={{ color: '#555' }}>Delivery</span>
                                            <span style={{ color: '#27ae60', fontWeight: '600' }}>FREE</span>
                                        </div>
                                    </div>

                                    <div style={{ paddingBottom: '20px', marginBottom: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold' }}>
                                            <span style={{ color: '#2c3e50' }}>Total</span>
                                            <span style={{ color: '#27ae60' }}>₹{cart.total}</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => navigate('/store/checkout')}
                                        style={{
                                            width: '100%',
                                            padding: '14px',
                                            background: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            marginBottom: '12px'
                                        }}
                                    >
                                        Proceed to Checkout
                                    </button>

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
                                            cursor: 'pointer',
                                            marginBottom: '12px'
                                        }}
                                    >
                                        Continue Shopping
                                    </button>

                                    <button
                                        onClick={handleClearCart}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            background: '#f8f9fa',
                                            color: '#e74c3c',
                                            border: '1px solid #e74c3c',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Cart
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Cart;
