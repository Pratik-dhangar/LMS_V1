// DiscountCodeManager.jsx - ADMIN discount code management

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Tag,
  Plus,
  Edit3,
  Loader2,
  AlertCircle,
  DollarSign,
  Calendar,
  Users,
  Package,
  Percent,
  CheckCircle,
  XCircle,
  Copy,
  Grid3x3,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import headService from "../../api/services/headService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const DiscountCodeManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [discountCodes, setDiscountCodes] = useState([]);
  const [filteredCodes, setFilteredCodes] = useState([]);
  const [heads, setHeads] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);

  const [createForm, setCreateForm] = useState({
    code: "",
    discount_type: "PERCENTAGE",
    discount_value: "",
    max_uses: "",
    valid_from: "",
    valid_until: "",
    eligibility_criteria: "{}",
    created_by_head_id: "",
  });

  const [bulkForm, setBulkForm] = useState({
    count: "10",
    discount_type: "PERCENTAGE",
    discount_value: "",
    max_uses: "",
    valid_from: "",
    valid_until: "",
    eligibility_criteria: "{}",
    created_by_head_id: "",
  });

  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchData();
  }, []);

  const applyFilter = (codesData, filterType) => {
    if (filterType === "ALL") {
      return codesData;
    } else if (filterType === "ACTIVE") {
      return codesData.filter((code) => code.is_active);
    } else if (filterType === "INACTIVE") {
      return codesData.filter((code) => !code.is_active);
    }
    return codesData;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [codesData, headsData, packagesData] = await Promise.all([
        subscriptionService.getAllDiscountCodes(false), // Fetch ALL codes (both active and inactive)
        headService.getAllHeads(),
        subscriptionService.getAllPackages(true),
      ]);

      const codesArray = Array.isArray(codesData) ? codesData : [];
      setDiscountCodes(codesArray);
      // Apply the current active filter to the new data
      setFilteredCodes(applyFilter(codesArray, activeFilter));
      setHeads(Array.isArray(headsData) ? headsData : []);
      setPackages(Array.isArray(packagesData) ? packagesData : []);
    } catch (err) {
      console.error("Error fetching data:", err);
      // Don't set error - just set empty arrays so we can show friendly message
      setDiscountCodes([]);
      setFilteredCodes([]);
      setHeads([]);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    if (query.trim() === "") {
      setFilteredCodes(discountCodes);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = discountCodes.filter((code) =>
        code.code.toLowerCase().includes(lowerQuery)
      );
      setFilteredCodes(filtered);
    }
  };

  const handleActiveFilter = (filter) => {
    setActiveFilter(filter);
    setFilteredCodes(applyFilter(discountCodes, filter));
  };

  const handleCreateCode = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        code: createForm.code.toUpperCase().trim(),
        discount_type: createForm.discount_type,
        discount_value: parseFloat(createForm.discount_value),
        max_uses: createForm.max_uses ? parseInt(createForm.max_uses) : null,
        valid_from: createForm.valid_from || null,
        valid_until: createForm.valid_until || null,
        eligibility_criteria: JSON.parse(createForm.eligibility_criteria || "{}"),
        created_by_head_id: createForm.created_by_head_id ? parseInt(createForm.created_by_head_id) : null,
      };

      await subscriptionService.createDiscountCode(payload);
      toast.success("Discount code created successfully!");
      setShowCreateModal(false);
      resetCreateForm();
      fetchData();
    } catch (err) {
      console.error("Error creating discount code:", err);
      toast.error(err.response?.data?.detail || "Failed to create discount code");
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        count: parseInt(bulkForm.count),
        discount_type: bulkForm.discount_type,
        discount_value: parseFloat(bulkForm.discount_value),
        max_uses: bulkForm.max_uses ? parseInt(bulkForm.max_uses) : null,
        valid_from: bulkForm.valid_from || null,
        valid_until: bulkForm.valid_until || null,
        eligibility_criteria: JSON.parse(bulkForm.eligibility_criteria || "{}"),
        created_by_head_id: bulkForm.created_by_head_id ? parseInt(bulkForm.created_by_head_id) : null,
      };

      const result = await subscriptionService.bulkCreateDiscountCodes(payload);
      toast.success(`${result.created_count} discount codes created successfully!`);
      setShowBulkModal(false);
      resetBulkForm();
      fetchData();
    } catch (err) {
      console.error("Error bulk creating codes:", err);
      toast.error(err.response?.data?.detail || "Failed to bulk create codes");
    }
  };

  const handleEditCode = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        max_uses: createForm.max_uses ? parseInt(createForm.max_uses) : null,
        valid_from: createForm.valid_from || null,
        valid_until: createForm.valid_until || null,
        is_active: editingCode.is_active,
      };

      await subscriptionService.updateDiscountCode(editingCode.id, payload);
      toast.success("Discount code updated successfully!");
      setShowEditModal(false);
      setEditingCode(null);
      resetCreateForm();
      fetchData();
    } catch (err) {
      console.error("Error updating discount code:", err);
      toast.error(err.response?.data?.detail || "Failed to update discount code");
    }
  };

  const handleToggleActive = async (code) => {
    try {
      await subscriptionService.updateDiscountCode(code.id, {
        is_active: !code.is_active,
      });
      toast.success(`Discount code ${code.is_active ? "deactivated" : "activated"}!`);
      fetchData();
    } catch (err) {
      console.error("Error toggling code status:", err);
      toast.error("Failed to update discount code");
    }
  };

  const handleDeleteCode = async (code) => {
    if (!window.confirm(`Are you sure you want to delete the discount code "${code.code}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await subscriptionService.deleteDiscountCode(code.id);
      toast.success("Discount code deleted successfully!");
      fetchData();
    } catch (err) {
      console.error("Error deleting discount code:", err);
      toast.error(err.response?.data?.detail || "Failed to delete discount code");
    }
  };

  const handleOpenEditModal = (code) => {
    setEditingCode(code);
    setCreateForm({
      code: code.code,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      max_uses: code.max_uses || "",
      valid_from: code.valid_from || "",
      valid_until: code.valid_until || "",
      eligibility_criteria: JSON.stringify(code.eligibility_criteria || {}, null, 2),
      created_by_head_id: code.created_by_head_id || "",
    });
    setShowEditModal(true);
  };

  const resetCreateForm = () => {
    setCreateForm({
      code: "",
      discount_type: "PERCENTAGE",
      discount_value: "",
      max_uses: "",
      valid_from: "",
      valid_until: "",
      eligibility_criteria: "{}",
      created_by_head_id: "",
    });
  };

  const resetBulkForm = () => {
    setBulkForm({
      count: "10",
      discount_type: "PERCENTAGE",
      discount_value: "",
      max_uses: "",
      valid_from: "",
      valid_until: "",
      eligibility_criteria: "{}",
      created_by_head_id: "",
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard!");
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
              <h1 className="page-title">Manage Discount Codes</h1>
              <p className="page-description">
                Create and manage discount codes for subscription packages
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="search-section">
            <SearchBar onSearch={handleSearch} placeholder="Search discount codes..." />
            <div className="filter-section">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                <Plus size={18} />
                Create Code
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="btn btn-secondary"
              >
                <Grid3x3 size={18} />
                Bulk Create
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="filter-section">
            {["ALL", "ACTIVE", "INACTIVE"].map((filter) => (
              <button
                key={filter}
                onClick={() => handleActiveFilter(filter)}
                className={`filter-button ${activeFilter === filter ? 'filter-button-active' : ''}`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <Loader2 className="spinner" size={48} />
              <p>Loading discount codes...</p>
            </div>
          )}

          {/* No Codes State - when database is empty */}
          {!loading && discountCodes.length === 0 && (
            <div className="cards-grid">
              <div className="empty-state">
                <Tag size={64} className="empty-state-icon" />
                <p className="empty-state-text">No codes active now</p>
                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                  <Plus size={18} />
                  Create First Code
                </button>
              </div>
            </div>
          )}

          {/* Discount Codes Grid - Show when codes exist */}
          {!loading && discountCodes.length > 0 && (
            <div className="cards-grid">
              {filteredCodes.length === 0 ? (
                <div className="empty-state">
                  <Tag size={64} className="empty-state-icon" />
                  <p className="empty-state-text">
                    {activeFilter === "ACTIVE"
                      ? "No active codes found"
                      : activeFilter === "INACTIVE"
                        ? "No inactive codes found"
                        : "No codes found matching your search"}
                  </p>
                  <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                    <Plus size={18} />
                    Create Code
                  </button>
                </div>
              ) : (
                filteredCodes.map((code) => (
                  <div
                    key={code.id}
                    className={`discount-card ${!code.is_active ? 'discount-card-inactive' : ''}`}
                  >
                    {!code.is_active && (
                      <div className="badge badge-inactive">
                        INACTIVE
                      </div>
                    )}

                    {/* Code Header */}
                    <div className="discount-code-header">
                      <div className="discount-code-row">
                        <h3 className="discount-code-text">
                          {code.code}
                        </h3>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="discount-code-copy-btn"
                          title="Copy code"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Discount Info */}
                    <div className="discount-value-box">
                      <div className="discount-value-content">
                        {code.discount_type === "PERCENTAGE" ? (
                          <>
                            <Percent size={24} className="discount-value-icon" />
                            <span className="discount-value-text">
                              {code.discount_value}% OFF
                            </span>
                          </>
                        ) : (
                          <>
                            <DollarSign size={24} className="discount-value-icon" />
                            <span className="discount-value-text">
                              ₹{code.discount_value} OFF
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="discount-details">
                      <div className="discount-detail-row">
                        <span className="discount-detail-label">Uses:</span>
                        <span className="discount-detail-value">
                          {code.times_used} / {code.max_uses || "Unlimited"}
                        </span>
                      </div>

                      {code.valid_from && (
                        <div className="discount-detail-row">
                          <span className="discount-detail-label">Valid From:</span>
                          <span className="discount-detail-value">
                            {new Date(code.valid_from).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {code.valid_until && (
                        <div className="discount-detail-row">
                          <span className="discount-detail-label">Valid Until:</span>
                          <span className="discount-detail-value">
                            {new Date(code.valid_until).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {code.created_by_head_name && (
                        <div className="discount-detail-row">
                          <span className="discount-detail-label">Created By:</span>
                          <span className="discount-detail-value">
                            {code.created_by_head_name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="card-actions">
                      <button
                        onClick={() => handleOpenEditModal(code)}
                        className="btn btn-primary btn-flex-1"
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(code)}
                        className={`btn ${code.is_active ? 'btn-danger' : 'btn-success'} btn-flex-1`}
                      >
                        {code.is_active ? (
                          <>
                            <XCircle size={16} />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            Activate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code)}
                        className="btn btn-danger btn-flex-1"
                        title="Delete this discount code"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create Code Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Discount Code</h2>
              <button onClick={() => setShowCreateModal(false)} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCode} className="modal-body">
              <div className="form-group">
                <label>Discount Code *</label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., SAVE20"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                <div className="form-group">
                  <label>Discount Type *</label>
                  <select
                    value={createForm.discount_type}
                    onChange={(e) => setCreateForm({ ...createForm, discount_type: e.target.value })}
                    required
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    value={createForm.discount_value}
                    onChange={(e) => setCreateForm({ ...createForm, discount_value: e.target.value })}
                    placeholder={createForm.discount_type === "PERCENTAGE" ? "e.g., 20" : "e.g., 500"}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Max Uses (Optional)</label>
                <input
                  type="number"
                  value={createForm.max_uses}
                  onChange={(e) => setCreateForm({ ...createForm, max_uses: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valid From (Optional)</label>
                  <input
                    type="date"
                    value={createForm.valid_from}
                    onChange={(e) => setCreateForm({ ...createForm, valid_from: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Valid Until (Optional)</label>
                  <input
                    type="date"
                    value={createForm.valid_until}
                    onChange={(e) => setCreateForm({ ...createForm, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Created By HEAD (Optional)</label>
                <select
                  value={createForm.created_by_head_id}
                  onChange={(e) => setCreateForm({ ...createForm, created_by_head_id: e.target.value })}
                >
                  <option value="">None (Platform-wide)</option>
                  {heads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowCreateModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Create Discount Codes</h2>
              <button onClick={() => setShowBulkModal(false)} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleBulkCreate} className="modal-body">
              <div className="info-box">
                <p className="info-text">
                  <strong>Note:</strong> Codes will be auto-generated with format: DISC_XXXXXXXX
                </p>
              </div>

              <div className="form-group">
                <label>Number of Codes *</label>
                <input
                  type="number"
                  value={bulkForm.count}
                  onChange={(e) => setBulkForm({ ...bulkForm, count: e.target.value })}
                  min="1"
                  max="100"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Discount Type *</label>
                  <select
                    value={bulkForm.discount_type}
                    onChange={(e) => setBulkForm({ ...bulkForm, discount_type: e.target.value })}
                    required
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed Amount</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Discount Value *</label>
                  <input
                    type="number"
                    value={bulkForm.discount_value}
                    onChange={(e) => setBulkForm({ ...bulkForm, discount_value: e.target.value })}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Max Uses Per Code (Optional)</label>
                <input
                  type="number"
                  value={bulkForm.max_uses}
                  onChange={(e) => setBulkForm({ ...bulkForm, max_uses: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valid From (Optional)</label>
                  <input
                    type="date"
                    value={bulkForm.valid_from}
                    onChange={(e) => setBulkForm({ ...bulkForm, valid_from: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Valid Until (Optional)</label>
                  <input
                    type="date"
                    value={bulkForm.valid_until}
                    onChange={(e) => setBulkForm({ ...bulkForm, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Created By HEAD (Optional)</label>
                <select
                  value={bulkForm.created_by_head_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, created_by_head_id: e.target.value })}
                >
                  <option value="">None (Platform-wide)</option>
                  {heads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowBulkModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Create {bulkForm.count} Codes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Code Modal */}
      {showEditModal && editingCode && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Discount Code</h2>
              <button onClick={() => setShowEditModal(false)} className="modal-close">
                ×
              </button>
            </div>

            <form onSubmit={handleEditCode} className="modal-body">
              <div className="summary-box">
                <p className="discount-detail-label">Code</p>
                <p className="discount-code-text">
                  {editingCode.code}
                </p>
                <p className="discount-detail-label" style={{ marginTop: "8px" }}>
                  {editingCode.discount_type === "PERCENTAGE" ? (
                    <span>{editingCode.discount_value}% OFF</span>
                  ) : (
                    <span>₹{editingCode.discount_value} OFF</span>
                  )}
                </p>
              </div>

              <div className="form-group">
                <label>Max Uses</label>
                <input
                  type="number"
                  value={createForm.max_uses}
                  onChange={(e) => setCreateForm({ ...createForm, max_uses: e.target.value })}
                  placeholder="Leave empty for unlimited"
                  min="1"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Valid From</label>
                  <input
                    type="date"
                    value={createForm.valid_from}
                    onChange={(e) => setCreateForm({ ...createForm, valid_from: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Valid Until</label>
                  <input
                    type="date"
                    value={createForm.valid_until}
                    onChange={(e) => setCreateForm({ ...createForm, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="secondary-button">
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Update Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountCodeManager;
