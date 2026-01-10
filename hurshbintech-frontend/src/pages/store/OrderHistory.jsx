import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import orderService from '../../api/services/ecommerce/orderService';
import { toast } from 'react-toastify';

const OrderHistory = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showReuploadModal, setShowReuploadModal] = useState(false);
    const [receiptFile, setReceiptFile] = useState(null);
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
            // Fetch orders with current filters
            const data = await orderService.getOrders(filters);
            console.log('📦 Fetched orders:', data);
            const fetchedOrders = data.orders || [];
            console.log('📦 Order statuses:', fetchedOrders.map(o => ({ id: o.id, status: o.status })));
            setOrders(fetchedOrders);
        } catch (error) {
            if (error.response?.status === 401) {
                toast.info('Please login to view orders');
                navigate('/auth/login');
            } else {
                console.error('❌ Error fetching orders:', error);
                toast.error('Failed to load orders');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please upload JPG, PNG, or PDF file');
                return;
            }
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size should not exceed 5MB');
                return;
            }
            setReceiptFile(file);
            toast.success('Receipt selected: ' + file.name);
        }
    };

    const handleReuploadReceipt = async () => {
        if (!receiptFile || !selectedOrder) {
            toast.error('Please select a receipt file');
            return;
        }

        try {
            setUploading(true);
            await orderService.uploadReceipt(selectedOrder.id, receiptFile);
            toast.success('Receipt uploaded successfully! Admin will verify the payment.');
            setShowReuploadModal(false);
            setSelectedOrder(null);
            setReceiptFile(null);
            // Reload orders to show updated status
            loadOrders();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to upload receipt');
        } finally {
            setUploading(false);
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
                    <div style={{ marginBottom: '25px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div>
                            <label style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginRight: '8px' }}>
                                Filter by Status:
                            </label>
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
                                <option value="PAYMENT_REJECTED">⚠️ Rejected</option>
                                <option value="SHIPPED">Shipped</option>
                                <option value="DELIVERED">Delivered</option>
                            </select>
                        </div>
                        {orders.filter(o => o.status === 'PAYMENT_REJECTED').length > 0 && (
                            <div style={{
                                background: '#fff3cd',
                                border: '1px solid #ffc107',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                fontSize: '13px',
                                color: '#856404',
                                fontWeight: '600'
                            }}>
                                ⚠️ {orders.filter(o => o.status === 'PAYMENT_REJECTED').length} payment(s) need action
                            </div>
                        )}
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

                                    <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#3498db', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }} onClick={() => navigate(`/store/orders/${order.id}`)}>
                                            View Details →
                                        </span>
                                        {order.status === 'PAYMENT_REJECTED' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedOrder(order);
                                                    setShowReuploadModal(true);
                                                    setReceiptFile(null);
                                                }}
                                                style={{
                                                    padding: '8px 16px',
                                                    background: '#e74c3c',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '13px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.background = '#c0392b'}
                                                onMouseLeave={(e) => e.target.style.background = '#e74c3c'}
                                            >
                                                📤 Reupload Receipt
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reupload Receipt Modal */}
                {showReuploadModal && selectedOrder && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            maxWidth: '500px',
                            width: '100%',
                            padding: '30px'
                        }}>
                            {/* Modal Header */}
                            <div style={{ marginBottom: '25px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#2c3e50', marginBottom: '8px' }}>
                                    Reupload Payment Receipt
                                </h2>
                                <p style={{ fontSize: '14px', color: '#7f8c8d', margin: 0 }}>
                                    Order #{selectedOrder.order_number}
                                </p>
                            </div>

                            {/* Rejection Reason */}
                            {selectedOrder.rejection_reason && (
                                <div style={{
                                    background: '#fee',
                                    border: '1px solid #f5c6cb',
                                    borderRadius: '6px',
                                    padding: '15px',
                                    marginBottom: '20px',
                                    fontSize: '14px',
                                    color: '#721c24'
                                }}>
                                    <strong>Rejection Reason:</strong>
                                    <p style={{ margin: '8px 0 0 0' }}>
                                        {selectedOrder.rejection_reason}
                                    </p>
                                </div>
                            )}

                            {/* File Upload */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: '#2c3e50',
                                    marginBottom: '10px'
                                }}>
                                    Upload New Receipt (JPG, PNG, or PDF - Max 5MB) *
                                </label>
                                <div style={{
                                    border: '2px dashed #3498db',
                                    borderRadius: '6px',
                                    padding: '25px',
                                    textAlign: 'center',
                                    background: '#ecf0f1',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        style={{ display: 'none' }}
                                        id="receipt-file-input"
                                    />
                                    <label htmlFor="receipt-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                                        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📄</div>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginBottom: '5px' }}>
                                            {receiptFile ? receiptFile.name : 'Click to select file or drag & drop'}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                                            Supported formats: JPG, PNG, PDF
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div style={{
                                background: '#d4edda',
                                border: '1px solid #c3e6cb',
                                borderRadius: '6px',
                                padding: '12px',
                                marginBottom: '20px',
                                fontSize: '13px',
                                color: '#155724'
                            }}>
                                <strong>📝 Tips for receipt:</strong>
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                                    <li>Ensure transaction ID is clearly visible</li>
                                    <li>Include date and amount details</li>
                                    <li>Screenshot should show payment confirmation</li>
                                </ul>
                            </div>

                            {/* Modal Footer */}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setShowReuploadModal(false);
                                        setSelectedOrder(null);
                                        setReceiptFile(null);
                                    }}
                                    style={{
                                        padding: '10px 20px',
                                        border: '1px solid #ddd',
                                        background: 'white',
                                        color: '#2c3e50',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                                    onMouseLeave={(e) => e.target.style.background = 'white'}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReuploadReceipt}
                                    disabled={!receiptFile || uploading}
                                    style={{
                                        padding: '10px 20px',
                                        background: receiptFile ? '#27ae60' : '#bdc3c7',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: receiptFile ? 'pointer' : 'not-allowed',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (receiptFile) e.target.style.background = '#229954';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (receiptFile) e.target.style.background = '#27ae60';
                                    }}
                                >
                                    {uploading ? '⏳ Uploading...' : '✓ Upload Receipt'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderHistory;
