// LearnerSubscriptionManager.jsx - Manage learner subscriptions for HEAD

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Users,
  Plus,
  Search,
  Pause,
  Play,
  XCircle,
  DollarSign,
  Edit3,
  Upload,
  AlertCircle,
  Loader2,
  Calendar,
  Package,
  Link2,
  TrendingUp,
  Clock,
  Trash2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import headService from "../../api/services/headService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const LearnerSubscriptionManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [learners, setLearners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBackdateModal, setShowBackdateModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showRenewalChainModal, setShowRenewalChainModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [renewalChain, setRenewalChain] = useState([]);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);

  // Form states
  const [createForm, setCreateForm] = useState({
    learner_id: "",
    package_id: "",
    discount_code: "",
    start_date: new Date().toISOString().split("T")[0],
  });

  const [backdateForm, setBackdateForm] = useState({
    learner_id: "",
    old_subscription_id: "",
    package_id: "",
    new_start_date: "",
    acknowledge_session_gap: false,
    discount_code: "",
  });

  const [adjustForm, setAdjustForm] = useState({
    adjustment_amount: "",
    adjustment_type: "ADD",
    reason: "",
  });

  const [refundForm, setRefundForm] = useState({
    refund_type: "FULL",
    refund_reason: "",
  });

  const [pauseForm, setPauseForm] = useState({
    pause_reason: "",
    expected_resume_date: "",
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptNotes, setReceiptNotes] = useState("");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sessionGapWarning, setSessionGapWarning] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);



  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [subsData, pkgsData, learnersData] = await Promise.all([
        subscriptionService.getAllSubscriptions(),
        subscriptionService.getAllPackages(true),
        headService.getAllLearners(),
      ]);

      setSubscriptions(subsData);
      setFilteredSubscriptions(subsData);
      setPackages(pkgsData);
      setLearners(learnersData);
    } catch (err) {
      setError("Failed to load data. Please try again.");
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    if (query.trim() === "") {
      setFilteredSubscriptions(subscriptions);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = subscriptions.filter(
        (sub) =>
          sub.learner_name?.toLowerCase().includes(lowerQuery) ||
          sub.package_name?.toLowerCase().includes(lowerQuery)
      );
      setFilteredSubscriptions(filtered);
    }
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    if (status === "ALL") {
      setFilteredSubscriptions(subscriptions);
    } else {
      setFilteredSubscriptions(subscriptions.filter((sub) => sub.status === status));
    }
  };

  const handleCreateSubscription = async (e) => {
    e.preventDefault();

    if (!createForm.learner_id || !createForm.package_id) {
      toast.error("Please select learner and package");
      return;
    }

    try {
      await subscriptionService.createSubscription({
        learner_id: parseInt(createForm.learner_id),
        package_id: parseInt(createForm.package_id),
        discount_code: createForm.discount_code || null,
        start_date: createForm.start_date,
      });

      toast.success("Subscription created successfully!");
      setShowCreateModal(false);
      setCreateForm({
        learner_id: "",
        package_id: "",
        discount_code: "",
        start_date: new Date().toISOString().split("T")[0],
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create subscription");
    }
  };

  const handleValidateBackdate = async () => {
    if (!backdateForm.learner_id || !backdateForm.old_subscription_id || !backdateForm.new_start_date) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const validation = await subscriptionService.validateBackdate(
        parseInt(backdateForm.learner_id),
        parseInt(backdateForm.old_subscription_id),
        backdateForm.new_start_date
      );

      if (validation.has_session_gap) {
        setSessionGapWarning(validation.session_gap_warning);
        toast.warning(`Warning: ${validation.session_gap_warning.session_count} sessions found in gap period`, {
          autoClose: 5000,
        });
      } else {
        setSessionGapWarning(null);
        toast.success("Backdate validation passed!");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Validation failed");
    }
  };

  const handleBackdateSubscription = async (e) => {
    e.preventDefault();

    if (!backdateForm.package_id) {
      toast.error("Please select a package");
      return;
    }

    if (sessionGapWarning && !backdateForm.acknowledge_session_gap) {
      toast.error("Please acknowledge session gap warning");
      return;
    }

    try {
      await subscriptionService.createBackdatedSubscription({
        learner_id: parseInt(backdateForm.learner_id),
        package_id: parseInt(backdateForm.package_id),
        start_date: backdateForm.new_start_date,
        acknowledge_session_gap: backdateForm.acknowledge_session_gap,
        discount_code: backdateForm.discount_code || null,
      }, parseInt(backdateForm.old_subscription_id));

      toast.success("Backdated subscription created successfully!");
      setShowBackdateModal(false);
      setBackdateForm({
        learner_id: "",
        old_subscription_id: "",
        package_id: "",
        new_start_date: "",
        acknowledge_session_gap: false,
        discount_code: "",
      });
      setSessionGapWarning(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create backdated subscription");
    }
  };

  const handlePauseSubscription = async (e) => {
    e.preventDefault();

    try {
      await subscriptionService.pauseSubscription(selectedSubscription.id, pauseForm.pause_reason);

      toast.success("Subscription paused successfully!");
      setShowPauseModal(false);
      setPauseForm({ pause_reason: "", expected_resume_date: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to pause subscription");
    }
  };

  const handleResumeSubscription = async (subscriptionId) => {
    if (!window.confirm("Are you sure you want to resume this subscription?")) {
      return;
    }

    try {
      await subscriptionService.resumeSubscription(subscriptionId);
      toast.success("Subscription resumed successfully!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to resume subscription");
    }
  };

  const handleCancelSubscription = async (subscriptionId) => {
    const reason = window.prompt("Please provide a reason for cancellation (minimum 10 characters):");
    if (!reason || reason.trim().length < 10) {
      toast.error("Please provide a valid cancellation reason (minimum 10 characters)");
      return;
    }

    try {
      await subscriptionService.cancelSubscription(subscriptionId, reason);
      toast.success("Subscription cancelled successfully!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to cancel subscription");
    }
  };

  const handleDeleteSubscription = (subscription) => {
    setSelectedSubscription(subscription);
    setDeleteConfirmStep(1);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
      return;
    }

    // Final confirmation - proceed with deletion
    try {
      await subscriptionService.deleteSubscription(selectedSubscription.id);
      toast.success("Subscription deleted successfully!");
      setShowDeleteModal(false);
      setDeleteConfirmStep(1);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete subscription");
      setShowDeleteModal(false);
      setDeleteConfirmStep(1);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteConfirmStep(1);
  };

  const handleRefundSubscription = async (e) => {
    e.preventDefault();

    if (!refundForm.refund_reason || refundForm.refund_reason.trim().length < 10) {
      toast.error("Please provide a valid refund reason (minimum 10 characters)");
      return;
    }

    try {
      await subscriptionService.processRefund(
        selectedSubscription.id,
        refundForm.refund_type,
        refundForm.refund_reason
      );

      toast.success("Refund processed successfully!");
      setShowRefundModal(false);
      setRefundForm({ refund_type: "FULL", refund_reason: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to process refund");
    }
  };

  const handleAdjustSessions = async (e) => {
    e.preventDefault();

    if (!adjustForm.adjustment_amount || !adjustForm.reason) {
      toast.error("Please fill all fields");
      return;
    }

    if (adjustForm.reason.length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }

    try {
      await subscriptionService.adjustSessions(selectedSubscription.id, {
        subscription_id: selectedSubscription.id,
        adjustment_amount: parseInt(adjustForm.adjustment_amount),
        adjustment_type: adjustForm.adjustment_type,
        reason: adjustForm.reason,
      });

      toast.success("Sessions adjusted successfully!");
      setShowAdjustModal(false);
      setAdjustForm({ adjustment_amount: "", adjustment_type: "ADD", reason: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to adjust sessions");
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();

    if (!receiptFile) {
      toast.error("Please select a file");
      return;
    }

    try {
      await subscriptionService.uploadPaymentReceipt(
        selectedSubscription.id,
        receiptFile,
        receiptNotes
      );

      toast.success("Receipt uploaded successfully!");
      setShowReceiptModal(false);
      setReceiptFile(null);
      setReceiptNotes("");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to upload receipt");
    }
  };

  const handleViewRenewalChain = async (subscriptionId) => {
    try {
      const chain = await subscriptionService.getRenewalChain(subscriptionId);
      setRenewalChain(chain);
      setShowRenewalChainModal(true);
    } catch (err) {
      toast.error("Failed to load renewal chain");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ACTIVE: { className: "status-badge status-badge-active", label: "Active" },
      PAUSED: { className: "status-badge status-badge-paused", label: "Paused" },
      FROZEN: { className: "status-badge status-badge-frozen", label: "Frozen" },
      EXPIRED: { className: "status-badge status-badge-expired", label: "Expired" },
      CANCELLED: { className: "status-badge status-badge-cancelled", label: "Cancelled" },
    };

    const config = statusConfig[status] || statusConfig.EXPIRED;

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
            <button onClick={() => navigate("/head/dashboard")} className="back-button">
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>

            <div>
              <h1 className="page-title">Manage Learner Subscriptions</h1>
              <p className="page-description">
                Create, manage, and track learner subscriptions
              </p>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="search-section">
            <SearchBar onSearch={handleSearch} placeholder="Search by learner or package..." />
            <div className="filter-section">
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                <Plus size={20} />
                Create Subscription
              </button>
              <button onClick={() => {
                setShowBackdateModal(true);
              }} className="btn-secondary">
                <Clock size={20} />
                Renewal
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="filter-section">
            {["ALL", "ACTIVE", "PAUSED", "EXPIRED", "CANCELLED"].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusFilter(status)}
                className={`filter-button ${statusFilter === status ? 'filter-button-active' : ''}`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <Loader2 className="spinner" size={48} />
              <p>Loading subscriptions...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-container">
              <AlertCircle size={48} />
              <p>{error}</p>
              <button onClick={fetchData} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {/* Subscriptions Grid */}
          {!loading && !error && (
            <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "20px" }}>
              {filteredSubscriptions.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
                  <Users size={64} />
                  <p>No subscriptions found</p>
                  <button onClick={() => setShowCreateModal(true)} className="primary-button">
                    <Plus size={18} />
                    Create First Subscription
                  </button>
                </div>
              ) : (
                filteredSubscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="subscription-card"
                  >
                    <div className="receipt-card-header">
                      <div>
                        <h3 className="receipt-card-title">
                          {sub.learner_name || `Learner #${sub.learner_id}`}
                        </h3>
                        <p className="card-subtitle">{sub.package_name}</p>
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>

                    <div className="discount-details">
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Sessions:</span>
                        <span className="discount-detail-value">
                          {sub.sessions_completed}/{sub.sessions_total}
                        </span>
                      </div>
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Remaining:</span>
                        <span className="discount-detail-value">
                          {sub.sessions_remaining} sessions
                        </span>
                      </div>
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Start Date:</span>
                        <span className="discount-detail-value">
                          {new Date(sub.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Expiry Date:</span>
                        <span className="discount-detail-value">
                          {new Date(sub.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Price Paid:</span>
                        <span className="card-price">₹{parseFloat(sub.net_price_paid).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="card-actions-column">
                      {sub.status === "ACTIVE" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSubscription(sub);
                              setShowPauseModal(true);
                            }}
                            className="btn btn-warning btn-full"
                          >
                            <Pause size={16} />
                            Pause
                          </button>
                        </>
                      )}

                      {(sub.status === "PAUSED") && (
                        <button
                          onClick={() => handleResumeSubscription(sub.id)}
                          className="btn btn-success btn-full"
                        >
                          <Play size={16} />
                          Resume
                        </button>
                      )}

                      {["ACTIVE", "PAUSED"].includes(sub.status) && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedSubscription(sub);
                              setShowAdjustModal(true);
                            }}
                            className="btn btn-purple btn-full"
                          >
                            <Edit3 size={16} />
                            Adjust Sessions
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubscription(sub);
                              setShowReceiptModal(true);
                            }}
                            className="btn btn-info btn-full"
                          >
                            <Upload size={16} />
                            Upload Receipt
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSubscription(sub);
                              setShowRefundModal(true);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "5px",
                              padding: "8px",
                              borderRadius: "6px",
                              backgroundColor: "#ef4444",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            <DollarSign size={16} />
                            Process Refund
                          </button>
                          <button
                            onClick={() => handleCancelSubscription(sub.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "5px",
                              padding: "8px",
                              borderRadius: "6px",
                              backgroundColor: "#6b7280",
                              color: "#fff",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "14px",
                            }}
                          >
                            <XCircle size={16} />
                            Cancel
                          </button>
                        </>
                      )}

                      {["EXPIRED", "CANCELLED"].includes(sub.status) && (
                        <button
                          onClick={() => handleDeleteSubscription(sub)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "5px",
                            padding: "8px",
                            borderRadius: "6px",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            border: "none",
                            cursor: "pointer",
                            fontSize: "14px",
                          }}
                          title="Permanently delete this subscription"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}

                      <button
                        onClick={() => handleViewRenewalChain(sub.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          padding: "8px",
                          borderRadius: "6px",
                          backgroundColor: "#64748b",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "14px",
                        }}
                      >
                        <Link2 size={16} />
                        View Chain
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Trash2 size={24} color="#dc2626" />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 4px 0" }}>
                    {deleteConfirmStep === 1 ? "Delete Subscription?" : "Final Confirmation"}
                  </h2>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                    {deleteConfirmStep === 1 ? "Step 1 of 2" : "Step 2 of 2"}
                  </p>
                </div>
              </div>
              <button onClick={handleCancelDelete} className="modal-close">×</button>
            </div>

            <div className="modal-body" style={{ paddingTop: "12px" }}>
              {deleteConfirmStep === 1 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ color: "#374151", lineHeight: "1.6" }}>
                    You are about to <strong>permanently delete</strong> this subscription. This action <strong>cannot be undone</strong>.
                  </p>
                  <div style={{
                    backgroundColor: "#fef3c7",
                    border: "1px solid #fcd34d",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "14px",
                    color: "#92400e"
                  }}>
                    <strong>⚠️ Warning:</strong> All related payment receipts, session logs, and event history will also be permanently deleted from the database.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ color: "#374151", lineHeight: "1.6" }}>
                    Are you absolutely certain you want to delete this subscription for <strong>{selectedSubscription?.learner_name || "Learner #" + selectedSubscription?.learner_id}</strong>?
                  </p>
                  <div style={{
                    backgroundColor: "#fee2e2",
                    border: "2px solid #fca5a5",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "14px",
                    color: "#991b1b"
                  }}>
                    <strong>🔴 CRITICAL:</strong> This will completely remove the subscription and all associated data from the database. This action is irreversible!
                  </div>
                </div>
              )}
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
              paddingTop: "20px",
              borderTop: "1px solid #e5e7eb",
            }}>
              <button
                onClick={handleCancelDelete}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#e5e7eb";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#f3f4f6";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: "6px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#dc2626";
                }}
              >
                {deleteConfirmStep === 1 ? "Continue to Confirm" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Subscription</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleCreateSubscription} className="modal-body">
              <div className="form-group">
                <label>Learner *</label>
                <select value={createForm.learner_id} onChange={(e) => setCreateForm({ ...createForm, learner_id: e.target.value })} required>
                  <option value="">Select Learner</option>
                  {learners.map((learner) => (
                    <option key={learner.user_id || learner.id} value={learner.user_id || learner.id}>
                      {learner.user?.name || learner.name || `Learner ${learner.id}`} ({learner.user?.email || learner.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Package *</label>
                <select value={createForm.package_id} onChange={(e) => setCreateForm({ ...createForm, package_id: e.target.value })} required>
                  <option value="">Select Package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.package_name} - {pkg.sessions_count} sessions, {pkg.validity_days} days - ₹{pkg.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={createForm.start_date}
                  onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Discount Code (Optional)</label>
                <input
                  type="text"
                  value={createForm.discount_code}
                  onChange={(e) => setCreateForm({ ...createForm, discount_code: e.target.value })}
                  placeholder="Enter discount code"
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backdate Renewal Modal */}
      {showBackdateModal && (
        <div className="modal-overlay" onClick={() => setShowBackdateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Backdate Subscription Renewal</h2>
              <button onClick={() => setShowBackdateModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleBackdateSubscription} className="modal-body">
              <div className="form-group">
                <label>Learner *</label>
                <select
                  value={backdateForm.learner_id}
                  onChange={(e) => {
                    const selectedLearnerId = e.target.value;
                    // Auto-select the most recent subscription for this learner
                    const learnersubs = subscriptions
                      .filter((s) => String(s.learner_id) === selectedLearnerId)
                      .sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date));

                    setBackdateForm({
                      ...backdateForm,
                      learner_id: selectedLearnerId,
                      old_subscription_id: learnersubs.length > 0 ? String(learnersubs[0].id) : ''
                    });
                  }}
                  required
                >
                  <option value="">Select Learner</option>
                  {learners.map((learner) => (
                    <option key={learner.user_id || learner.id} value={learner.user_id || learner.id}>
                      {learner.user?.name || learner.name || `Learner ${learner.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Old Subscription * (Most Recent Package)</label>
                <select
                  value={backdateForm.old_subscription_id}
                  onChange={(e) => setBackdateForm({ ...backdateForm, old_subscription_id: e.target.value })}
                  required
                  disabled={!backdateForm.learner_id}
                >
                  {!backdateForm.learner_id ? (
                    <option value="">Select learner first</option>
                  ) : (() => {
                    const learnersubs = subscriptions
                      .filter((s) => String(s.learner_id) === String(backdateForm.learner_id))
                      .sort((a, b) => new Date(b.created_at || b.start_date) - new Date(a.created_at || a.start_date));

                    if (learnersubs.length === 0) {
                      return <option value="">No subscriptions available</option>;
                    }

                    return (
                      <>
                        <option value="">Select Subscription</option>
                        {learnersubs.map((sub, index) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.package_name} - {sub.status} (Expires: {new Date(sub.expiry_date).toLocaleDateString()})
                          </option>
                        ))}
                      </>
                    );
                  })()}
                </select>
              </div>
              <button type="button" onClick={handleValidateBackdate} className="btn-primary btn-full" style={{ marginTop: "15px", marginBottom: "15px" }}>
                Validate Backdate
              </button>

              <div className="form-group">
                <label>New Start Date *</label>
                <input
                  type="date"
                  value={backdateForm.new_start_date}
                  onChange={(e) => setBackdateForm({ ...backdateForm, new_start_date: e.target.value })}
                  required
                />
              </div>

              {sessionGapWarning && (
                <div className="warning-box">
                  <p className="warning-text">
                    <AlertCircle size={16} className="warning-icon" />
                    Session Gap Warning
                  </p>
                  <p className="card-subtitle">
                    {sessionGapWarning.session_count} sessions found between {new Date(sessionGapWarning.gap_start).toLocaleDateString()} and{" "}
                    {new Date(sessionGapWarning.gap_end).toLocaleDateString()}
                  </p>
                  <label className="form-checkbox-label" style={{ marginTop: "10px" }}>
                    <input
                      type="checkbox"
                      checked={backdateForm.acknowledge_session_gap}
                      onChange={(e) => setBackdateForm({ ...backdateForm, acknowledge_session_gap: e.target.checked })}
                    />
                    <span className="card-subtitle">I acknowledge this session gap</span>
                  </label>
                </div>
              )}

              <div className="form-group">
                <label>New Package *</label>
                <select value={backdateForm.package_id} onChange={(e) => setBackdateForm({ ...backdateForm, package_id: e.target.value })} required>
                  <option value="">Select Package</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.package_name} - ₹{pkg.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Discount Code (Optional)</label>
                <input
                  type="text"
                  value={backdateForm.discount_code}
                  onChange={(e) => setBackdateForm({ ...backdateForm, discount_code: e.target.value })}
                  placeholder="Enter discount code"
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowBackdateModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Backdated Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="modal-overlay" onClick={() => setShowPauseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pause Subscription</h2>
              <button onClick={() => setShowPauseModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handlePauseSubscription} className="modal-body">
              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={pauseForm.pause_reason}
                  onChange={(e) => setPauseForm({ ...pauseForm, pause_reason: e.target.value })}
                  required
                  rows="3"
                  placeholder="Reason for pausing..."
                />
              </div>

              <div className="form-group">
                <label>Expected Resume Date (Optional)</label>
                <input
                  type="date"
                  value={pauseForm.expected_resume_date}
                  onChange={(e) => setPauseForm({ ...pauseForm, expected_resume_date: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowPauseModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Pause Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Freeze Modal */}

      {/* Adjust Sessions Modal */}
      {showAdjustModal && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Sessions</h2>
              <button onClick={() => setShowAdjustModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleAdjustSessions} className="modal-body">
              <div className="info-box" style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
                  <strong>Note:</strong> As HEAD, you can adjust sessions up to 3 times per subscription (max ±10 sessions per adjustment). For additional adjustments, contact ADMIN.
                </p>
              </div>

              <div className="form-group">
                <label>Adjustment Type *</label>
                <select
                  value={adjustForm.adjustment_type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
                  required
                >
                  <option value="ADD">Add Sessions</option>
                  <option value="SUBTRACT">Subtract Sessions</option>
                </select>
              </div>

              <div className="form-group">
                <label>Amount * (Max: 10 per adjustment)</label>
                <input
                  type="number"
                  value={adjustForm.adjustment_amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_amount: e.target.value })}
                  min="1"
                  max="10"
                  required
                />
              </div>

              <div className="form-group">
                <label>Reason * (minimum 10 characters)</label>
                <textarea
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  required
                  rows="3"
                  minLength="10"
                  placeholder="Enter detailed reason for adjustment (min. 10 characters)..."
                />
                <small style={{ color: '#6b7280', fontSize: '12px' }}>
                  {adjustForm.reason.length}/10 characters
                </small>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Adjust Sessions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="modal-overlay" onClick={() => setShowRefundModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Process Refund</h2>
              <button onClick={() => setShowRefundModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleRefundSubscription} className="modal-body">
              <div className="form-group">
                <label>Refund Type *</label>
                <select value={refundForm.refund_type} onChange={(e) => setRefundForm({ ...refundForm, refund_type: e.target.value })} required>
                  <option value="FULL">Full Refund</option>
                  <option value="PRORATED">Prorated Refund (Based on remaining sessions)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={refundForm.refund_reason}
                  onChange={(e) => setRefundForm({ ...refundForm, refund_reason: e.target.value })}
                  required
                  rows="3"
                  placeholder="Reason for refund..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowRefundModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Process Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Receipt Modal */}
      {showReceiptModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Payment Receipt</h2>
              <button onClick={() => setShowReceiptModal(false)} className="modal-close">×</button>
            </div>

            <form onSubmit={handleUploadReceipt} className="modal-body">
              <div className="form-group">
                <label>Receipt File *</label>
                <input type="file" onChange={(e) => setReceiptFile(e.target.files[0])} accept="image/*,application/pdf" required />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} rows="3" placeholder="Additional notes..." />
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowReceiptModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Upload Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renewal Chain Modal */}
      {showRenewalChainModal && (
        <div className="modal-overlay" onClick={() => setShowRenewalChainModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renewal Chain History</h2>
              <button onClick={() => setShowRenewalChainModal(false)} className="modal-close">×</button>
            </div>

            <div className="modal-body">
              {renewalChain.length === 0 ? (
                <p className="empty-state-text">No renewal history found.</p>
              ) : (
                <div className="card-actions-column">
                  {renewalChain.map((sub, index) => (
                    <div
                      key={sub.id}
                      className={`subscription-card ${index === renewalChain.length - 1 ? '' : ''}`}
                      style={{
                        backgroundColor: index === renewalChain.length - 1 ? "#dbeafe" : "#fff",
                      }}
                    >
                      <div className="receipt-card-header">
                        <h4 className="discount-detail-value">
                          #{index + 1} - {sub.package_name}
                        </h4>
                        {getStatusBadge(sub.status)}
                      </div>
                      <div className="card-subtitle">
                        <p>
                          Period: {new Date(sub.start_date).toLocaleDateString()} - {new Date(sub.expiry_date).toLocaleDateString()}
                        </p>
                        <p>
                          Sessions: {sub.sessions_completed}/{sub.sessions_total} ({sub.sessions_remaining} remaining)
                        </p>
                        <p>Price: ₹{parseFloat(sub.net_price_paid).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowRenewalChainModal(false)} className="primary-button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearnerSubscriptionManager;
