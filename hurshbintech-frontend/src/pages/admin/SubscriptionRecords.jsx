// SubscriptionRecords.jsx - ADMIN view of all subscriptions with analytics

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Users,
  TrendingUp,
  DollarSign,
  Package,
  Search,
  Loader2,
  AlertCircle,
  Calendar,
  Filter,
  Download,
  BarChart3,
  Edit3,
  Eye,
  EyeOff,
  ClipboardList,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import publicSubscriptionService from "../../api/services/publicSubscriptionService";
import adminService from "../../api/services/adminService";
import headService from "../../api/services/headService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const SubscriptionRecords = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Active tab: "records" | "inquiries"
  const [activeTab, setActiveTab] = useState("records");

  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [heads, setHeads] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [visiblePasscodes, setVisiblePasscodes] = useState({});

  // ── Inquiry states
  const [inquiries, setInquiries] = useState([]);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState("");
  const [inquiriesLoading, setInquiriesLoading] = useState(false);
  const [inquirySearchQuery, setInquirySearchQuery] = useState("");
  const [filteredInquiries, setFilteredInquiries] = useState([]);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [updatingInquiry, setUpdatingInquiry] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [headFilter, setHeadFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Adjust Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    adjustment_amount: "",
    adjustment_type: "ADD",
    reason: "",
  });

  // Date filters for revenue
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchData();
  }, [statusFilter, headFilter]);

  useEffect(() => {
    // Set current date on component mount - this gets the actual system date
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${month}/${day}/${year}`;
    setCurrentDate(formattedDate);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchRevenueData();
    }
  }, [startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (headFilter) params.head_id = parseInt(headFilter);

      const [subsData, headsData, statsData] = await Promise.all([
        subscriptionService.getAllSubscriptionsAdmin(params),
        headService.getAllHeads(),
        subscriptionService.getSubscriptionStats(),
      ]);

      setSubscriptions(subsData);
      setFilteredSubscriptions(subsData);
      setHeads(headsData);
      setStats(statsData);
    } catch (err) {
      setError("Failed to load subscription records.");
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueData = async () => {
    try {
      const data = await subscriptionService.getRevenueByHead(startDate, endDate);
      setRevenueData(data);
    } catch (err) {
      toast.error("Failed to load revenue data");
    }
  };

  // ── Inquiry helpers ──────────────────────────────────────────────────────

  const fetchInquiries = async (status = inquiryStatusFilter) => {
    try {
      setInquiriesLoading(true);
      const params = {};
      if (status) params.review_status = status;
      const data = await publicSubscriptionService.getAdminInquiries(params);
      setInquiries(data);
      setFilteredInquiries(data);
    } catch (err) {
      toast.error("Failed to load subscription inquiries");
    } finally {
      setInquiriesLoading(false);
    }
  };

  const handleInquirySearch = (query) => {
    setInquirySearchQuery(query);
    const q = query.toLowerCase();
    if (!q.trim()) {
      setFilteredInquiries(inquiries);
      return;
    }
    setFilteredInquiries(
      inquiries.filter(
        (i) =>
          i.learner_name?.toLowerCase().includes(q) ||
          i.email?.toLowerCase().includes(q) ||
          i.contact_number?.toLowerCase().includes(q) ||
          i.package_name?.toLowerCase().includes(q),
      ),
    );
  };

  const handleInquiryStatusFilterChange = (newStatus) => {
    setInquiryStatusFilter(newStatus);
    fetchInquiries(newStatus);
  };

  const handleUpdateInquiryStatus = async (inquiryId, newStatus) => {
    setUpdatingInquiry(inquiryId);
    try {
      await publicSubscriptionService.updateInquiry(inquiryId, { review_status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      fetchInquiries();
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdatingInquiry(null);
    }
  };

  const handleDeleteInquiry = async (inquiryId) => {
    if (!window.confirm('Are you sure you want to delete this inquiry? This action cannot be undone.')) {
      return;
    }
    setUpdatingInquiry(inquiryId);
    try {
      await publicSubscriptionService.deleteInquiry(inquiryId);
      toast.success("Inquiry deleted successfully");
      fetchInquiries();
    } catch (err) {
      toast.error("Failed to delete inquiry");
    } finally {
      setUpdatingInquiry(null);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await publicSubscriptionService.exportCsv(inquiryStatusFilter || null);
      toast.success("CSV download started!");
    } catch (err) {
      toast.error("CSV export failed. Please try again.");
    } finally {
      setExportingCsv(false);
    }
  };

  // Switch to inquiries tab and load data lazily
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "inquiries" && inquiries.length === 0 && !inquiriesLoading) {
      fetchInquiries();
    }
  };

  const getInquiryStatusBadge = (status) => {
    const map = {
      NEW: { cls: "status-badge status-badge-pending", label: "New" },
      REVIEWED: { cls: "status-badge status-badge-active", label: "Reviewed" },
      PROCESSED: { cls: "status-badge status-badge-paused", label: "Processed" },
    };
    const cfg = map[status] || map.NEW;
    return <span className={cfg.cls}>{cfg.label}</span>;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setFilteredSubscriptions(subscriptions);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = subscriptions.filter(
        (sub) =>
          sub.learner_name?.toLowerCase().includes(lowerQuery) ||
          sub.package_name?.toLowerCase().includes(lowerQuery) ||
          sub.head_name?.toLowerCase().includes(lowerQuery)
      );
      setFilteredSubscriptions(filtered);
    }
  };

  const handleOpenAdjustModal = (subscription) => {
    setSelectedSubscription(subscription);
    setAdjustForm({
      adjustment_amount: "",
      adjustment_type: "ADD",
      reason: "",
    });
    setShowAdjustModal(true);
  };

  const handleCloseAdjustModal = () => {
    setShowAdjustModal(false);
    setSelectedSubscription(null);
    setAdjustForm({
      adjustment_amount: "",
      adjustment_type: "ADD",
      reason: "",
    });
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
      await subscriptionService.adjustSessionsAdmin(selectedSubscription.id, {
        adjustment_amount: parseInt(adjustForm.adjustment_amount),
        adjustment_type: adjustForm.adjustment_type,
        reason: adjustForm.reason,
      });

      toast.success("Sessions adjusted successfully!");
      handleCloseAdjustModal();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to adjust sessions");
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      ACTIVE: { className: "status-badge status-badge-active", label: "Active" },
      PAUSED: { className: "status-badge status-badge-paused", label: "Paused" },
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

  /**
   * Toggle passcode visibility for a specific learner
   * @param {number} learnerUserId - The user ID of the learner
   */
  const togglePasscodeVisibility = (learnerUserId) => {
    const currentlyVisible = !!visiblePasscodes[learnerUserId];
    if (currentlyVisible) {
      setVisiblePasscodes(prev => ({ ...prev, [learnerUserId]: false }));
      return;
    }

    (async () => {
      try {
        const resp = await adminService.revealPasscode(learnerUserId);
        setVisiblePasscodes(prev => ({ ...prev, [learnerUserId]: resp.passcode }));
      } catch (err) {
        console.error('Failed to reveal passcode for learner', learnerUserId, err);
        toast.error('Failed to reveal passcode', { position: 'top-center', autoClose: 3000 });
        setVisiblePasscodes(prev => ({ ...prev, [learnerUserId]: false }));
      }
    })();
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
              <h1 className="page-title">Manage Payment Records & Analytics</h1>
              <p className="page-description">
                View all subscription records and analyze revenue trends
              </p>
            </div>
          </div>

          {/* ── Tab Switcher ──────────────────────────────────────────── */}
          <div className="sub-tab-bar">
            <button
              className={`sub-tab-btn ${activeTab === 'records' ? 'sub-tab-btn-active' : ''}`}
              onClick={() => handleTabChange('records')}
            >
              <Package size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
              Manage Payment Records
            </button>
            <button
              className={`sub-tab-btn ${activeTab === 'inquiries' ? 'sub-tab-btn-active' : ''}`}
              onClick={() => handleTabChange('inquiries')}
            >
              <ClipboardList size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
              New Subscription Buyer
            </button>
          </div>

          {/* ── Records Tab ──────────────────────────────────────────── */}
          {activeTab === 'records' && (
            <>
              {/* Filters and Search */}
              <div className="search-section">
                <SearchBar onSearch={handleSearch} placeholder="Search by learner, package, or HEAD..." />
                <div className="filter-section">
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>

                  <select
                    className="form-select"
                    value={headFilter}
                    onChange={(e) => setHeadFilter(e.target.value)}
                  >
                    <option value="">All HEADs</option>
                    {heads.map((head) => (
                      <option key={head.id} value={head.user_id}>
                        {head.name || `HEAD ${head.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="loading-container">
                  <Loader2 className="spinner" size={48} />
                  <p>Loading subscription records...</p>
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

              {/* Subscriptions Table */}
              {!loading && !error && (
                <div className="table-primary-container">
                  {filteredSubscriptions.length === 0 ? (
                    <div className="empty-state">
                      <Users size={64} className="empty-state-icon" />
                      <p className="empty-state-text">No subscription records found</p>
                    </div>
                  ) : (
                    <div className="table-primary-wrapper">
                      <table className="table-primary">
                        <thead className="table-primary-header">
                          <tr>
                            <th className="table-primary-th table-primary-th-id">ID</th>
                            <th className="table-primary-th">Learner</th>
                            <th className="table-primary-th">Package</th>
                            <th className="table-primary-th">HEAD</th>
                            <th className="table-primary-th table-primary-th-center">Sessions</th>
                            <th className="table-primary-th">Start Date</th>
                            <th className="table-primary-th">Expiry Date</th>
                            <th className="table-primary-th table-primary-th-right">Amount Paid</th>
                            <th className="table-primary-th table-primary-th-center">Status</th>
                            <th className="table-primary-th table-primary-th-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="table-primary-body">
                          {filteredSubscriptions.map((sub) => (
                            <tr key={sub.id} className="table-primary-row">
                              <td className="table-primary-td table-primary-td-id">{sub.id}</td>
                              <td className="table-primary-td">{sub.learner_name || `ID: ${sub.learner_id}`}</td>
                              <td className="table-primary-td">{sub.package_name}</td>
                              <td className="table-primary-td subscription-head-name" data-empty="Not assigned">{sub.head_name || `HEAD ${sub.head_id || 'N/A'}`}</td>
                              <td className="table-primary-td table-primary-td-center">
                                {sub.sessions_remaining} / {sub.sessions_total}
                              </td>
                              <td className="table-primary-td">{new Date(sub.start_date).toLocaleDateString()}</td>
                              <td className="table-primary-td">
                                {new Date(sub.expiry_date).toLocaleDateString()}
                              </td>
                              <td className="table-primary-td table-primary-td-right card-price">
                                ₹{parseFloat(sub.net_price_paid).toLocaleString("en-IN")}
                              </td>
                              <td className="table-primary-td table-primary-td-center">{getStatusBadge(sub.status)}</td>
                              <td className="table-primary-td table-primary-td-center">
                                {["ACTIVE", "PAUSED", "FROZEN"].includes(sub.status) && (
                                  <button
                                    onClick={() => handleOpenAdjustModal(sub)}
                                    className="btn btn-primary"
                                  >
                                    <Edit3 size={14} />
                                    Adjust
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Inquiries Tab ─────────────────────────────────────────── */}
          {activeTab === 'inquiries' && (
            <>
              {/* Inquiry toolbar */}
              <div className="search-section">
                <SearchBar
                  onSearch={handleInquirySearch}
                  placeholder="Search by name, email, package…"
                />
                <div className="filter-section">
                  <select
                    className="form-select"
                    value={inquiryStatusFilter}
                    onChange={(e) => handleInquiryStatusFilterChange(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="NEW">New</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="PROCESSED">Processed</option>
                  </select>
                  <button
                    className="btn btn-primary"
                    onClick={handleExportCsv}
                    disabled={exportingCsv}
                    title="Export all inquiries as CSV"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Download size={16} />
                    {exportingCsv ? 'Exporting…' : 'Export CSV'}
                  </button>
                </div>
              </div>

              {/* Loading */}
              {inquiriesLoading && (
                <div className="loading-container">
                  <Loader2 className="spinner" size={48} />
                  <p>Loading inquiries…</p>
                </div>
              )}

              {/* Table */}
              {!inquiriesLoading && (
                <div className="table-primary-container">
                  {filteredInquiries.length === 0 ? (
                    <div className="empty-state">
                      <ClipboardList size={64} className="empty-state-icon" />
                      <p className="empty-state-text">No subscription inquiries found</p>
                    </div>
                  ) : (
                    <div className="table-primary-wrapper">
                      <table className="table-primary">
                        <thead className="table-primary-header">
                          <tr>
                            <th className="table-primary-th table-primary-th-id">ID</th>
                            <th className="table-primary-th">Learner Name</th>
                            <th className="table-primary-th">Email</th>
                            <th className="table-primary-th">Contact</th>
                            <th className="table-primary-th table-primary-th-center">Age</th>
                            <th className="table-primary-th">DOB</th>
                            <th className="table-primary-th">Assessment Date</th>
                            <th className="table-primary-th">Package</th>
                            <th className="table-primary-th table-primary-th-right">Price (₹)</th>
                            <th className="table-primary-th">Payment Method</th>
                            <th className="table-primary-th table-primary-th-center">Receipt</th>
                            <th className="table-primary-th table-primary-th-center">Status</th>
                            <th className="table-primary-th">Submitted</th>
                            <th className="table-primary-th table-primary-th-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="table-primary-body">
                          {filteredInquiries.map((inq) => (
                            <tr key={inq.id} className="table-primary-row">
                              <td className="table-primary-td table-primary-td-id">{inq.id}</td>
                              <td className="table-primary-td">{inq.learner_name}</td>
                              <td className="table-primary-td">{inq.email}</td>
                              <td className="table-primary-td">{inq.contact_number}</td>
                              <td className="table-primary-td table-primary-td-center">{inq.age ?? '—'}</td>
                              <td className="table-primary-td">
                                {inq.date_of_birth ? new Date(inq.date_of_birth).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td className="table-primary-td">
                                {inq.date_of_assessment ? new Date(inq.date_of_assessment).toLocaleDateString('en-IN') : '—'}
                              </td>
                              <td className="table-primary-td">{inq.package_name || '—'}</td>
                              <td className="table-primary-td table-primary-td-right card-price">
                                {inq.package_price ? `₹${parseFloat(inq.package_price).toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td className="table-primary-td">
                                {inq.payment_method === 'UPI' ? '📱 UPI' : inq.payment_method === 'BANK_TRANSFER' ? '🏦 Bank' : '—'}
                              </td>
                              <td className="table-primary-td table-primary-td-center">
                                {inq.payment_receipt_url ? (
                                  <a
                                    href={
                                      inq.payment_receipt_url.startsWith('s3://')
                                        ? `${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/media/s3/${encodeURIComponent(inq.payment_receipt_url.replace(/^s3:\/\/[^/]+\//, ''))}`
                                        : `${(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api').replace('/api', '')}${inq.payment_receipt_url}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                  >
                                    <ExternalLink size={12} /> View
                                  </a>
                                ) : (
                                  <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>No file</span>
                                )}
                              </td>
                              <td className="table-primary-td table-primary-td-center">
                                {getInquiryStatusBadge(inq.review_status)}
                              </td>
                              <td className="table-primary-td" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                {new Date(inq.submitted_at).toLocaleDateString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                })}
                              </td>
                              <td className="table-primary-td table-primary-td-center">
                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                  {inq.review_status === 'NEW' && (
                                    <button
                                      className="btn btn-primary"
                                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                                      disabled={updatingInquiry === inq.id}
                                      onClick={() => handleUpdateInquiryStatus(inq.id, 'REVIEWED')}
                                    >
                                      <CheckCircle size={12} /> Review
                                    </button>
                                  )}
                                  {inq.review_status === 'REVIEWED' && (
                                    <button
                                      className="btn"
                                      style={{
                                        fontSize: '0.72rem', padding: '0.25rem 0.5rem',
                                        background: '#10b981', color: '#fff', border: 'none',
                                        borderRadius: '0.375rem', cursor: 'pointer',
                                      }}
                                      disabled={updatingInquiry === inq.id}
                                      onClick={() => handleUpdateInquiryStatus(inq.id, 'PROCESSED')}
                                    >
                                      ✓ Proceed
                                    </button>
                                  )}
                                  {inq.review_status === 'PROCESSED' && (
                                    <button
                                      className="btn"
                                      style={{
                                        fontSize: '0.72rem', padding: '0.25rem 0.5rem',
                                        background: '#ef4444', color: '#fff', border: 'none',
                                        borderRadius: '0.375rem', cursor: 'pointer',
                                      }}
                                      disabled={updatingInquiry === inq.id}
                                      onClick={() => handleDeleteInquiry(inq.id)}
                                    >
                                      🗑 Delete
                                    </button>
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
              )}
            </>
          )}
        </div>
      </main>

      {/* Adjust Sessions Modal (ADMIN - Unlimited) */}
      {showAdjustModal && (
        <div className="modal-overlay" onClick={handleCloseAdjustModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Sessions (ADMIN)</h2>
              <button onClick={handleCloseAdjustModal} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleAdjustSessions} className="modal-body">
              <div className="info-box">
                <p className="info-text">
                  <strong>Note:</strong> As ADMIN, you can adjust sessions without limits.
                </p>
              </div>

              <div className="form-group">
                <label>Adjustment Type *</label>
                <select
                  value={adjustForm.adjustment_type}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })
                  }
                  required
                >
                  <option value="ADD">Add Sessions</option>
                  <option value="SUBTRACT">Subtract Sessions</option>
                </select>
              </div>

              <div className="form-group">
                <label>Amount *</label>
                <input
                  type="number"
                  value={adjustForm.adjustment_amount}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, adjustment_amount: e.target.value })
                  }
                  min="1"
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
                <small>
                  {adjustForm.reason.length}/10 characters
                </small>
              </div>

              <div className="modal-dates">
                <small>Created: {currentDate}</small>
                <small>Updated: {currentDate}</small>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={handleCloseAdjustModal} className="secondary-button">
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
    </div>
  );
};

export default SubscriptionRecords;
