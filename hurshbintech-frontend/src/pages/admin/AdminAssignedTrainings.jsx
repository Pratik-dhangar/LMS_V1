// AdminAssignedTrainings.jsx - Full CRUD management of assigned trainings for admins

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Plus, AlertCircle, Loader2, Search, X, File } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import AssignedTrainingCard from "../../components/AssignedTrainingCard";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/Pages.css";
import "../../styles/admin/AdminAssignedTrainings.css";

const AdminAssignedTrainings = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // List Management
    const [trainings, setTrainings] = useState([]);
    const [filteredTrainings, setFilteredTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [pagination, setPagination] = useState({ skip: 0, limit: 10, total: 0 });

    // Form Management
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        training_files: [],
        training_ref_ids: [],
        target_roles: ["all"],
        active: true,
    });
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const trainingFilesInputRef = React.useRef(null);

    const AVAILABLE_ROLES = [
        { value: "all", label: "All Users" },
        { value: "admin", label: "Admin" },
        { value: "head", label: "Head" },
        { value: "coach", label: "Coach" },
        { value: "trainer", label: "Trainer" },
        { value: "learner", label: "Learner" },
    ];

    // Fetch trainings
    useEffect(() => {
        fetchTrainings();
    }, [pagination.skip]);

    const fetchTrainings = async () => {
        try {
            setLoading(true);
            setError("");
            const data = await assignedTrainingService.adminGetList({
                skip: pagination.skip,
                limit: pagination.limit,
            });
            setTrainings(data.items || []);
            setFilteredTrainings(data.items || []);
            setPagination((prev) => ({ ...prev, total: data.total || 0 }));
        } catch (err) {
            console.error("Error fetching trainings:", err);
            setError("Failed to load trainings. Please try again.");
            toast.error("Failed to load trainings", {
                position: "top-center",
                autoClose: 3000,
            });
        } finally {
            setLoading(false);
        }
    };

    // Search handler
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (query.trim() === "") {
            setFilteredTrainings(trainings);
        } else {
            const lowerQuery = query.toLowerCase();
            const filtered = trainings.filter(
                (training) =>
                    training.title.toLowerCase().includes(lowerQuery) ||
                    (training.description &&
                        training.description.toLowerCase().includes(lowerQuery))
            );
            setFilteredTrainings(filtered);
        }
    };

    // Form handlers
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        // Clear error for this field
        if (formErrors[name]) {
            setFormErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };
    const handleTrainingFileChange = (e) => {
        const files = Array.from(e.target.files || []);

        // Validate file sizes
        const validFiles = files.filter(file => {
            if (file.size > 100 * 1024 * 1024) {
                toast.error(`${file.name} is too large. Max size is 100MB`);
                return false;
            }
            return true;
        });

        setTrainingFiles(prev => [...prev, ...validFiles]);
        setFormData(prev => ({
            ...prev,
            training_files: [...prev.training_files, ...validFiles.map(f => f.name)]
        }));

        // Clear error for this field
        if (formErrors.training_files) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.training_files;
                return newErrors;
            });
        }
    };

    const removeTrainingFile = (index) => {
        setTrainingFiles(prev => prev.filter((_, i) => i !== index));
        setFormData(prev => ({
            ...prev,
            training_files: prev.training_files.filter((_, i) => i !== index)
        }));
    };
    const handleRoleToggle = (role) => {
        setFormData((prev) => {
            const roles = prev.target_roles;
            if (role === "all") {
                // If clicking "all", toggle between ["all"] and []
                return {
                    ...prev,
                    target_roles: roles.includes("all") ? [] : ["all"],
                };
            } else {
                // Remove "all" if adding specific role
                let newRoles = roles.filter((r) => r !== "all");
                if (roles.includes(role)) {
                    newRoles = newRoles.filter((r) => r !== role);
                } else {
                    newRoles.push(role);
                }
                return { ...prev, target_roles: newRoles };
            }
        });
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.title.trim()) errors.title = "Title is required";
        if (!formData.description.trim()) errors.description = "Description is required";
        if (trainingFiles.length === 0) {
            errors.training_files = "At least one file is required";
        }
        if (formData.target_roles.length === 0) {
            errors.target_roles = "Select at least one role";
        }
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        try {
            setSubmitting(true);
            const payload = { ...formData };

            if (editingId) {
                await assignedTrainingService.adminUpdate(editingId, payload);
                toast.success("Training updated successfully", {
                    position: "top-center",
                    autoClose: 3000,
                });
            } else {
                await assignedTrainingService.adminCreate(payload);
                toast.success("Training created successfully", {
                    position: "top-center",
                    autoClose: 3000,
                });
            }

            resetForm();
            setShowForm(false);
            fetchTrainings();
        } catch (err) {
            console.error("Error submitting form:", err);
            toast.error(
                err.response?.data?.detail || "Failed to save training",
                {
                    position: "top-center",
                    autoClose: 3000,
                }
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = async (trainingId) => {
        navigate(`/admin/assigned-trainings/${trainingId}/edit`);
    };

    const handleDelete = async (trainingId) => {
        try {
            await assignedTrainingService.adminDelete(trainingId);
            toast.success("Training deleted successfully", {
                position: "top-center",
                autoClose: 3000,
            });
            fetchTrainings();
        } catch (err) {
            console.error("Error deleting training:", err);
            toast.error("Failed to delete training", {
                position: "top-center",
                autoClose: 3000,
            });
        }
    };

    const resetForm = () => {
        setFormData({
            title: "",
            description: "",
            training_files: [],
            training_ref_ids: [],
            target_roles: ["all"],
            active: true,
        });
        setTrainingFiles([]);
        setFormErrors({});
        setEditingId(null);
    };

    const handleCloseForm = () => {
        resetForm();
        setShowForm(false);
    };

    const handleView = (trainingId) => {
        // Navigate to detail view or open modal
        navigate(`/admin/assigned-trainings/${trainingId}`);
    };

    return (
        <div className="page-container">
            <Navbar />
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
                            <h1 className="page-title">Internal Training Management</h1>
                            <p className="page-description">
                                Create and manage training assignments for different roles
                            </p>
                        </div>
                    </div>

                    {/* Search and Create */}
                    <div className="search-section">
                        <div className="search-bar-wrapper">
                            <Search size={20} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by training title..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <button
                            onClick={() => navigate('/admin/assigned-trainings/create')}
                            className="btn-success"
                        >
                            <Plus size={18} />
                            Create Training
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="icon-md error-icon" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner" />
                            <p className="loading-text">Loading trainings...</p>
                        </div>
                    ) : (
                        <>
                            {/* Training Cards Grid */}
                            <div className="trainings-grid">
                                {filteredTrainings.length === 0 ? (
                                    <div className="empty-state">
                                        <AlertCircle className="empty-state-icon" />
                                        <h3 className="empty-state-title">
                                            {searchQuery
                                                ? "No trainings found"
                                                : "No trainings created yet"}
                                        </h3>
                                        <p className="empty-state-description">
                                            {searchQuery
                                                ? "Try adjusting your search criteria"
                                                : "Create your first training assignment"}
                                        </p>
                                        {!searchQuery && (
                                            <button
                                                onClick={() => setShowForm(true)}
                                                className="btn-success"
                                            >
                                                <Plus size={18} />
                                                Create Training
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    filteredTrainings.map((training) => (
                                        <AssignedTrainingCard
                                            key={training.id}
                                            training={training}
                                            isAdmin={true}
                                            onView={handleView}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Pagination */}
                            {filteredTrainings.length > 0 && (
                                <div className="pagination-section">
                                    <button
                                        disabled={pagination.skip === 0}
                                        onClick={() =>
                                            setPagination((prev) => ({
                                                ...prev,
                                                skip: Math.max(0, prev.skip - prev.limit),
                                            }))
                                        }
                                        className="pagination-btn"
                                    >
                                        Previous
                                    </button>
                                    <span className="pagination-info">
                                        Showing {pagination.skip + 1} to{" "}
                                        {Math.min(
                                            pagination.skip + pagination.limit,
                                            pagination.total
                                        )}{" "}
                                        of {pagination.total}
                                    </span>
                                    <button
                                        disabled={
                                            pagination.skip + pagination.limit >= pagination.total
                                        }
                                        onClick={() =>
                                            setPagination((prev) => ({
                                                ...prev,
                                                skip: prev.skip + prev.limit,
                                            }))
                                        }
                                        className="pagination-btn"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Create/Edit Form Modal */}
            {showForm && (
                <div className="form-modal-overlay">
                    <div className="form-modal">
                        <div className="form-modal-header">
                            <h2>{editingId ? "Edit Training" : "Create New Training"}</h2>
                            <button onClick={handleCloseForm} className="form-modal-close">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="training-form">
                            {/* Title */}
                            <div className="form-group">
                                <label htmlFor="title" className="form-label">
                                    Training Title *
                                </label>
                                <input
                                    id="title"
                                    name="title"
                                    type="text"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Quarterly Safety Training"
                                    className={`form-input ${formErrors.title ? "error" : ""}`}
                                />
                                {formErrors.title && (
                                    <span className="form-error">{formErrors.title}</span>
                                )}
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label htmlFor="description" className="form-label">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief description of the training..."
                                    rows="3"
                                    className="form-textarea"
                                />
                            </div>


                            {/* Custom Content */}
                            <div className="form-group">
                                <label className="form-label">
                                    Training Files *
                                </label>
                                <p className="section-description">
                                    Upload documents, videos, images, PDFs, or any other files
                                </p>

                                {trainingFiles.length > 0 && (
                                    <div className="files-list">
                                        <h4>Uploaded Files ({trainingFiles.length})</h4>
                                        {trainingFiles.map((file, index) => (
                                            <div key={index} className="file-item">
                                                <File size={18} className="file-icon" />
                                                <div className="file-info">
                                                    <p className="file-name">{file.name}</p>
                                                    <p className="file-size">
                                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTrainingFile(index)}
                                                    className="remove-file-btn"
                                                    title="Remove file"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div
                                    className="file-upload-box"
                                    onClick={() => trainingFilesInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.style.borderColor = '#3b82f6';
                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                    }}
                                    onDragLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#d1d5db';
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.currentTarget.style.borderColor = '#d1d5db';
                                        e.currentTarget.style.backgroundColor = '#f9fafb';
                                        const files = Array.from(e.dataTransfer.files || []);
                                        if (files.length > 0) {
                                            const event = { target: { files: e.dataTransfer.files } };
                                            handleTrainingFileChange(event);
                                        }
                                    }}
                                >
                                    <Upload size={32} />
                                    <p>Click to upload or drag and drop</p>
                                    <span className="file-help-text">
                                        Documents, Videos, Images, PDFs, or any format. Max 100MB per file
                                    </span>
                                </div>
                                <input
                                    ref={trainingFilesInputRef}
                                    type="file"
                                    id="training-files"
                                    multiple
                                    onChange={handleTrainingFileChange}
                                    className="file-input"
                                />
                                {formErrors.training_files && (
                                    <span className="form-error">{formErrors.training_files}</span>
                                )}
                            </div>

                            {/* Target Roles */}
                            <div className="form-group">
                                <label className="form-label">Target Roles *</label>
                                <div className="roles-grid">
                                    {AVAILABLE_ROLES.map((role) => (
                                        <label key={role.value} className="role-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={formData.target_roles.includes(role.value)}
                                                onChange={() => handleRoleToggle(role.value)}
                                            />
                                            <span>{role.label}</span>
                                        </label>
                                    ))}
                                </div>
                                {formErrors.target_roles && (
                                    <span className="form-error">{formErrors.target_roles}</span>
                                )}
                            </div>


                            {/* Active Toggle */}
                            <div className="form-group form-group-checkbox">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="active"
                                        checked={formData.active}
                                        onChange={handleInputChange}
                                    />
                                    <span>Active Training</span>
                                </label>
                            </div>

                            {/* Form Actions */}
                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={handleCloseForm}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn-primary"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={18} className="spinner" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            {editingId ? "Update" : "Create"} Training
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default AdminAssignedTrainings;
