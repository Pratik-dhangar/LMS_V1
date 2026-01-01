import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import orderService from '../../api/services/ecommerce/orderService';
import { toast } from 'react-toastify';

const OrderHistory = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '',
        page: 1,
        limit: 10
    });

    useEffect(() => {
        loadOrders();
    }, [filters]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            const data = await orderService.getOrders(filters);
            setOrders(data.orders || []);
        } catch (error) {
            if (error.response?.status === 401) {
                toast.info('Please login to view orders');
                navigate('/auth/login');
            } else {
                toast.error('Failed to load orders');
            }
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusColors = {
            'CREATED': { bg: '#f39c12', text: 'Created' },
            'PAYMENT_UPLOADED': { bg: '#3498db', text: 'Payment Uploaded' },
            'PAYMENT_APPROVED': { bg: '#27ae60', text: 'Approved' },
            'PAYMENT_REJECTED': { bg: '#e74c3c', text: 'Rejected' },
            'SHIPPED': { bg: '#9b59b6', text: 'Shipped' },
            'DELIVERED': { bg: '#16a085', text: 'Delivered' },
            'CANCELLED': { bg: '#95a5a6', text: 'Cancelled' }
        };
        const config = statusColors[status] || { bg: '#95a5a6', text: status };
        return (
            <span style={{
                background: config.bg,
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600'
            }}>
                {config.text}
            </span>
        );
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f6fa', padding: '30px 20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    padding: '30px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#2c3e50' }}>
                            My Orders
                        </h1>
                        <button
                            onClick={() => navigate('/store')}
                            style={{
                                padding: '10px 20px',
                                background: '#3498db',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Continue Shopping
                        </button>
                    </div>

                    {/* Filter */}
                    <div style={{ marginBottom: '25px' }}>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                            style={{
                                padding: '10px 15px',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '14px',
                                background: 'white'
                            }}
                        >
                            <option value="">All Orders</option>
                            <option value="CREATED">Created</option>
                            <option value="PAYMENT_UPLOADED">Payment Uploaded</option>
                            <option value="PAYMENT_APPROVED">Approved</option>
                            <option value="PAYMENT_REJECTED">Rejected</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="DELIVERED">Delivered</option>
                        </select>
                    </div>

                    {/* Orders List */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#7f8c8d' }}>
                            Loading orders...
                        </div>
                    ) : orders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📦</div>
                            <h2 style={{ fontSize: '24px', color: '#2c3e50', marginBottom: '10px' }}>
                                No orders yet
                            </h2>
                            <p style={{ color: '#7f8c8d', marginBottom: '30px' }}>
                                Start shopping to create your first order
                            </p>
                        </div>
                    ) : (
                        <div>
                            {orders.map(order => (
                                <div
                                    key={order.id}
                                    style={{
                                        background: 'white',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        marginBottom: '15px',
                                        cursor: 'pointer',
                                        transition: 'box-shadow 0.2s'
                                    }}
                                    onClick={() => navigate(`/store/orders/${order.id}`)}
                                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                                        <div>
                                            <div style={{ fontSize: '18px', fontWeight: '600', color: '#2c3e50', marginBottom: '8px' }}>
                                                Order #{order.order_number}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
                                                Placed on {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </div>
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </div>

                                    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '15px' }}>
                                        <div style={{ fontSize: '14px', color: '#555', marginBottom: '10px' }}>
                                            <strong>{order.items?.length || 0} items</strong> • Total: <strong style={{ color: '#27ae60' }}>₹{order.total_amount}</strong>
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
                                            📍 {order.delivery_address}, {order.delivery_city} - {order.delivery_pincode}
                                        </div>

                                        {order.status === 'PAYMENT_REJECTED' && order.rejection_reason && (
                                            <div style={{
                                                marginTop: '12px',
                                                padding: '10px',
                                                background: '#fee',
                                                borderLeft: '4px solid #e74c3c',
                                                borderRadius: '4px',
                                                fontSize: '13px',
                                                color: '#c0392b'
                                            }}>
                                                <strong>Rejected:</strong> {order.rejection_reason}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: '15px', textAlign: 'right' }}>
                                        <span style={{ color: '#3498db', fontSize: '14px', fontWeight: '600' }}>
                                            View Details →
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderHistory;
