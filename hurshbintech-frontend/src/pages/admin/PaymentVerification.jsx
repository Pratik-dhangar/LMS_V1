import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../api/axios';
import { toast } from 'react-toastify';
import { CheckCircle, XCircle, Clock, Eye, AlertCircle, FileUp, TrendingUp } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import { getFileUrl } from '../../utils/fileUrlBuilder';

const PaymentVerification = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PAYMENT_UPLOADED');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [delivering, setDelivering] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        loadPendingOrders();
    }, [filter]);

    const loadPendingOrders = async () => {
        try {
            setLoading(true);
            const response = await axiosInstance.get(`/orders/admin/orders`, {
                params: {
                    status: filter,
                    _t: Date.now() // Cache buster
                }
            });
            setOrders(response.data.orders || []);
        } catch (error) {
            console.error('Error loading orders:', error);
            toast.error('Failed to load orders');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprovePayment = async (orderId) => {
        try {
            setApproving(true);
            // Use a longer timeout for approve since backend may generate invoice / upload to S3
            await axiosInstance.post(`/orders/admin/orders/${orderId}/approve`, {}, { timeout: 30000 });
            toast.success('Payment approved successfully!');
            await loadPendingOrders();
            setSelectedOrder(null);
            setShowDetails(false);
        } catch (error) {
            console.error('Error approving payment:', error);
            // If request timed out, re-check order status - server may have processed it
            const isTimeout = error.code === 'ECONNABORTED' || (error.message && error.message.toLowerCase().includes('timeout'));
            if (isTimeout) {
                try {
                    // Re-fetch orders directly and check this order's status
                    const checkResp = await axiosInstance.get(`/orders/admin/orders`, { params: { status: filter, _t: Date.now() } });
                    const latest = checkResp.data.orders || [];
                    const updatedOrder = latest.find(o => o.order_id === orderId);
                    if (updatedOrder && updatedOrder.status === 'PAYMENT_APPROVED') {
                        toast.success('Payment approved (confirmed after timeout)');
                        await loadPendingOrders();
                        setSelectedOrder(null);
                        setShowDetails(false);
                    } else {
                        toast.error('Approve request timed out. Please try again.');
                    }
                } catch (e) {
                    console.error('Error checking order status after timeout:', e);
                    toast.error('Approve request timed out. Please try again.');
                }
            } else {
                toast.error(error.response?.data?.detail || 'Failed to approve payment');
            }
        } finally {
            setApproving(false);
        }
    };

    const handleRejectPayment = async (orderId) => {
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        try {
            setRejecting(true);
            await axiosInstance.post(`/orders/admin/orders/${orderId}/reject`, {
                reason: rejectionReason
            });
            toast.success('Payment rejected successfully!');
            loadPendingOrders();
            setSelectedOrder(null);
            setShowDetails(false);
            setRejectionReason('');
        } catch (error) {
            console.error('Error rejecting payment:', error);
            toast.error(error.response?.data?.detail || 'Failed to reject payment');
        } finally {
            setRejecting(false);
        }
    };

    const handleMarkDelivered = async (orderId) => {
        try {
            setDelivering(true);
            await axiosInstance.post(`/orders/admin/orders/${orderId}/mark-delivered`, {}, { timeout: 30000 });
            toast.success('Order marked as delivered and email sent successfully!');
            await loadPendingOrders();
            setSelectedOrder(null);
            setShowDetails(false);
        } catch (error) {
            console.error('Error marking order as delivered:', error);
            toast.error(error.response?.data?.detail || 'Failed to mark order as delivered');
        } finally {
            setDelivering(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'PAYMENT_UPLOADED': { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
            'PAYMENT_APPROVED': { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
            'PAYMENT_REJECTED': { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
            'DELIVERED': { color: 'bg-blue-100 text-blue-800', icon: TrendingUp, label: 'Delivered' }
        };
        const config = statusMap[status] || statusMap['PAYMENT_UPLOADED'];
        const Icon = config.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
                <Icon size={16} />
                {config.label}
            </span>
        );
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Payment Verification</h1>
                    <p style={{ color: '#666' }}>Review and verify customer payment receipts</p>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    {['PAYMENT_UPLOADED', 'PAYMENT_APPROVED', 'DELIVERED', 'PAYMENT_REJECTED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                backgroundColor: filter === status ? '#3b82f6' : '#e5e7eb',
                                color: filter === status ? 'white' : '#374151',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {status === 'PAYMENT_UPLOADED' && 'Pending'}
                            {status === 'PAYMENT_APPROVED' && 'Approved'}
                            {status === 'DELIVERED' && 'Delivered'}
                            {status === 'PAYMENT_REJECTED' && 'Rejected'}
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                        Loading orders...
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '3rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '0.5rem',
                        color: '#666'
                    }}>
                        <FileUp size={48} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.5 }} />
                        <p>No orders found</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gap: '1rem',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
                    }}>
                        {orders.map(order => (
                            <div
                                key={order.order_id}
                                style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '0.5rem',
                                    padding: '1.5rem',
                                    backgroundColor: '#fff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                                            Order #{order.order_number}
                                        </h3>
                                        <p style={{ fontSize: '0.875rem', color: '#666' }}>
                                            {order.user_name} ({order.user_email})
                                        </p>
                                    </div>
                                    {getStatusBadge(order.status)}
                                </div>

                                <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                                        <div>
                                            <p style={{ color: '#6b7280' }}>Total Amount</p>
                                            <p style={{ fontWeight: 'bold', fontSize: '1.125rem', color: '#1f2937' }}>
                                                {formatCurrency(order.total_amount)}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ color: '#6b7280' }}>Payment Method</p>
                                            <p style={{ fontWeight: 'bold', color: '#1f2937' }}>
                                                {order.payment_method === 'UPI_QR' ? 'UPI QR' : 'Bank Transfer'}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ color: '#6b7280' }}>Items</p>
                                            <p style={{ fontWeight: 'bold', color: '#1f2937' }}>
                                                {order.items?.length || 0} products
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ color: '#6b7280' }}>Date</p>
                                            <p style={{ fontWeight: 'bold', color: '#1f2937' }}>
                                                {formatDate(order.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {order.rejection_reason && (
                                    <div style={{
                                        backgroundColor: '#fee2e2',
                                        border: '1px solid #fecaca',
                                        borderRadius: '0.375rem',
                                        padding: '1rem',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                                            <p style={{ fontWeight: 'bold', color: '#991b1b' }}>Rejection Reason</p>
                                        </div>
                                        <p style={{ color: '#7f1d1d', fontSize: '0.875rem' }}>
                                            {order.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => {
                                            setSelectedOrder(order);
                                            setShowDetails(true);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: '#f3f4f6',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            transition: 'background-color 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                                    >
                                        <Eye size={18} />
                                        View Details
                                    </button>
                                    {order.status === 'PAYMENT_APPROVED' && (
                                        <button
                                            onClick={() => handleMarkDelivered(order.order_id)}
                                            disabled={delivering}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                backgroundColor: '#0ea5e9',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                cursor: delivering ? 'not-allowed' : 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                opacity: delivering ? 0.7 : 1,
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => !delivering && (e.target.style.backgroundColor = '#0284c7')}
                                            onMouseLeave={(e) => !delivering && (e.target.style.backgroundColor = '#0ea5e9')}
                                        >
                                            <TrendingUp size={18} />
                                            {delivering ? 'Delivering...' : 'Delivered'}
                                        </button>
                                    )}
                                    {order.status === 'PAYMENT_UPLOADED' && (
                                        <>
                                            <button
                                                onClick={() => handleApprovePayment(order.order_id)}
                                                disabled={approving}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.75rem',
                                                    backgroundColor: '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '0.375rem',
                                                    cursor: approving ? 'not-allowed' : 'pointer',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    opacity: approving ? 0.7 : 1,
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => !approving && (e.target.style.backgroundColor = '#059669')}
                                                onMouseLeave={(e) => !approving && (e.target.style.backgroundColor = '#10b981')}
                                            >
                                                <CheckCircle size={18} />
                                                {approving ? 'Approving...' : 'Approve'}
                                            </button>
                                            <button
                                                onClick={() => handleRejectPayment(order.order_id)}
                                                disabled={rejecting}
                                                style={{
                                                    flex: 1,
                                                    padding: '0.75rem',
                                                    backgroundColor: '#ef4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '0.375rem',
                                                    cursor: rejecting ? 'not-allowed' : 'pointer',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.5rem',
                                                    opacity: rejecting ? 0.7 : 1,
                                                    transition: 'all 0.3s ease'
                                                }}
                                                onMouseEnter={(e) => !rejecting && (e.target.style.backgroundColor = '#dc2626')}
                                                onMouseLeave={(e) => !rejecting && (e.target.style.backgroundColor = '#ef4444')}
                                            >
                                                <XCircle size={18} />
                                                {rejecting ? 'Rejecting...' : 'Reject'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Order Details Modal */}
            {showDetails && selectedOrder && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '0.75rem',
                        maxWidth: '600px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        padding: '2rem'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                            Order #{selectedOrder.order_number} Details
                        </h2>

                        {/* Customer Info */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#374151' }}>Customer Information</h3>
                            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                                <p><strong>Name:</strong> {selectedOrder.user_name}</p>
                                <p><strong>Email:</strong> {selectedOrder.user_email}</p>
                                <p><strong>Delivery Address:</strong> {selectedOrder.delivery_address}</p>
                                <p><strong>City:</strong> {selectedOrder.delivery_city}</p>
                                <p><strong>Pincode:</strong> {selectedOrder.delivery_pincode}</p>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#374151' }}>Order Items</h3>
                            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}>
                                {selectedOrder.items?.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: '1rem',
                                            borderBottom: idx < selectedOrder.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <strong>{item.product_name}</strong>
                                            <span>x{item.quantity}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666' }}>
                                            <span>Unit Price: {formatCurrency(item.unit_price)}</span>
                                            <span>Subtotal: {formatCurrency(item.line_total)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Payment Summary */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#374151' }}>Payment Summary</h3>
                            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Subtotal:</span>
                                    <span>{formatCurrency(parseFloat(selectedOrder.total_amount) + parseFloat(selectedOrder.discount_total || 0))}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ef4444' }}>
                                    <span>Discount:</span>
                                    <span>-{formatCurrency(selectedOrder.discount_total || 0)}</span>
                                </div>
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                    <span>Total Amount:</span>
                                    <span>{formatCurrency(selectedOrder.total_amount)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Receipt Preview */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontWeight: 'bold', marginBottom: '0.75rem', color: '#374151' }}>Payment Receipt</h3>
                            {selectedOrder.payment_receipt ? (
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}>
                                    {selectedOrder.payment_receipt.file_type?.toLowerCase() === 'pdf' ? (
                                        <div style={{ backgroundColor: '#f9fafb', padding: '1rem', textAlign: 'center' }}>
                                            <FileUp size={32} style={{ marginBottom: '0.5rem', color: '#6b7280' }} />
                                            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                                PDF Document
                                            </p>
                                            <p style={{ color: '#374151', fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                                {selectedOrder.payment_receipt.file_name}
                                            </p>
                                            <a
                                                href={selectedOrder.payment_receipt.s3_path.startsWith('http') ? selectedOrder.payment_receipt.s3_path : getFileUrl(selectedOrder.payment_receipt.s3_path)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '0.5rem 1rem',
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    textDecoration: 'none',
                                                    borderRadius: '0.375rem',
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                Download PDF
                                            </a>
                                        </div>
                                    ) : (
                                        (() => {
                                            const receiptUrl = selectedOrder.payment_receipt?.s3_path;
                                            // Backend now returns full URLs, but handle both cases
                                            let imageUrl;
                                            if (receiptUrl.startsWith('https://') || receiptUrl.startsWith('http://')) {
                                                imageUrl = receiptUrl;
                                                console.log('Payment Receipt: Using direct URL:', imageUrl);
                                            } else {
                                                imageUrl = getFileUrl(receiptUrl);
                                                console.log('Payment Receipt: Converted path to URL:', imageUrl);
                                            }
                                            return (
                                                <img
                                                    src={imageUrl}
                                                    alt="Payment Receipt"
                                                    style={{
                                                        width: '100%',
                                                        maxHeight: '400px',
                                                        objectFit: 'contain',
                                                        backgroundColor: '#f9fafb'
                                                    }}
                                                    onError={(e) => {
                                                        console.error('Failed to load payment receipt image:', imageUrl);
                                                        e.target.parentElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: #6b7280;">Failed to load receipt image</div>';
                                                    }}
                                                />
                                            );
                                        })()
                                    )}
                                    <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', fontSize: '0.75rem', color: '#6b7280', borderTop: '1px solid #e5e7eb' }}>
                                        <p style={{ margin: '0.25rem 0' }}>
                                            <strong>Uploaded:</strong> {new Date(selectedOrder.payment_receipt.uploaded_at).toLocaleString()}
                                        </p>
                                        <p style={{ margin: '0.25rem 0' }}>
                                            <strong>File:</strong> {selectedOrder.payment_receipt.file_name}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    backgroundColor: '#fee2e2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '0.375rem',
                                    padding: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem'
                                }}>
                                    <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ fontWeight: 'bold', color: '#991b1b', margin: '0 0 0.25rem 0' }}>No Receipt Uploaded</p>
                                        <p style={{ color: '#7f1d1d', fontSize: '0.875rem', margin: 0 }}>
                                            Admin cannot verify or approve payment without a receipt.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rejection Reason Input (for pending orders) */}
                        {selectedOrder.status === 'PAYMENT_UPLOADED' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem', color: '#374151' }}>
                                    Rejection Reason (if rejecting) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter reason for rejection..."
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                        minHeight: '80px'
                                    }}
                                />
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    setShowDetails(false);
                                    setSelectedOrder(null);
                                    setRejectionReason('');
                                }}
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    backgroundColor: '#e5e7eb',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'background-color 0.3s ease'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#d1d5db'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                            >
                                Close
                            </button>
                            {selectedOrder.status === 'PAYMENT_UPLOADED' && (
                                <>
                                    <button
                                        onClick={() => handleApprovePayment(selectedOrder.order_id)}
                                        disabled={approving || !selectedOrder.payment_receipt}
                                        title={!selectedOrder.payment_receipt ? 'Receipt must be uploaded before approval' : ''}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: !selectedOrder.payment_receipt ? '#9ca3af' : '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: (approving || !selectedOrder.payment_receipt) ? 'not-allowed' : 'pointer',
                                            fontWeight: 'bold',
                                            opacity: (approving || !selectedOrder.payment_receipt) ? 0.7 : 1,
                                            transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => !(approving || !selectedOrder.payment_receipt) && (e.target.style.backgroundColor = '#059669')}
                                        onMouseLeave={(e) => !(approving || !selectedOrder.payment_receipt) && (e.target.style.backgroundColor = '#10b981')}
                                    >
                                        {approving ? 'Approving...' : 'Approve Payment & Proceed to Shipping'}
                                    </button>
                                    <button
                                        onClick={() => handleRejectPayment(selectedOrder.order_id)}
                                        disabled={rejecting || !rejectionReason.trim() || !selectedOrder.payment_receipt}
                                        title={!selectedOrder.payment_receipt ? 'Receipt must be present for rejection' : ''}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            backgroundColor: !selectedOrder.payment_receipt ? '#9ca3af' : '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            cursor: (rejecting || !rejectionReason.trim() || !selectedOrder.payment_receipt) ? 'not-allowed' : 'pointer',
                                            fontWeight: 'bold',
                                            opacity: (rejecting || !rejectionReason.trim() || !selectedOrder.payment_receipt) ? 0.7 : 1,
                                            transition: 'all 0.3s ease'
                                        }}
                                        onMouseEnter={(e) => !(rejecting || !rejectionReason.trim() || !selectedOrder.payment_receipt) && (e.target.style.backgroundColor = '#dc2626')}
                                        onMouseLeave={(e) => !(rejecting || !rejectionReason.trim() || !selectedOrder.payment_receipt) && (e.target.style.backgroundColor = '#ef4444')}
                                    >
                                        {rejecting ? 'Rejecting...' : 'Reject Payment'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default PaymentVerification;
