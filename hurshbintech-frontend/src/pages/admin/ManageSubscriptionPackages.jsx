// ManageSubscriptionPackages.jsx - Manage subscription packages for ADMIN

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Package, Plus, Edit3, Trash2, AlertCircle, Loader2, DollarSign, Calendar, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import subscriptionService from "../../api/services/subscriptionService";
import SearchBar from "../../components/common/SearchBar";
import "../../styles/Table.css";
import "../../styles/ManageUsersLayout.css";
import "../../styles/Subscription.css";

const ManageSubscriptionPackages = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [packages, setPackages] = useState([]);
    const [filteredPackages, setFilteredPackages] = useState([]);
    const [activeTab, setActiveTab] = useState("learner");
    const [expandedDescriptions, setExpandedDescriptions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        package_name: "",
        description: "",
        sessions_count: "",
        validity_days: "",
        price: "",
        package_type: "LEARNER",
    });

    useEffect(() => {
        fetchPackages();
    }, []);

    // Re-apply filters whenever packages, activeTab, or searchQuery changes
    useEffect(() => {
        applyFilters(packages, activeTab, searchQuery);
    }, [packages, activeTab, searchQuery]);

    const applyFilters = (allPackages, tab, query) => {
        let filtered = allPackages.filter(
            (pkg) => pkg.package_type === (tab === "learner" ? "LEARNER" : "COACH")
        );
        if (query.trim()) {
            const lower = query.toLowerCase();
            filtered = filtered.filter(
                (pkg) =>
                    pkg.package_name.toLowerCase().includes(lower) ||
                    pkg.description?.toLowerCase().includes(lower)
            );
        }
        setFilteredPackages(filtered);
    };

    const fetchPackages = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await subscriptionService.getAllPackages();
            setPackages(data);
        } catch (err) {
            console.error("Error fetching packages:", err);
            setError("Failed to load packages. Please try again.");
            toast.error("Failed to load packages", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    const handleOpenModal = (pkg = null) => {
        if (pkg) {
            setEditingPackage(pkg);
            setFormData({
                package_name: pkg.package_name,
                description: pkg.description || "",
                sessions_count: pkg.sessions_count,
                validity_days: pkg.validity_days,
                price: pkg.price,
                package_type: pkg.package_type || "LEARNER",
            });
        } else {
            setEditingPackage(null);
            const isCoach = activeTab === "coach";
            setFormData({
                package_name: "",
                description: "",
                sessions_count: isCoach ? 1 : "",
                validity_days: isCoach ? 1 : "",
                price: "",
                package_type: isCoach ? "COACH" : "LEARNER",
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingPackage(null);
        setFormData({
            package_name: "",
            description: "",
            sessions_count: "",
            validity_days: "",
            price: "",
            package_type: activeTab === "learner" ? "LEARNER" : "COACH",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.package_name.trim()) {
            toast.error("Package name is required");
            return;
        }
        if (!formData.sessions_count || formData.sessions_count <= 0) {
            toast.error("Sessions count must be greater than 0");
            return;
        }
        if (!formData.validity_days || formData.validity_days <= 0) {
            toast.error("Validity days must be greater than 0");
            return;
        }
        if (!formData.price || formData.price < 0) {
            toast.error("Price must be 0 or greater");
            return;
        }

        try {
            const isCoach = formData.package_type === "COACH";
            const packageData = {
                package_name: formData.package_name.trim(),
                description: formData.description.trim() || null,
                sessions_count: isCoach ? 1 : parseInt(formData.sessions_count),
                validity_days: isCoach ? 1 : parseInt(formData.validity_days),
                price: parseFloat(formData.price),
                package_type: formData.package_type,
            };

            if (editingPackage) {
                await subscriptionService.updatePackage(editingPackage.id, packageData);
                toast.success("Package updated successfully!");
            } else {
                await subscriptionService.createPackage(packageData);
                toast.success("Package created successfully!");
            }

            handleCloseModal();
            fetchPackages();
        } catch (err) {
            console.error("Error saving package:", err);
            toast.error(err.response?.data?.detail || "Failed to save package");
        }
    };

    const handleDelete = async (packageId, packageName) => {
        if (!window.confirm(`Are you sure you want to delete "${packageName}"?\n\nNote: If no subscriptions exist for this package, it will be permanently deleted. Otherwise, it will be deactivated.`)) {
            return;
        }

        try {
            await subscriptionService.deletePackage(packageId);
            toast.success("Package deleted successfully!");
            fetchPackages();
        } catch (err) {
            console.error("Error deleting package:", err);
            toast.error(err.response?.data?.detail || "Failed to delete package");
        }
    };

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
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

                        <div>
                            <h1 className="page-title">Manage Learning Packages</h1>
                            <p className="page-description">
                                Create and manage subscription packages for learners
                            </p>
                        </div>
                    </div>



                    {/* Search Bar and Actions */}
                    <div className="search-section">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search packages by name or description..."
                        />
                        <div className="filter-section">
                            <button
                                onClick={() => handleOpenModal()}
                                className="btn-primary"
                            >
                                <Plus size={18} />
                                Create Package
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="loading-container">
                            <Loader2 className="spinner" size={48} />
                            <p>Loading packages...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="error-container">
                            <AlertCircle size={48} />
                            <p>{error}</p>
                            <button onClick={fetchPackages} className="retry-button">
                                Retry
                            </button>
                        </div>
                    )}
                    {/* Package Type Tabs */}
                    <div style={{ display: "flex", justifyContent: "center", gap: "0", marginBottom: "1.5rem" }}>
                        <button
                            onClick={() => handleTabChange("learner")}
                            style={{
                                padding: "0.6rem 2rem",
                                fontWeight: 600,
                                fontSize: "0.95rem",
                                borderRadius: "8px 0 0 8px",
                                border: "2px solid #7c1a1a",
                                cursor: "pointer",
                                background: activeTab === "learner" ? "#7c1a1a" : "#fff",
                                color: activeTab === "learner" ? "#fff" : "#7c1a1a",
                                transition: "all 0.2s",
                            }}
                        >
                            Learner Packages
                        </button>
                        <button
                            onClick={() => handleTabChange("coach")}
                            style={{
                                padding: "0.6rem 2rem",
                                fontWeight: 600,
                                fontSize: "0.95rem",
                                borderRadius: "0 8px 8px 0",
                                border: "2px solid #7c1a1a",
                                borderLeft: "none",
                                cursor: "pointer",
                                background: activeTab === "coach" ? "#7c1a1a" : "#fff",
                                color: activeTab === "coach" ? "#fff" : "#7c1a1a",
                                transition: "all 0.2s",
                            }}
                        >
                            Coach Packages
                        </button>
                    </div>

                    {/* Packages Table */}
                    {!loading && !error && (
                        <>
                            {filteredPackages.length === 0 ? (
                                <div className="table-primary-container">
                                    <div className="table-primary-empty">
                                        <Package size={48} className="table-primary-empty-icon" />
                                        <p className="table-primary-empty-text">No {activeTab === "learner" ? "learner" : "coach"} packages found</p>
                                        <button onClick={() => handleOpenModal()} className="btn-primary">
                                            <Plus size={18} />
                                            Create Your First {activeTab === "learner" ? "Learner" : "Coach"} Package
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="table-primary-container">
                                    <div className="table-primary-wrapper">
                                        <table className="table-primary">
                                            <thead className="table-primary-header">
                                                <tr>
                                                    <th className="table-primary-th table-primary-th-id">ID</th>
                                                    <th className="table-primary-th">Package Name</th>
                                                    <th className="table-primary-th">Description</th>
                                                    <th className="table-primary-th table-primary-th-center">Sessions</th>
                                                    <th className="table-primary-th table-primary-th-center">Validity (Days)</th>
                                                    <th className="table-primary-th table-primary-th-right">Price (₹)</th>
                                                    <th className="table-primary-th table-primary-th-center">Created</th>
                                                    <th className="table-primary-th table-primary-th-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="table-primary-body">
                                                {filteredPackages.map((pkg) => (
                                                    <tr key={pkg.id} className="table-primary-row">
                                                        <td className="table-primary-td table-primary-td-id">
                                                            <span className="table-primary-badge table-primary-badge-info">#{pkg.id}</span>
                                                        </td>
                                                        <td className="table-primary-td">
                                                            <div className="table-primary-cell-name">
                                                                <span className="table-primary-cell-name-text">{pkg.package_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="table-primary-td" style={{ maxWidth: "220px" }}>
                                                            {pkg.description ? (
                                                                <span className="table-primary-cell-subtitle">
                                                                    {expandedDescriptions[pkg.id]
                                                                        ? pkg.description
                                                                        : pkg.description.length > 60
                                                                            ? pkg.description.slice(0, 60) + "…"
                                                                            : pkg.description
                                                                    }
                                                                    {pkg.description.length > 60 && (
                                                                        <>
                                                                            <br />
                                                                            <button
                                                                                onClick={() => setExpandedDescriptions((prev) => ({ ...prev, [pkg.id]: !prev[pkg.id] }))}
                                                                                style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", padding: 0, fontSize: "0.8rem", fontWeight: 600 }}
                                                                            >
                                                                                {expandedDescriptions[pkg.id] ? "Read less" : "Read more"}
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </span>
                                                            ) : (
                                                                <span className="table-primary-cell-subtitle">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <strong>{pkg.sessions_count}</strong>
                                                        </td>
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <strong>{pkg.validity_days}</strong>
                                                        </td>
                                                        <td className="table-primary-td table-primary-td-right">
                                                            <strong>₹{parseFloat(pkg.price).toLocaleString('en-IN')}</strong>
                                                        </td>
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <span className="table-primary-cell-subtitle">
                                                                {new Date(pkg.created_at).toLocaleDateString()}
                                                            </span>
                                                        </td>
                                                        <td className="table-primary-td table-primary-td-center">
                                                            <div className="table-primary-actions">
                                                                <button
                                                                    onClick={() => handleOpenModal(pkg)}
                                                                    className="table-primary-icon-btn"
                                                                    title="Edit Package"
                                                                >
                                                                    <Edit3 size={16} className="table-primary-icon-sm" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(pkg.id, pkg.package_name)}
                                                                    className="table-primary-icon-btn"
                                                                    title="Delete Package"
                                                                    style={{
                                                                        borderColor: '#ef4444',
                                                                        color: '#ef4444',
                                                                        background: '#fef2f2'
                                                                    }}
                                                                >
                                                                    <Trash2 size={16} className="table-primary-icon-sm" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Create/Edit Package Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingPackage ? `Edit ${editingPackage.package_type === "COACH" ? "Coach" : "Learner"} Package` : `Create New ${formData.package_type === "COACH" ? "Coach" : "Learner"} Package`}</h2>
                            <button onClick={handleCloseModal} className="modal-close">×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-body">
                            <div className="form-group">
                                <label htmlFor="package_name">Package Name *</label>
                                <input
                                    type="text"
                                    id="package_name"
                                    value={formData.package_name}
                                    onChange={(e) => setFormData({ ...formData, package_name: e.target.value })}
                                    placeholder="e.g., Basic Package, Premium Package"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="description">Description</label>
                                <textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Package description (optional)"
                                    rows="3"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="sessions_count">Sessions Count *</label>
                                    <input
                                        type="number"
                                        id="sessions_count"
                                        value={formData.package_type === "COACH" ? 1 : formData.sessions_count}
                                        onChange={(e) => formData.package_type !== "COACH" && setFormData({ ...formData, sessions_count: e.target.value })}
                                        placeholder="e.g., 10"
                                        min="1"
                                        required
                                        readOnly={formData.package_type === "COACH"}
                                        style={formData.package_type === "COACH" ? { background: "#f3f4f6", cursor: "not-allowed", color: "#6b7280" } : {}}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="validity_days">Validity (Days) *</label>
                                    <input
                                        type="number"
                                        id="validity_days"
                                        value={formData.package_type === "COACH" ? 1 : formData.validity_days}
                                        onChange={(e) => formData.package_type !== "COACH" && setFormData({ ...formData, validity_days: e.target.value })}
                                        placeholder="e.g., 30"
                                        min="1"
                                        required
                                        readOnly={formData.package_type === "COACH"}
                                        style={formData.package_type === "COACH" ? { background: "#f3f4f6", cursor: "not-allowed", color: "#6b7280" } : {}}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="price">Price (₹) *</label>
                                <input
                                    type="number"
                                    id="price"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    placeholder="e.g., 5000"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="package_type">Package Type *</label>
                                <select
                                    id="package_type"
                                    value={formData.package_type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setFormData({
                                            ...formData,
                                            package_type: type,
                                            sessions_count: type === "COACH" ? 1 : (formData.package_type === "COACH" ? "" : formData.sessions_count),
                                            validity_days: type === "COACH" ? 1 : (formData.package_type === "COACH" ? "" : formData.validity_days),
                                        });
                                    }}
                                    required
                                >
                                    <option value="LEARNER">Learner Package</option>
                                    <option value="COACH">Coach Package</option>
                                </select>
                            </div>

                            <div className="modal-footer">
                                <button type="button" onClick={handleCloseModal} className="secondary-button">
                                    Cancel
                                </button>
                                <button type="submit" className="primary-button">
                                    {editingPackage ? 'Update Package' : 'Create Package'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageSubscriptionPackages;
