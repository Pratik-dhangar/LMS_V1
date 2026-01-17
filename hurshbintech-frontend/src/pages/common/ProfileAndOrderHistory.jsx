import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import orderService from "../../api/services/ecommerce/orderService";
import { ArrowLeft } from 'lucide-react';
import "../../styles/ManageUsersLayout.css";

const ProfileAndOrderHistory = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Order History state
    const [orderHistory, setOrderHistory] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
    const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
    const [expandedOrders, setExpandedOrders] = useState(new Set());
    const [orderStatusFilter, setOrderStatusFilter] = useState('all');
    const [showReuploadModal, setShowReuploadModal] = useState(false);
    const [receiptFile, setReceiptFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [showReceiptPreview, setShowReceiptPreview] = useState(false);
    const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null);

    // Get dashboard path based on user role
    const getDashboardPath = () => {
        if (!user?.role) return '/';
        return `/${user.role}/dashboard`;
    };

    // Get role display name
    const getRoleDisplayName = () => {
        if (!user?.role) return 'User';
        return user.role.charAt(0).toUpperCase() + user.role.slice(1);
    };

    useEffect(() => {
        fetchOrderHistory();
    }, []);

    const fetchOrderHistory = async () => {
        try {
            setLoadingOrders(true);
            const response = await orderService.getOrders();
            const orders = Array.isArray(response) ? response : (response.orders || []);
            setOrderHistory(orders);
        } catch (error) {
            console.error("Error fetching order history:", error);
            setOrderHistory([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!validTypes.includes(file.type)) {
                toast.error('Please upload JPG, PNG, or PDF file');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error('File size should not exceed 5MB');
                return;
            }
            setReceiptFile(file);
            toast.success('Receipt selected: ' + file.name);
        }
    };

    const handleReuploadReceipt = async () => {
        if (!receiptFile || !selectedOrderDetails) {
            toast.error('Please select a receipt file');
            return;
        }

        const orderId = selectedOrderDetails.id || selectedOrderDetails.uuid || selectedOrderDetails.order_id;
        if (!orderId) {
            toast.error('Order ID not found. Please try again.');
            return;
        }

        try {
            setUploading(true);
            await orderService.uploadReceipt(orderId, receiptFile);
            toast.success('Receipt uploaded successfully! Admin will verify the payment.');
            setShowReuploadModal(false);
            setReceiptFile(null);
            setShowOrderDetailsModal(false);
            fetchOrderHistory();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Failed to upload receipt');
        } finally {
            setUploading(false);
        }
    };

    const getOrderId = (order) => {
        if (order?.code && order.code !== "N/A") return order.code;
        if (order?.order_number) return order.order_number;
        if (order?.reference_number) return order.reference_number;
        if (order?.order_id) return order.order_id;
        const id = order?.id || order?.uuid || "N/A";
        return id;
    };

    const getFormattedOrderId = (order) => {
        const orderId = getOrderId(order);
        if (orderId === "N/A") return orderId;
        if (orderId.includes('-') && !orderId.startsWith('Order')) {
            return orderId.startsWith('#') ? orderId : `#${orderId}`;
        }
        const shortId = orderId.substring(0, 8).toUpperCase();
        return `#${shortId}`;
    };

    const getItemPrice = (item) => {
        const price = item?.price || item?.unit_price || item?.amount || item?.item_price || item?.cost || 0;
        return parseFloat(price || 0);
    };

    const formatPrice = (amount) => {
        return `Rs. ${parseFloat(amount || 0).toFixed(2)}`;
    };

    const getFilteredOrders = () => {
        if (orderStatusFilter === 'all') return orderHistory;
        const statusMap = {
            'pending': ['CREATED', 'PAYMENT_UPLOADED'],
            'approved': ['PAYMENT_APPROVED'],
            'delivered': ['DELIVERED'],
            'rejected': ['PAYMENT_REJECTED']
        };
        const statuses = statusMap[orderStatusFilter] || [];
        return orderHistory.filter(order => statuses.includes(order.status));
    };

    const getOrderStatusBadge = (status) => {
        const statusConfig = {
            'CREATED': { bg: 'bg-yellow-200', text: 'text-yellow-800', label: '⏳ Pending', icon: '⏳' },
            'PAYMENT_UPLOADED': { bg: 'bg-[#fef3e2]', text: 'text-[#9C4D0B]', label: '📤 Payment Uploaded', icon: '📤' },
            'PAYMENT_APPROVED': { bg: 'bg-green-200', text: 'text-green-800', label: '✅ Approved', icon: '✅' },
            'DELIVERED': { bg: 'bg-teal-200', text: 'text-teal-800', label: '🚚 Delivered', icon: '🚚' },
            'PAYMENT_REJECTED': { bg: 'bg-red-200', text: 'text-red-800', label: '❌ Rejected', icon: '❌' },
            'SHIPPED': { bg: 'bg-[#fef3e2]', text: 'text-[#9C4D0B]', label: '📦 Shipped', icon: '📦' },
            'CANCELLED': { bg: 'bg-gray-200', text: 'text-gray-800', label: '❌ Cancelled', icon: '❌' }
        };
        const config = statusConfig[status] || { bg: 'bg-gray-200', text: 'text-gray-800', label: status, icon: '?' };
        return (
            <span className={`inline-block px-3 py-1 ${config.bg} ${config.text} text-xs font-bold rounded-full`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                {/* Page Header */}
                <div className="page-header">
                    <button onClick={() => navigate(getDashboardPath())} className="back-button">
                        <ArrowLeft size={20} />
                        Back to Dashboard
                    </button>
                    <h1 className="page-title">
                        Learning Material Purchase History
                    </h1>
                </div>

                    {/* Profile Section */}
                    <div className="mt-8 bg-white rounded-xl shadow-md p-6">
                        {/* Profile Header */}
                        <div className="mb-8">
                            <h2 className="text-xl font-bold text-gray-800 border-b pb-4 mb-6">
                                👤 My Profile
                            </h2>

                            {/* User Profile Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-br from-[#fef3e2] to-[#fef3e2] rounded-lg border border-[#DB9D32]">
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Name</p>
                                    <p className="text-lg font-bold text-gray-900">{user?.name || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Email</p>
                                    <p className="text-lg font-bold text-gray-900">{user?.email || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Role</p>
                                    <p className="text-lg font-bold text-gray-900">{getRoleDisplayName()}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Phone</p>
                                    <p className="text-lg font-bold text-gray-900">{user?.phone || "N/A"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Order History Section */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 border-b pb-4 mb-6 flex items-center gap-2">
                                <span className="text-2xl">📦</span> Order History
                            </h3>

                            {/* Status Filter Radio Buttons */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-sm font-semibold text-gray-700 mb-3">Filter by Status:</p>
                                <div className="flex flex-wrap gap-4">
                                    {[
                                        { value: 'all', label: 'All Orders', icon: '📦' },
                                        { value: 'pending', label: 'Pending', icon: '⏳' },
                                        { value: 'approved', label: 'Approved', icon: '✅' },
                                        { value: 'delivered', label: 'Delivered', icon: '🚚' },
                                        { value: 'rejected', label: 'Rejected', icon: '❌' }
                                    ].map(filter => (
                                        <label key={filter.value} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="orderStatus"
                                                value={filter.value}
                                                checked={orderStatusFilter === filter.value}
                                                onChange={(e) => setOrderStatusFilter(e.target.value)}
                                                className="w-4 h-4 accent-amber-500"
                                            />
                                            <span className="text-sm text-gray-700 font-medium">
                                                {filter.icon} {filter.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {loadingOrders ? (
                                <div className="text-center py-8 text-gray-500">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto mb-2"></div>
                                    Loading order history...
                                </div>
                            ) : getFilteredOrders().length === 0 ? (
                                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-2xl mb-2">📦</p>
                                    <p className="text-gray-600 font-medium">No orders found</p>
                                    <p className="text-gray-500 text-sm mt-1">No orders with the selected status</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {getFilteredOrders().map((order, orderIdx) => {
                                        const orderId = getOrderId(order);
                                        return (
                                            <div key={orderId || orderIdx} className="border border-gray-300 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                                                {/* Order Header */}
                                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 border-b border-gray-300">
                                                    <div className="flex items-center justify-between">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order ID</p>
                                                                <p className="font-mono text-sm font-bold text-gray-900">{getFormattedOrderId(order)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Date</p>
                                                                <p className="text-sm font-bold text-gray-900">
                                                                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : "N/A"}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Total Amount</p>
                                                                <p className="text-sm font-bold text-green-700">
                                                                    {formatPrice(order.total_amount)}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Status</p>
                                                                {getOrderStatusBadge(order.status)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setExpandedOrders(prev => {
                                                                    const newSet = new Set(prev);
                                                                    if (newSet.has(orderId)) {
                                                                        newSet.delete(orderId);
                                                                    } else {
                                                                        newSet.add(orderId);
                                                                    }
                                                                    return newSet;
                                                                });
                                                            }}
                                                            className="ml-4 flex-shrink-0 p-2 hover:bg-green-100 rounded-lg transition-colors"
                                                            title="Toggle details"
                                                        >
                                                            <svg
                                                                className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${expandedOrders.has(orderId) ? 'rotate-180' : ''}`}
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Order Items - Collapsible */}
                                                {expandedOrders.has(orderId) && (
                                                    <div className="p-5 border-b border-gray-200 animate-fadeIn">
                                                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                                            <span>📋</span> Ordered Items
                                                        </h4>

                                                        {order.items && order.items.length > 0 ? (
                                                            <div className="space-y-3">
                                                                {order.items.map((item, itemIdx) => (
                                                                    <div key={itemIdx} className="flex justify-between items-start p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
                                                                        <div className="flex-1">
                                                                            <p className="font-semibold text-gray-800 text-base">
                                                                                {item.name || item.title || item.product_name || "Unknown Item"}
                                                                            </p>
                                                                            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                                                                                <span>Qty: <span className="font-bold text-gray-800">{item.quantity || 1}</span></span>
                                                                                {item.category && (
                                                                                    <span className="bg-[#fef3e2] text-[#9C4D0B] px-2 py-1 rounded text-xs font-semibold">
                                                                                        {item.category}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {item.description && (
                                                                                <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                                                    {item.description}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                        <div className="ml-4 text-right flex-shrink-0">
                                                                            <p className="text-lg font-bold text-gray-900">
                                                                                {formatPrice(getItemPrice(item))}
                                                                            </p>
                                                                            <p className="text-xs text-gray-500 mt-1">per item</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-gray-500 text-sm py-4">No items in this order.</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Order Details Footer - Collapsible */}
                                                {expandedOrders.has(orderId) && (
                                                    <div className="bg-gray-50 p-5 border-t border-gray-300 flex justify-between items-center animate-fadeIn">
                                                        <div className="text-sm text-gray-600">
                                                            {order.delivery_address && (
                                                                <p><span className="font-semibold">📍 Delivery:</span> {order.delivery_city || "City"} - {order.delivery_pincode || "PIN"}</p>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedOrderDetails(order);
                                                                setShowOrderDetailsModal(true);
                                                            }}
                                                            className="bg-[#DB9D32] hover:bg-[#9C4D0B] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                                                        >
                                                            View Details
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
            </main>

            {/* Order Details Modal */}
            {showOrderDetailsModal && selectedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderDetailsModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-[#DB9D32] to-[#9C4D0B] text-white p-6 flex items-center justify-between rounded-t-2xl">
                            <h2 className="text-2xl font-bold">Order Details</h2>
                            <button
                                onClick={() => setShowOrderDetailsModal(false)}
                                className="text-white hover:bg-[#7A2C2C] rounded-full w-8 h-8 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Order Status & Timeline */}
                            <div className="bg-[#fef3e2] border border-[#DB9D32] rounded-lg p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-600 mb-2">Status</p>
                                        {getOrderStatusBadge(selectedOrderDetails.status)}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Date</p>
                                        <p className="font-semibold text-gray-900">
                                            {selectedOrderDetails.created_at ? new Date(selectedOrderDetails.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Order Time</p>
                                        <p className="font-semibold text-gray-900">
                                            {selectedOrderDetails.created_at ? new Date(selectedOrderDetails.created_at).toLocaleTimeString() : "N/A"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Rejection Reason - Show only if status is PAYMENT_REJECTED */}
                            {selectedOrderDetails.status === 'PAYMENT_REJECTED' && (
                                <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">⚠️</span>
                                        <div className="flex-1">
                                            <label className="text-sm font-semibold text-red-800 block mb-2">Rejection Reason</label>
                                            {selectedOrderDetails.rejection_reason ? (
                                                <>
                                                    <p className="text-sm text-red-700 bg-white border border-red-200 rounded p-3">
                                                        {selectedOrderDetails.rejection_reason}
                                                    </p>
                                                    <p className="text-xs text-red-600 mt-2">
                                                        💡 Please review the reason above and reupload the correct payment receipt.
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-sm text-red-700 bg-white border border-red-200 rounded p-3">
                                                    Your payment was rejected. Please reupload the receipt.
                                                </p>
                                            )}
                                            <button
                                                onClick={() => setShowReuploadModal(true)}
                                                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                                            >
                                                🔄 Reupload Receipt
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Receipt Section - Show if payment uploaded/rejected */}
                            {selectedOrderDetails.receipt_url && (
                                <div>
                                    <label className="text-sm font-semibold text-gray-600 block mb-3">📸 Payment Receipt</label>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        {selectedOrderDetails.receipt_url.toLowerCase().endsWith('.pdf') ? (
                                            <a
                                                href={selectedOrderDetails.receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#DB9D32] hover:text-[#9C4D0B] font-semibold flex items-center gap-2"
                                            >
                                                📄 View PDF Receipt
                                            </a>
                                        ) : (
                                            <img
                                                src={selectedOrderDetails.receipt_url}
                                                alt="Receipt"
                                                className="max-w-full h-auto rounded-lg cursor-pointer hover:scale-105 transition-transform duration-200"
                                                onClick={() => {
                                                    setPreviewReceiptUrl(selectedOrderDetails.receipt_url);
                                                    setShowReceiptPreview(true);
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Delivery Address */}
                            {selectedOrderDetails.delivery_address && (
                                <div>
                                    <label className="text-sm font-semibold text-gray-600 block mb-2">📍 Delivery Address</label>
                                    <div className="p-4 bg-[#fef3e2] rounded-lg border border-[#DB9D32]">
                                        <p className="text-gray-800 font-semibold">{selectedOrderDetails.delivery_address}</p>
                                        {selectedOrderDetails.delivery_city && (
                                            <p className="text-gray-600 text-sm mt-2">
                                                {selectedOrderDetails.delivery_city}
                                                {selectedOrderDetails.delivery_state && `, ${selectedOrderDetails.delivery_state}`}
                                                {selectedOrderDetails.delivery_pincode && ` - ${selectedOrderDetails.delivery_pincode}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Ordered Items */}
                            <div>
                                <label className="text-sm font-semibold text-gray-600 block mb-3">📦 Ordered Items ({selectedOrderDetails.items?.length || 0})</label>
                                {selectedOrderDetails.items && selectedOrderDetails.items.length > 0 ? (
                                    <div className="space-y-4">
                                        {selectedOrderDetails.items.map((item, idx) => (
                                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-gray-800">
                                                            {item.name || item.title || item.product_name || "Unknown Item"}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                                                            <span>Qty: <span className="font-bold">{item.quantity || 1}</span></span>
                                                            {item.category && (
                                                                <span className="bg-[#fef3e2] text-[#9C4D0B] px-2 py-1 rounded text-xs font-semibold">
                                                                    {item.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.description && (
                                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="ml-4 text-right flex-shrink-0">
                                                        <p className="text-base font-bold text-gray-900">
                                                            {formatPrice(getItemPrice(item))}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">per item</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm py-4">No items in this order.</p>
                                )}
                            </div>

                            {/* Order Summary */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <p className="text-gray-700">Subtotal:</p>
                                        <p className="font-semibold text-gray-900">{formatPrice(selectedOrderDetails.total_amount)}</p>
                                    </div>
                                    <div className="border-t border-gray-300 pt-2 flex justify-between text-base font-bold">
                                        <p className="text-gray-900">Total Amount:</p>
                                        <p className="text-green-700">{formatPrice(selectedOrderDetails.total_amount)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 border-t border-gray-200 p-6 sticky bottom-0">
                            <button
                                onClick={() => setShowOrderDetailsModal(false)}
                                className="w-full bg-gradient-to-r from-[#DB9D32] to-[#9C4D0B] hover:from-[#9C4D0B] hover:to-[#7A2C2C] text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reupload Receipt Modal */}
            {showReuploadModal && selectedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full animate-fadeIn">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <span>🔄</span> Reupload Receipt
                            </h2>
                            <button
                                onClick={() => {
                                    setShowReuploadModal(false);
                                    setReceiptFile(null);
                                }}
                                className="text-white hover:bg-red-700 rounded-full w-8 h-8 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-sm text-yellow-800">
                                    <strong>Order ID:</strong> {getFormattedOrderId(selectedOrderDetails)}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Select Receipt File (JPG, PNG, or PDF)
                                </label>
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={handleFileChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-red-500"
                                />
                                {receiptFile && (
                                    <p className="text-sm text-green-600 mt-2">✓ {receiptFile.name}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-2">Max file size: 5MB</p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 border-t border-gray-200 p-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowReuploadModal(false);
                                    setReceiptFile(null);
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReuploadReceipt}
                                disabled={!receiptFile || uploading}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium transition-colors"
                            >
                                {uploading ? '⏳ Uploading...' : '🔄 Reupload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {showReceiptPreview && previewReceiptUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setShowReceiptPreview(false)}>
                    <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 bg-gray-100 border-b">
                            <h3 className="text-lg font-bold text-gray-800">Receipt Preview</h3>
                            <button
                                onClick={() => setShowReceiptPreview(false)}
                                className="text-gray-600 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto">
                            <img
                                src={previewReceiptUrl}
                                alt="Receipt Preview"
                                className="max-w-full h-auto rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
            )
        </div>
    );
};

export default ProfileAndOrderHistory;
