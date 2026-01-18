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
  Edit3
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import headService from "../../api/services/headService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const SubscriptionRecords = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subscriptions, setSubscriptions] = useState([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([]);
  const [heads, setHeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState("");

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
              <h1 className="page-title">Subscription Records & Analytics</h1>
              <p className="page-description">
                View all subscription records and analyze revenue trends
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="stats-grid">
              <div className="stat-card stat-card-active">
                <div className="stat-card-content">
                  <Users size={24} className="stat-card-icon stat-card-icon-active" />
                  <div>
                    <p className="stat-card-value stat-card-value-active">
                      {stats.total_active}
                    </p>
                    <p className="stat-card-label stat-card-label-active">Active Subscriptions</p>
                  </div>
                </div>
              </div>

              <div className="stat-card stat-card-total">
                <div className="stat-card-content">
                  <Package size={24} className="stat-card-icon stat-card-icon-total" />
                  <div>
                    <p className="stat-card-value stat-card-value-total">
                      {stats.total_subscriptions}
                    </p>
                    <p className="stat-card-label stat-card-label-total">Total Subscriptions</p>
                  </div>
                </div>
              </div>

              <div className="stat-card stat-card-revenue">
                <div className="stat-card-content">
                  <TrendingUp size={24} className="stat-card-icon stat-card-icon-revenue" />
                  <div>
                    <p className="stat-card-value stat-card-value-revenue">
                      ₹{parseFloat(stats.total_revenue || 0).toLocaleString("en-IN")}
                    </p>
                    <p className="stat-card-label stat-card-label-revenue">Total Revenue</p>
                  </div>
                </div>
              </div>

              <div className="stat-card stat-card-expired">
                <div className="stat-card-content">
                  <AlertCircle size={24} className="stat-card-icon stat-card-icon-expired" />
                  <div>
                    <p className="stat-card-value stat-card-value-expired">
                      {stats.total_expired}
                    </p>
                    <p className="stat-card-label stat-card-label-expired">Expired Subscriptions</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Analytics Section */}
          <div className="analytics-section">
            <div className="analytics-header">
              <h3 className="analytics-title">
                <BarChart3 size={24} />
                Revenue by HEAD
              </h3>
              <div className="analytics-filters">
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                />
              </div>
            </div>

            {revenueData.length > 0 ? (
              <div className="table-primary-container">
                <div className="table-primary-wrapper">
                  <table className="table-primary">
                    <thead className="table-primary-header">
                      <tr>
                        <th className="table-primary-th">HEAD Name</th>
                        <th className="table-primary-th table-primary-th-center">Subscriptions Count</th>
                        <th className="table-primary-th table-primary-th-right">Total Revenue</th>
                        <th className="table-primary-th table-primary-th-right">Average Price</th>
                      </tr>
                    </thead>
                    <tbody className="table-primary-body">
                      {revenueData.map((item, index) => (
                        <tr key={index} className="table-primary-row">
                          <td className="table-primary-td">{item.head_name}</td>
                          <td className="table-primary-td table-primary-td-center">{item.subscription_count}</td>
                          <td className="table-primary-td table-primary-td-right card-price">
                            ₹{parseFloat(item.total_revenue).toLocaleString("en-IN")}
                          </td>
                          <td className="table-primary-td table-primary-td-right">₹{parseFloat(item.average_price).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="analytics-empty">
                Select date range to view revenue analytics
              </p>
            )}
          </div>

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
                <option value="FROZEN">Frozen</option>
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
