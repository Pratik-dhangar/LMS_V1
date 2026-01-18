import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../api/axios";
import { toast } from "react-toastify";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  FileUp,
  TrendingUp,
} from "lucide-react";
import { getFileUrl } from "../../utils/fileUrlBuilder";
import "../../styles/ManageUsersLayout.css";
import "../../styles/admin/PaymentVerification.css";

const PaymentVerification = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState("");

  useEffect(() => {
    loadPendingOrders();
  }, [filter]);

  const loadPendingOrders = async () => {
    try {
      setLoading(true);
      const params = {
        _t: Date.now(), // Cache buster
      };
      // Only add status filter if not "ALL"
      if (filter !== "ALL") {
        params.status = filter;
      }
      const response = await axiosInstance.get(`/orders/admin/orders`, {
        params,
      });
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error("Error loading orders:", error);
      toast.error("Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayment = async (orderId) => {
    try {
      setApproving(true);
      // Use a longer timeout for approve since backend may generate invoice / upload to S3
      await axiosInstance.post(
        `/orders/admin/orders/${orderId}/approve`,
        {},
        { timeout: 30000 }
      );
      toast.success("Payment approved successfully!");
      await loadPendingOrders();
      setSelectedOrder(null);
      setShowDetails(false);
    } catch (error) {
      console.error("Error approving payment:", error);
      // If request timed out, re-check order status - server may have processed it
      const isTimeout =
        error.code === "ECONNABORTED" ||
        (error.message && error.message.toLowerCase().includes("timeout"));
      if (isTimeout) {
        try {
          // Re-fetch orders directly and check this order's status
          const checkResp = await axiosInstance.get(`/orders/admin/orders`, {
            params: { status: filter, _t: Date.now() },
          });
          const latest = checkResp.data.orders || [];
          const updatedOrder = latest.find((o) => o.order_id === orderId);
          if (updatedOrder && updatedOrder.status === "PAYMENT_APPROVED") {
            toast.success("Payment approved (confirmed after timeout)");
            await loadPendingOrders();
            setSelectedOrder(null);
            setShowDetails(false);
          } else {
            toast.error("Approve request timed out. Please try again.");
          }
        } catch (e) {
          console.error("Error checking order status after timeout:", e);
          toast.error("Approve request timed out. Please try again.");
        }
      } else {
        toast.error(
          error.response?.data?.detail || "Failed to approve payment"
        );
      }
    } finally {
      setApproving(false);
    }
  };

  const handleRejectPayment = async (orderId) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setRejecting(true);
      await axiosInstance.post(`/orders/admin/orders/${orderId}/reject`, {
        reason: rejectionReason,
      });
      toast.success("Payment rejected successfully!");
      loadPendingOrders();
      setSelectedOrder(null);
      setShowDetails(false);
      setRejectionReason("");
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error(error.response?.data?.detail || "Failed to reject payment");
    } finally {
      setRejecting(false);
    }
  };

  const handleMarkDelivered = async (orderId) => {
    try {
      setDelivering(true);
      await axiosInstance.post(
        `/orders/admin/orders/${orderId}/mark-delivered`,
        {},
        { timeout: 30000 }
      );
      toast.success("Order marked as delivered and email sent successfully!");
      await loadPendingOrders();
      setSelectedOrder(null);
      setShowDetails(false);
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      toast.error(
        error.response?.data?.detail || "Failed to mark order as delivered"
      );
    } finally {
      setDelivering(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      PAYMENT_UPLOADED: { className: "pending", icon: Clock, label: "Pending" },
      PAYMENT_APPROVED: {
        className: "approved",
        icon: CheckCircle,
        label: "Approved",
      },
      PAYMENT_REJECTED: {
        className: "rejected",
        icon: XCircle,
        label: "Rejected",
      },
      DELIVERED: {
        className: "delivered",
        icon: TrendingUp,
        label: "Delivered",
      },
    };
    const config = statusMap[status] || statusMap["PAYMENT_UPLOADED"];
    const Icon = config.icon;
    return (
      <span className={`payment-verification-status-badge ${config.className}`}>
        <Icon size={16} />
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="page-main">
        <div className="page-content">
          <div className="page-header">
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="back-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            {/* Left Side: Title and Subtitle */}
            <div>
              <h1 className="page-title">MarketPlace Orders</h1>
            </div>
          </div>

          {/* Filters */}
          <div className="payment-verification-filters">
            {[
              "ALL",
              "PAYMENT_UPLOADED",
              "PAYMENT_APPROVED",
              "DELIVERED",
              "PAYMENT_REJECTED",
            ].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`payment-verification-filter-btn ${filter === status ? "active" : "inactive"
                  }`}
              >
                {status === "ALL" && "All"}
                {status === "PAYMENT_UPLOADED" && "Pending"}
                {status === "PAYMENT_APPROVED" && "Approved"}
                {status === "DELIVERED" && "Delivered"}
                {status === "PAYMENT_REJECTED" && "Rejected"}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="payment-verification-loading">
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="payment-verification-empty">
              <FileUp size={48} className="payment-verification-empty-icon" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="payment-verification-table-container">
              <table className="payment-verification-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Payment Method</th>
                    <th>Items</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.order_id}
                      className={`payment-verification-table-row ${order.status === "PAYMENT_REJECTED" ? "rejected-row" : ""
                        }`}
                    >
                      <td className="payment-verification-order-number">
                        #{order.order_number}
                      </td>
                      
                      <td className="payment-verification-status">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="payment-verification-amount">
                        <span className="amount-value">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </td>
                      <td className="payment-verification-method">
                        {order.payment_method === "UPI_QR"
                          ? "UPI QR"
                          : "Bank Transfer"}
                      </td>
                      <td className="payment-verification-items">
                        {order.items?.length || 0} products
                      </td>
                      <td className="payment-verification-date">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="payment-verification-actions-cell">
                        <div className="payment-verification-actions">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDetails(true);
                            }}
                            className="payment-verification-btn payment-verification-btn-view"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {order.status === "PAYMENT_APPROVED" && (
                            <button
                              onClick={() => handleMarkDelivered(order.order_id)}
                              disabled={delivering}
                              className="payment-verification-btn payment-verification-btn-delivered"
                              title="Mark as Delivered"
                            >
                              <TrendingUp size={16} />
                            </button>
                          )}
                          {order.status === "PAYMENT_UPLOADED" && (
                            <>
                              <button
                                onClick={() => handleApprovePayment(order.order_id)}
                                disabled={approving}
                                className="payment-verification-btn payment-verification-btn-approve"
                                title="Approve Payment"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={() => handleRejectPayment(order.order_id)}
                                disabled={rejecting}
                                className="payment-verification-btn payment-verification-btn-reject"
                                title="Reject Payment"
                              >
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {showDetails && selectedOrder && (
          <div className="payment-verification-modal-overlay">
            <div className="payment-verification-modal">
              <h2 className="payment-verification-modal-title">
                Order #{selectedOrder.order_number} Details
              </h2>

              {/* Customer Info */}
              <div className="payment-verification-modal-section">
                <h3 className="payment-verification-section-title">
                  Customer Information
                </h3>
                <div className="payment-verification-section-content">
                  <p>
                    <strong>Name:</strong> {selectedOrder.user_name}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedOrder.user_email}
                  </p>
                  <p>
                    <strong>Delivery Address:</strong>{" "}
                    {selectedOrder.delivery_address}
                  </p>
                  <p>
                    <strong>City:</strong> {selectedOrder.delivery_city}
                  </p>
                  <p>
                    <strong>Pincode:</strong> {selectedOrder.delivery_pincode}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="payment-verification-modal-section">
                <h3 className="payment-verification-section-title">
                  Order Items
                </h3>
                <div className="payment-verification-items-container">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="payment-verification-item">
                      <div className="payment-verification-item-header">
                        <strong>{item.product_name}</strong>
                        <span>x{item.quantity}</span>
                      </div>
                      <div className="payment-verification-item-details">
                        <span>
                          Unit Price: {formatCurrency(item.unit_price)}
                        </span>
                        <span>Subtotal: {formatCurrency(item.line_total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="payment-verification-modal-section">
                <h3 className="payment-verification-section-title">
                  Payment Summary
                </h3>
                <div className="payment-verification-section-content">
                  <div className="payment-verification-summary-row">
                    <span>Subtotal:</span>
                    <span>
                      {formatCurrency(
                        parseFloat(selectedOrder.total_amount) +
                        parseFloat(selectedOrder.discount_total || 0)
                      )}
                    </span>
                  </div>
                  <div className="payment-verification-summary-row discount">
                    <span>Discount:</span>
                    <span>
                      -{formatCurrency(selectedOrder.discount_total || 0)}
                    </span>
                  </div>
                  <div className="payment-verification-summary-row total">
                    <span>Total Amount:</span>
                    <span>{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Receipt Preview */}
              <div className="payment-verification-modal-section">
                <h3 className="payment-verification-section-title">
                  Payment Receipt
                </h3>
                {selectedOrder.payment_receipt ? (
                  <div className="payment-verification-receipt-container">
                    {selectedOrder.payment_receipt.file_type?.toLowerCase() ===
                      "pdf" ? (
                      <div className="payment-verification-pdf-placeholder">
                        <FileUp
                          size={32}
                          className="payment-verification-pdf-icon"
                        />
                        <p className="payment-verification-pdf-info">
                          PDF Document
                        </p>
                        <p className="payment-verification-pdf-name">
                          {selectedOrder.payment_receipt.file_name}
                        </p>
                        <a
                          href={
                            selectedOrder.payment_receipt.s3_path.startsWith(
                              "http"
                            )
                              ? selectedOrder.payment_receipt.s3_path
                              : getFileUrl(
                                selectedOrder.payment_receipt.s3_path
                              )
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="payment-verification-pdf-link"
                        >
                          Download PDF
                        </a>
                      </div>
                    ) : (
                      (() => {
                        const receiptUrl =
                          selectedOrder.payment_receipt?.s3_path;
                        // Backend now returns full URLs, but handle both cases
                        let imageUrl;
                        if (
                          receiptUrl.startsWith("https://") ||
                          receiptUrl.startsWith("http://")
                        ) {
                          imageUrl = receiptUrl;
                          console.log(
                            "Payment Receipt: Using direct URL:",
                            imageUrl
                          );
                        } else {
                          imageUrl = getFileUrl(receiptUrl);
                          console.log(
                            "Payment Receipt: Converted path to URL:",
                            imageUrl
                          );
                        }
                        return (
                          <img
                            src={imageUrl}
                            alt="Payment Receipt"
                            onClick={() => {
                              setPreviewReceiptUrl(imageUrl);
                              setShowReceiptPreview(true);
                            }}
                            className="payment-verification-receipt-image"
                            onError={(e) => {
                              console.error(
                                "Failed to load payment receipt image:",
                                imageUrl
                              );
                              e.target.parentElement.innerHTML =
                                '<div style="padding: 2rem; text-align: center; color: #6b7280;">Failed to load receipt image</div>';
                            }}
                          />
                        );
                      })()
                    )}
                    <div className="payment-verification-receipt-meta">
                      <p>
                        <strong>Uploaded:</strong>{" "}
                        {new Date(
                          selectedOrder.payment_receipt.uploaded_at
                        ).toLocaleString()}
                      </p>
                      <p>
                        <strong>File:</strong>{" "}
                        {selectedOrder.payment_receipt.file_name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="payment-verification-no-receipt">
                    <AlertCircle
                      size={20}
                      className="payment-verification-no-receipt-icon"
                    />
                    <div>
                      <p className="payment-verification-no-receipt-title">
                        No Receipt Uploaded
                      </p>
                      <p className="payment-verification-no-receipt-text">
                        Admin cannot verify or approve payment without a
                        receipt.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Rejection Reason Input (for pending orders) */}
              {selectedOrder.status === "PAYMENT_UPLOADED" && (
                <div className="payment-verification-modal-section">
                  <label className="payment-verification-input-label">
                    Rejection Reason (if rejecting){" "}
                    <span className="required">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="payment-verification-textarea"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="payment-verification-modal-actions">
                <button
                  onClick={() => {
                    setShowDetails(false);
                    setSelectedOrder(null);
                    setRejectionReason("");
                  }}
                  className="payment-verification-btn-close"
                >
                  Close
                </button>
                {selectedOrder.status === "PAYMENT_UPLOADED" && (
                  <>
                    <button
                      onClick={() =>
                        handleApprovePayment(selectedOrder.order_id)
                      }
                      disabled={approving || !selectedOrder.payment_receipt}
                      title={
                        !selectedOrder.payment_receipt
                          ? "Receipt must be uploaded before approval"
                          : ""
                      }
                      className="payment-verification-btn-modal-approve"
                    >
                      {approving
                        ? "Approving..."
                        : "Approve Payment & Proceed to Shipping"}
                    </button>
                    <button
                      onClick={() =>
                        handleRejectPayment(selectedOrder.order_id)
                      }
                      disabled={
                        rejecting ||
                        !rejectionReason.trim() ||
                        !selectedOrder.payment_receipt
                      }
                      title={
                        !selectedOrder.payment_receipt
                          ? "Receipt must be present for rejection"
                          : ""
                      }
                      className="payment-verification-btn-modal-reject"
                    >
                      {rejecting ? "Rejecting..." : "Reject Payment"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Receipt Preview Modal */}
        {showReceiptPreview && previewReceiptUrl && (
          <div
            className="payment-verification-preview-overlay"
            onClick={() => setShowReceiptPreview(false)}
          >
            <div
              className="payment-verification-preview-container"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Top Right Corner */}
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="payment-verification-preview-close"
                title="Close preview"
              >
                ✕
              </button>

              {/* Receipt Image */}
              <img
                src={previewReceiptUrl}
                alt="Receipt Preview"
                className="payment-verification-preview-image"
              />
            </div>
          </div>
        )}
      </div>
  );
};

export default PaymentVerification;
