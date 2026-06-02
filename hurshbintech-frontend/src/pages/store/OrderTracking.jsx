import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import orderService from '../../api/services/ecommerce/orderService';
import { toast } from 'react-toastify';
import { Package, Truck, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const OrderTracking = () => {
    const { trackingId } = useParams(); // Can be order_number or guest_token
    const navigate = useNavigate();
    const { user } = useAuth();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (trackingId) {
            loadOrder(trackingId);
        }
    }, [trackingId]);

    const loadOrder = async (id) => {
        try {
            setLoading(true);
            setError(null);

            // Try to fetch the order using the tracking ID
            // The backend should handle both guest_token and order_number
            const data = await orderService.getOrderByTrackingId(id);

            if (!data) {
                setError('Order not found. Please check your tracking ID.');
                return;
            }

            setOrder(data);
        } catch (err) {
            console.error('Failed to load order:', err);
            setError(err.response?.data?.detail || 'Failed to load order details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'CREATED':
                return '#ffc107'; // Orange - pending
            case 'PAYMENT_UPLOADED':
                return '#3498db'; // Blue - uploaded
            case 'PAYMENT_APPROVED':
                return '#27ae60'; // Green - approved
            case 'SHIPPED':
                return '#9b59b6'; // Purple - shipped
            case 'DELIVERED':
                return '#27ae60'; // Green - delivered
            case 'PAYMENT_REJECTED':
                return '#e74c3c'; // Red - rejected
            case 'CANCELLED':
                return '#95a5a6'; // Gray - cancelled
            default:
                return '#7f8c8d';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'CREATED':
            case 'PAYMENT_UPLOADED':
                return <Clock size={24} />;
            case 'PAYMENT_APPROVED':
                return <Package size={24} />;
            case 'SHIPPED':
                return <Truck size={24} />;
            case 'DELIVERED':
                return <CheckCircle size={24} />;
            case 'PAYMENT_REJECTED':
            case 'CANCELLED':
                return <AlertCircle size={24} />;
            default:
                return <Package size={24} />;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'CREATED':
                return 'Order Placed';
            case 'PAYMENT_UPLOADED':
                return 'Payment Uploaded - Awaiting Approval';
            case 'PAYMENT_APPROVED':
                return 'Payment Approved - Processing';
            case 'SHIPPED':
                return 'Shipped';
            case 'DELIVERED':
                return 'Delivered';
            case 'PAYMENT_REJECTED':
                return 'Payment Rejected';
            case 'CANCELLED':
                return 'Order Cancelled';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '18px', color: '#7f8c8d' }}>Loading order details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
                <div style={{ maxWidth: '500px', background: 'white', padding: '40px', borderRadius: '8px', textAlign: 'center' }}>
                    <AlertCircle size={64} style={{ color: '#e74c3c', margin: '0 auto 20px' }} />
                    <h2 style={{ color: '#e74c3c', marginBottom: '10px' }}>Order Not Found</h2>
                    <p style={{ color: '#666', marginBottom: '20px' }}>{error}</p>
                    <button
                        onClick={() => navigate('/store')}
                        style={{
                            padding: '10px 20px',
                            background: '#f39c12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Back to Store
                    </button>
                </div>
            </div>
        );
    }

    if (!order) return null;

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '30px 20px' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#2c3e50', marginBottom: '10px' }}>
                        Order Tracking
                    </h1>
                    <p style={{ fontSize: '16px', color: '#666' }}>
                        Order #{order.order_number}
                    </p>
                </div>

                {/* Status Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    borderLeft: `4px solid ${getStatusColor(order.status)}`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ color: getStatusColor(order.status), flex: 0 }}>
                            {getStatusIcon(order.status)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 5px 0', textTransform: 'uppercase' }}>
                                Current Status
                            </p>
                            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#2c3e50', margin: 0 }}>
                                {getStatusLabel(order.status)}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Order Details */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
                        Order Information
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <p style={{ fontSize: '12px', color: '#999', margin: 0, textTransform: 'uppercase' }}>
                                Order Date
                            </p>
                            <p style={{ fontSize: '16px', color: '#2c3e50', fontWeight: '500', margin: '5px 0 0 0' }}>
                                {new Date(order.created_at).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: '12px', color: '#999', margin: 0, textTransform: 'uppercase' }}>
                                Payment Method
                            </p>
                            <p style={{ fontSize: '16px', color: '#2c3e50', fontWeight: '500', margin: '5px 0 0 0' }}>
                                {order.payment_method === 'UPI_QR' ? 'UPI QR Code' : 'Bank Transfer'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Delivery Details */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
                        Delivery Address
                    </h3>
                    <p style={{ fontSize: '16px', color: '#2c3e50', lineHeight: '1.6', margin: 0 }}>
                        {order.delivery_address}<br />
                        {order.delivery_city} - {order.delivery_pincode}
                    </p>
                </div>

                {/* Items */}
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '30px',
                    marginBottom: '30px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
                        Order Items
                    </h3>

                    {order.items && order.items.length > 0 ? (
                        <div>
                            {order.items.map((item, index) => (
                                <div key={index} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '15px 0',
                                    borderBottom: index < order.items.length - 1 ? '1px solid #e0e0e0' : 'none'
                                }}>
                                    <div>
                                        <p style={{ fontSize: '16px', color: '#2c3e50', fontWeight: '500', margin: 0 }}>
                                            {item.product_name}
                                        </p>
                                        <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 0 0' }}>
                                            Qty: {item.quantity}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '16px', color: '#27ae60', fontWeight: '600', margin: 0 }}>
                                            ₹{parseFloat(item.line_total).toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#666' }}>No items found</p>
                    )}
                </div>

                {/* Order Summary */}
                <div style={{
                    background: '#f9f9f9',
                    borderRadius: '8px',
                    padding: '25px',
                    marginBottom: '30px',
                    border: '1px solid #e0e0e0'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
                        <p style={{ color: '#666', margin: 0 }}>Subtotal:</p>
                        <p style={{ color: '#2c3e50', fontWeight: '500', margin: 0 }}>
                            ₹{parseFloat(order.subtotal).toFixed(2)}
                        </p>
                    </div>
                    {parseFloat(order.discount_total) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
                            <p style={{ color: '#666', margin: 0 }}>Discount:</p>
                            <p style={{ color: '#e74c3c', fontWeight: '500', margin: 0 }}>
                                -₹{parseFloat(order.discount_total).toFixed(2)}
                            </p>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', margin: 0 }}>Total:</p>
                        <p style={{ fontSize: '16px', fontWeight: '600', color: '#27ae60', margin: 0 }}>
                            ₹{parseFloat(order.total_amount).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Rejection Reason (if applicable) */}
                {order.status === 'PAYMENT_REJECTED' && order.rejection_reason && (
                    <div style={{
                        background: '#ffebee',
                        border: '1px solid #ef5350',
                        borderRadius: '8px',
                        padding: '20px',
                        marginBottom: '30px'
                    }}>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <AlertCircle size={24} style={{ color: '#e74c3c', flex: 0 }} />
                            <div>
                                <h4 style={{ color: '#e74c3c', margin: '0 0 10px 0' }}>Payment Rejected</h4>
                                <p style={{ color: '#c62828', margin: 0 }}>
                                    {order.rejection_reason}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Back to Store Button */}
                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={() => navigate('/store')}
                        style={{
                            padding: '12px 30px',
                            background: '#f39c12',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '14px'
                        }}
                    >
                        Back to Store
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderTracking;
