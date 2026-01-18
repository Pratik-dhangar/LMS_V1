// SubscriptionPaymentVerification.jsx - ADMIN subscription payment receipt verification

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Loader2,
  AlertCircle,
  User,
  Package,
  Calendar,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const SubscriptionPaymentVerification = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pendingReceipts, setPendingReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [verificationForm, setVerificationForm] = useState({
    status: "APPROVED",
    admin_notes: "",
  });

  useEffect(() => {
    fetchPendingReceipts();
  }, []);

  const fetchPendingReceipts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await subscriptionService.getPendingPaymentReceipts();
      setPendingReceipts(data);
    } catch (err) {
      console.error("Error fetching pending receipts:", err);
      setError("Failed to load pending receipts. Please try again.");
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyModal = (receipt) => {
    setSelectedReceipt(receipt);
    setVerificationForm({
      status: "APPROVED",
      admin_notes: "",
    });
    setShowVerifyModal(true);
  };

  const handleCloseVerifyModal = () => {
    setShowVerifyModal(false);
    setSelectedReceipt(null);
    setVerificationForm({
      status: "APPROVED",
      admin_notes: "",
    });
  };

  const handleVerifyReceipt = async (e) => {
    e.preventDefault();

    if (verificationForm.status === "REJECTED" && !verificationForm.admin_notes.trim()) {
      toast.error("Please provide rejection reason");
      return;
    }

    try {
      await subscriptionService.verifyPaymentReceipt(selectedReceipt.id, {
        payment_status: verificationForm.status,
        admin_notes: verificationForm.admin_notes,
      });

      toast.success(`Receipt ${verificationForm.status === "APPROVED" ? "approved" : "rejected"} successfully!`);
      handleCloseVerifyModal();
      fetchPendingReceipts();
    } catch (err) {
      console.error("Error verifying receipt:", err);
      toast.error(err.response?.data?.detail || "Failed to verify receipt");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { className: "status-badge status-badge-pending", label: "Pending" },
      APPROVED: { className: "status-badge status-badge-approved", label: "Approved" },
      REJECTED: { className: "status-badge status-badge-rejected", label: "Rejected" },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
      <span className={config.className}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          {/* Header */}
          <div className="page-header">
            <button onClick={() => navigate("/admin/dashboard")} className="back-button">
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

            <div>
              <h1 className="page-title">Subscription Payment Verification</h1>
              <p className="page-description">
                Review and verify pending subscription payment receipts
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="stats-grid">
            <div className="stat-card stat-card-pending">
              <div className="stat-card-content">
                <FileText size={24} className="stat-card-icon stat-card-icon-pending" />
                <div>
                  <p className="stat-card-value stat-card-value-pending">
                    {pendingReceipts.length}
                  </p>
                  <p className="stat-card-label stat-card-label-pending">Pending Receipts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <Loader2 className="spinner" size={48} />
              <p>Loading pending receipts...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-container">
              <AlertCircle size={48} />
              <p>{error}</p>
              <button onClick={fetchPendingReceipts} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {/* Receipts Grid */}
          {!loading && !error && (
            <div className="cards-grid">
              {pendingReceipts.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle size={64} className="empty-state-icon" style={{ color: "#10b981" }} />
                  <p className="empty-state-text">No pending receipts to verify</p>
                  <p className="card-subtitle" style={{ marginTop: "10px" }}>
                    All payment receipts have been processed
                  </p>
                </div>
              ) : (
                pendingReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="receipt-card"
                  >
                    {/* Header */}
                    <div className="receipt-card-header">
                      <div>
                        <h3 className="receipt-card-title">
                          Receipt #{receipt.id}
                        </h3>
                        <p className="receipt-card-date">
                          {new Date(receipt.uploaded_at).toLocaleString()}
                        </p>
                      </div>
                      {getStatusBadge(receipt.payment_status)}
                    </div>

                    {/* Subscription Details */}
                    <div className="receipt-details">
                      <div className="receipt-detail-row">
                        <User size={16} className="receipt-detail-icon" />
                        <span className="receipt-detail-text">
                          <strong>Learner:</strong> {receipt.learner_name || `ID: ${receipt.subscription?.learner_id}`}
                        </span>
                      </div>
                      <div className="receipt-detail-row">
                        <Package size={16} className="receipt-detail-icon" />
                        <span className="receipt-detail-text">
                          <strong>Package:</strong> {receipt.package_name || "N/A"}
                        </span>
                      </div>
                      <div className="receipt-detail-row">
                        <Calendar size={16} className="receipt-detail-icon" />
                        <span className="receipt-detail-text">
                          <strong>Subscription ID:</strong> {receipt.subscription_id}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="receipt-amount">
                      <p className="receipt-amount-label">
                        Amount Paid
                      </p>
                      <p className="receipt-amount-value">
                        ₹{parseFloat(receipt.amount_paid).toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Notes */}
                    {receipt.notes && (
                      <div className="receipt-notes">
                        <p className="receipt-notes-label">
                          Notes:
                        </p>
                        <p className="receipt-notes-text">{receipt.notes}</p>
                      </div>
                    )}

                    {/* File Info */}
                    <div className="receipt-file">
                      <p className="receipt-file-label">
                        Receipt File
                      </p>
                      <div className="receipt-file-box">
                        <FileText size={16} className="receipt-file-icon" />
                        <span className="receipt-file-name">
                          {receipt.file_path?.split("/").pop() || "receipt_file"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="card-actions">
                      {receipt.file_path && (
                        <a
                          href={receipt.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-flex-1"
                        >
                          <Eye size={16} />
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenVerifyModal(receipt)}
                        className="btn btn-success btn-flex-1"
                      >
                        <CheckCircle size={16} />
                        Verify
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Verification Modal */}
      {showVerifyModal && selectedReceipt && (
        <div className="modal-overlay" onClick={handleCloseVerifyModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Verify Payment Receipt</h2>
              <button onClick={handleCloseVerifyModal} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleVerifyReceipt} className="modal-body">
              {/* Receipt Summary */}
              <div className="summary-box">
                <h4 className="summary-title">
                  Receipt Summary
                </h4>
                <div className="summary-content">
                  <p>
                    <strong>Receipt ID:</strong> {selectedReceipt.id}
                  </p>
                  <p>
                    <strong>Learner:</strong> {selectedReceipt.learner_name || `ID: ${selectedReceipt.subscription?.learner_id}`}
                  </p>
                  <p>
                    <strong>Package:</strong> {selectedReceipt.package_name || "N/A"}
                  </p>
                  <p>
                    <strong>Amount Paid:</strong>{" "}
                    <span className="card-price">
                      ₹{parseFloat(selectedReceipt.amount_paid).toLocaleString("en-IN")}
                    </span>
                  </p>
                  <p>
                    <strong>Uploaded:</strong> {new Date(selectedReceipt.uploaded_at).toLocaleString()}
                  </p>
                  {selectedReceipt.notes && (
                    <p>
                      <strong>Notes:</strong> {selectedReceipt.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Verification Form */}
              <div className="form-group">
                <label>Verification Status *</label>
                <select
                  className="form-select"
                  value={verificationForm.status}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, status: e.target.value })
                  }
                  required
                >
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Admin Notes {verificationForm.status === "REJECTED" && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <textarea
                  className="form-input"
                  value={verificationForm.admin_notes}
                  onChange={(e) =>
                    setVerificationForm({ ...verificationForm, admin_notes: e.target.value })
                  }
                  required={verificationForm.status === "REJECTED"}
                  rows="4"
                  placeholder={
                    verificationForm.status === "REJECTED"
                      ? "Please provide reason for rejection..."
                      : "Optional notes (visible to HEAD)..."
                  }
                />
              </div>

              {/* Warning for Rejection */}
              {verificationForm.status === "REJECTED" && (
                <div className="alert-box">
                  <p className="alert-text">
                    <AlertCircle size={16} className="alert-icon" />
                    <span>
                      <strong>Warning:</strong> Rejecting this receipt will require the HEAD to re-upload
                      payment proof.
                    </span>
                  </p>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" onClick={handleCloseVerifyModal} className="secondary-button">
                  Cancel
                </button>
                <button
                  type="submit"
                  className={verificationForm.status === "APPROVED" ? "btn btn-success" : "btn btn-danger"}
                >
                  {verificationForm.status === "APPROVED" ? (
                    <>
                      <CheckCircle size={16} /> Approve Receipt
                    </>
                  ) : (
                    <>
                      <XCircle size={16} /> Reject Receipt
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPaymentVerification;
