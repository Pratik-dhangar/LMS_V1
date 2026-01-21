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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        package_name: "",
        description: "",
        sessions_count: "",
        validity_days: "",
        price: "",
    });

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await subscriptionService.getAllPackages();
            setPackages(data);
            setFilteredPackages(data);
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
        if (query.trim() === "") {
            setFilteredPackages(packages);
        } else {
            const lowerQuery = query.toLowerCase();
            const filtered = packages.filter(
                (pkg) =>
                    pkg.package_name.toLowerCase().includes(lowerQuery) ||
                    pkg.description?.toLowerCase().includes(lowerQuery)
            );
            setFilteredPackages(filtered);
        }
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
            });
        } else {
            setEditingPackage(null);
            setFormData({
                package_name: "",
                description: "",
                sessions_count: "",
                validity_days: "",
                price: "",
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
            const packageData = {
                package_name: formData.package_name.trim(),
                description: formData.description.trim() || null,
                sessions_count: parseInt(formData.sessions_count),
                validity_days: parseInt(formData.validity_days),
                price: parseFloat(formData.price),
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
                            <h1 className="page-title">Manage Subscription Packages</h1>
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

                    {/* Packages Table */}
                    {!loading && !error && (
                        <>
                            {filteredPackages.length === 0 ? (
                                <div className="table-primary-container">
                                    <div className="table-primary-empty">
                                        <Package size={48} className="table-primary-empty-icon" />
                                        <p className="table-primary-empty-text">No packages found</p>
                                        <button onClick={() => handleOpenModal()} className="btn-primary">
                                            <Plus size={18} />
                                            Create Your First Package
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
                                                        <td className="table-primary-td">
                                                            <span className="table-primary-cell-subtitle">
                                                                {pkg.description || 'N/A'}
                                                            </span>
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
                            <h2>{editingPackage ? 'Edit Package' : 'Create New Package'}</h2>
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
                                        value={formData.sessions_count}
                                        onChange={(e) => setFormData({ ...formData, sessions_count: e.target.value })}
                                        placeholder="e.g., 10"
                                        min="1"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="validity_days">Validity (Days) *</label>
                                    <input
                                        type="number"
                                        id="validity_days"
                                        value={formData.validity_days}
                                        onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                                        placeholder="e.g., 30"
                                        min="1"
                                        required
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
