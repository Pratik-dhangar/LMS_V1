// CreateAssignedTraining.jsx - Full-page form for creating/editing assigned trainings

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Upload, Loader2, X, File } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import "../../styles/admin/CreateAssignedTraining.css";

const CreateAssignedTraining = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const isEditMode = !!id;

    // Check authorization
    useEffect(() => {
        if (user?.role?.toLowerCase() !== "admin") {
            navigate("/");
            toast.error("Only admins can create trainings");
        }
    }, [user, navigate]);

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        training_files: [],  // Store uploaded files
        training_ref_ids: [],
        target_roles: ["all"],
        active: true,
        custom_metadata: {},
    });

    const [featuredImage, setFeaturedImage] = useState(null);
    const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
    const [trainingFiles, setTrainingFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const trainingFilesInputRef = React.useRef(null);
    const featuredImageInputRef = React.useRef(null);

    const roles = [
        { id: "all", label: "All Users" },
        { id: "admin", label: "Admin" },
        { id: "head", label: "Head" },
        { id: "coach", label: "Coach" },
        { id: "trainer", label: "Trainer" },
        { id: "learner", label: "Learner" },
    ];

    // Load existing training if editing
    useEffect(() => {
        if (isEditMode && id) {
            loadTraining();
        }
    }, [isEditMode, id]);

    const loadTraining = async () => {
        setLoading(true);
        try {
            const training = await assignedTrainingService.adminGet(id);
            setFormData({
                title: training.title || "",
                description: training.description || "",
                training_files: [],  // Files are not loaded from server
                training_ref_ids: training.training_ref_ids || [],
                target_roles: training.target_roles || ["all"],
                active: training.active !== false,
                custom_metadata: training.custom_metadata || {},
            });

            // Load featured image from metadata if exists
            if (training.custom_metadata?.featured_image_url) {
                setFeaturedImagePreview(training.custom_metadata.featured_image_url);
            }
        } catch (error) {
            toast.error("Failed to load training");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const handleRoleChange = (roleId) => {
        setFormData((prev) => {
            let newRoles = [...prev.target_roles];
            if (roleId === "all") {
                // Toggle all
                newRoles = newRoles.includes("all") ? [] : ["all"];
            } else {
                // Remove 'all' if adding specific role
                newRoles = newRoles.filter((r) => r !== "all");
                if (newRoles.includes(roleId)) {
                    newRoles = newRoles.filter((r) => r !== roleId);
                } else {
                    newRoles.push(roleId);
                }
                // If no specific roles selected, add 'all'
                if (newRoles.length === 0) {
                    newRoles = ["all"];
                }
            }
            return { ...prev, target_roles: newRoles };
        });
    };

    const handleFeaturedImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith("image/")) {
                toast.error("Please select an image file");
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Image size must be less than 5MB");
                return;
            }

            setFeaturedImage(file);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFeaturedImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleTrainingFileChange = (e) => {
        const files = Array.from(e.target.files || []);

        // Validate file types and sizes
        const validFiles = files.filter(file => {
            // Check file size (100MB max per file)
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
        if (errors.training_files) {
            setErrors(prev => ({ ...prev, training_files: "" }));
        }
    };

    const removeTrainingFile = (index) => {
        setTrainingFiles(prev => prev.filter((_, i) => i !== index));
        setFormData(prev => ({
            ...prev,
            training_files: prev.training_files.filter((_, i) => i !== index)
        }));
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.title.trim()) {
            newErrors.title = "Title is required";
        }
        if (!formData.description.trim()) {
            newErrors.description = "Description is required";
        }
        if (trainingFiles.length === 0) {
            newErrors.training_files = "At least one file is required";
        }
        if (formData.target_roles.length === 0) {
            newErrors.target_roles = "Select at least one role";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error("Please fix the errors in the form");
            return;
        }

        setSaving(true);
        try {
            const submitData = { ...formData };

            // Prepare metadata
            if (featuredImagePreview) {
                submitData.custom_metadata = {
                    ...submitData.custom_metadata,
                    featured_image: featuredImagePreview,
                    featured_image_url: featuredImagePreview,
                };
            }

            if (isEditMode && id) {
                await assignedTrainingService.adminUpdate(id, submitData);
                toast.success("Training updated successfully");
            } else {
                await assignedTrainingService.adminCreate(submitData);
                toast.success("Training created successfully");
            }

            navigate("/admin/assigned-trainings");
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Failed to save training");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        if (
            window.confirm(
                "Are you sure you want to discard changes and go back?"
            )
        ) {
            navigate("/admin/assigned-trainings");
        }
    };

    if (loading) {
        return (
            <div className="page-layout">
                <Navbar />
                <div className="page-content">
                    <div className="loading-container">
                        <Loader2 className="spinner" />
                        <p>Loading training...</p>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="page-layout">
            <Navbar />
            <div className="page-content">
                <div className="training-editor-container">
                    {/* Header */}
                    <div className="editor-header">
                        <button
                            className="back-btn"
                            onClick={() => navigate("/admin/assigned-trainings")}
                            title="Back to trainings list"
                        >
                            <ArrowLeft size={20} />
                            Back to Trainings
                        </button>
                        <h1 className="editor-title">
                            {isEditMode ? "Edit Training" : "Create New Training"}
                        </h1>
                        <div className="header-spacer"></div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="training-form">
                        {/* Basic Information Section */}
                        <div className="form-section">
                            <h2 className="section-title">Basic Information</h2>

                            {/* Title */}
                            <div className="form-group">
                                <label htmlFor="title" className="form-label">
                                    Title <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                    placeholder="Enter training title"
                                    className={`form-input ${errors.title ? "error" : ""
                                        }`}
                                />
                                {errors.title && (
                                    <span className="form-error">{errors.title}</span>
                                )}
                            </div>

                            {/* Description */}
                            <div className="form-group">
                                <label htmlFor="description" className="form-label">
                                    Description <span className="required">*</span>
                                </label>
                                <textarea
                                    id="description"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    placeholder="Brief summary of the training"
                                    className={`form-textarea ${errors.description ? "error" : ""
                                        }`}
                                    rows="3"
                                />
                                <span className="char-count">
                                    {formData.description.length}/1000 characters
                                </span>
                                {errors.description && (
                                    <span className="form-error">{errors.description}</span>
                                )}
                            </div>


                        </div>

                        {/* Featured Image Section */}
                        <div className="form-section">
                            <h2 className="section-title">Featured Image</h2>
                            <div className="featured-image-container">
                                {featuredImagePreview ? (
                                    <div className="image-preview">
                                        <img
                                            src={featuredImagePreview}
                                            alt="Featured"
                                            className="preview-image"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFeaturedImage(null);
                                                setFeaturedImagePreview(null);
                                            }}
                                            className="remove-image-btn"
                                        >
                                            Remove Image
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        className="image-upload-box"
                                        onClick={() => featuredImageInputRef.current?.click()}
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
                                                handleFeaturedImageChange(event);
                                            }
                                        }}
                                    >
                                        <Upload size={32} />
                                        <p>Click to upload featured image</p>
                                        <span className="image-help-text">
                                            JPG, PNG, or WebP. Max size: 5MB
                                        </span>
                                    </div>
                                )}
                                <input
                                    ref={featuredImageInputRef}
                                    type="file"
                                    id="featured-image"
                                    accept="image/*"
                                    onChange={handleFeaturedImageChange}
                                    className="image-input"
                                />
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="form-section">
                            <h2 className="section-title">Content</h2>
                            <div className="form-group">
                                <label className="form-label">
                                    Training Files <span className="required">*</span>
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
                                {errors.training_files && (
                                    <span className="form-error">{errors.training_files}</span>
                                )}
                            </div>
                        </div>


                        {/* Role Assignment Section */}
                        <div className="form-section">
                            <h2 className="section-title">Assign to Roles</h2>
                            <p className="section-description">
                                Select which roles can see this training
                            </p>
                            <div className="roles-grid">
                                {roles.map((role) => (
                                    <label key={role.id} className="role-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={formData.target_roles.includes(
                                                role.id
                                            )}
                                            onChange={() => handleRoleChange(role.id)}
                                        />
                                        <span>{role.label}</span>
                                    </label>
                                ))}
                            </div>
                            {errors.target_roles && (
                                <span className="form-error">{errors.target_roles}</span>
                            )}
                        </div>

                        {/* Publishing Section */}
                        <div className="form-section">
                            <h2 className="section-title">Publishing</h2>
                            <div className="form-group">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="active"
                                        checked={formData.active}
                                        onChange={handleInputChange}
                                    />
                                    <span>
                                        {formData.active
                                            ? "Published (Visible to users)"
                                            : "Draft (Not visible to users)"}
                                    </span>
                                </label>
                                <p className="help-text">
                                    {formData.active
                                        ? "This training is visible to assigned roles"
                                        : "This training is saved as a draft and not visible to users"}
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="form-actions">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="btn-secondary"
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={saving}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={18} className="spinner" />
                                        {isEditMode ? "Updating..." : "Creating..."}
                                    </>
                                ) : (
                                    <>{isEditMode ? "Update Training" : "Create Training"}</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default CreateAssignedTraining;
