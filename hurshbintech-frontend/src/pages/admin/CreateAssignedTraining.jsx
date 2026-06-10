// CreateAssignedTraining.jsx - Full-page form for creating/editing assigned trainings

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Upload, Loader2, X, File } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import assignedTrainingService from "../../api/services/assignedTrainingService";
import adminService from "../../api/services/adminService";
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
        target_user_ids: [],
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

    const [allUsers, setAllUsers] = useState([]);
    const [userSearchQuery, setUserSearchQuery] = useState("");

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

    // Fetch all users for specific assignments
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const [heads, coaches, trainers, learners] = await Promise.all([
                    adminService.getAllHeads().catch(() => []),
                    adminService.getAllConsultants().catch(() => []),
                    adminService.getAllTrainers().catch(() => []),
                    adminService.getAllLearners().catch(() => [])
                ]);

                const mapUsers = (users, role) => users.map(u => ({ id: u.user_id || u.id, name: u.name, email: u.email, role }));
                
                const combined = [
                    ...mapUsers(heads, "head"),
                    ...mapUsers(coaches, "coach"),
                    ...mapUsers(trainers, "trainer"),
                    ...mapUsers(learners, "learner")
                ];
                setAllUsers(combined);
            } catch (error) {
                console.error("Failed to fetch users", error);
            }
        };
        fetchUsers();
    }, []);

    const loadTraining = async () => {
        setLoading(true);
        try {
            const training = await assignedTrainingService.adminGet(id);
            setFormData({
                title: training.title || "",
                description: training.description || "",
                training_files: [],  // Files are handled separately now
                training_ref_ids: training.training_ref_ids || [],
                target_roles: training.target_roles || ["all"],
                target_user_ids: training.target_user_ids || [],
                active: training.active !== false,
                custom_metadata: training.custom_metadata || {},
            });

            // Load thumbnail image if exists
            if (training.featured_image_url) {
                setFeaturedImagePreview(training.featured_image_url);
            }

            // Load training files if they exist
            if (training.training_files && Array.isArray(training.training_files)) {
                const filesList = training.training_files.map((file) => {
                    // Create a file object from stored data
                    return {
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        url: file.url, // Preserve the URL so we don't re-upload
                        isUploaded: true, // Mark as already uploaded
                    };
                });
                setTrainingFiles(filesList);
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
            if (isEditMode && id) {
                // Edit mode - use old workflow
                const submitData = {
                    title: formData.title,
                    description: formData.description,
                    custom_content: formData.custom_content,
                    training_ref_ids: formData.training_ref_ids,
                    target_roles: formData.target_roles,
                    target_user_ids: formData.target_user_ids,
                    active: formData.active,
                    featured_image_url: null,
                    training_files: [],
                };

                // Upload thumbnail image
                if (featuredImage && !featuredImagePreview.startsWith("http")) {
                    try {
                        toast.info("Uploading thumbnail image...");
                        submitData.featured_image_url = await uploadFeaturedImage(featuredImage, id);
                    } catch (error) {
                        toast.error("Failed to upload thumbnail image");
                        console.error(error);
                        setSaving(false);
                        return;
                    }
                } else if (featuredImagePreview) {
                    submitData.featured_image_url = featuredImagePreview;
                }

                // Upload training files
                if (trainingFiles.length > 0) {
                    const filesToUpload = trainingFiles.filter(f => !f.isUploaded || !f.url);

                    if (filesToUpload.length > 0) {
                        toast.info(`Uploading ${filesToUpload.length} file(s)...`);
                        const uploadedFiles = await uploadTrainingFilesWithId(id, filesToUpload);
                        submitData.training_files = [...trainingFiles.filter(f => f.isUploaded), ...uploadedFiles];
                    } else {
                        submitData.training_files = trainingFiles.map(f => ({
                            name: f.name,
                            url: f.url,
                            size: f.size,
                            type: f.type || "document",
                        }));
                    }
                }

                await assignedTrainingService.adminUpdate(id, submitData);
                toast.success("Training updated successfully");
            } else {
                // Create mode - use new single-call endpoint
                toast.info("Creating training with files...");

                const formDataPayload = new FormData();
                formDataPayload.append('title', formData.title);
                formDataPayload.append('description', formData.description);
                formDataPayload.append('target_roles', JSON.stringify(formData.target_roles));
                if (formData.target_user_ids && formData.target_user_ids.length > 0) {
                    formDataPayload.append('target_user_ids', JSON.stringify(formData.target_user_ids));
                }
                formDataPayload.append('active', formData.active);

                if (formData.custom_content) {
                    formDataPayload.append('custom_content', formData.custom_content);
                }
                if (formData.training_ref_ids.length > 0) {
                    formDataPayload.append('training_ref_ids', JSON.stringify(formData.training_ref_ids));
                }
                if (formData.custom_metadata && Object.keys(formData.custom_metadata).length > 0) {
                    formDataPayload.append('custom_metadata', JSON.stringify(formData.custom_metadata));
                }

                // Add thumbnail image
                if (featuredImage) {
                    formDataPayload.append('featured_image', featuredImage);
                }

                // Add learning files
                if (trainingFiles.length > 0) {
                    trainingFiles.forEach(file => {
                        formDataPayload.append('learning_files', file);
                    });
                }

                const response = await api.post('/admin/assigned-trainings/with-files', formDataPayload, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                toast.success("Training created successfully with all files!");
            }

            navigate("/admin/assigned-trainings");
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "Failed to save training");
        } finally {
            setSaving(false);
        }
    };

    const uploadFeaturedImage = async (file, trainingId) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await api.post(`/admin/trainings/upload-thumbnail?training_id=${trainingId}`, formData);

        return response.data.file_url;
    };

    const uploadTrainingFilesWithId = async (trainingId, files) => {
        const formData = new FormData();
        files.forEach(file => {
            formData.append("files", file);
        });

        const response = await api.post(`/admin/trainings/upload-files?training_id=${trainingId}`, formData);

        if (!response.data.success && response.data.uploaded_files.length === 0) {
            throw new Error(response.data.errors[0]?.error || "Failed to upload files");
        }

        return response.data.uploaded_files;
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
                <div className="page-content">
                    <div className="loading-container">
                        <Loader2 className="spinner" />
                        <p>Loading training...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate("/admin/assigned-trainings")}
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
                            Back to Manage Learnings
                        </button>
                        <div>
                            <h1 className="page-title">Create Training</h1>
                        </div>
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

                        {/* Thumbnail Image Section */}
                        <div className="form-section">
                            <h2 className="section-title">Thumbnail Image</h2>
                            <div className="featured-image-container">
                                {featuredImagePreview ? (
                                    <div className="f-image-preview">
                                        <img
                                            src={featuredImagePreview}
                                            alt="Featured"
                                            className="f-preview-image"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFeaturedImage(null);
                                                setFeaturedImagePreview(null);
                                            }}
                                            className="remove-image-btn"
                                            title="Remove thumbnail image"
                                        >
                                            <X size={20} />
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
                                        <p>Click to upload thumbnail image</p>
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
                                                    {file.isUploaded && (
                                                        <p className="file-status uploaded">✓ Already uploaded</p>
                                                    )}
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
                            
                            {!formData.target_roles.includes("all") && formData.target_roles.length > 0 && (
                                <div className="specific-users-section mt-4" style={{ marginTop: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>Assign to Specific Users (Optional)</h3>
                                    <p className="section-description" style={{ marginBottom: '1rem' }}>
                                        If you leave this blank, the training will be assigned to <b>all users</b> in the selected roles.
                                        If you select specific users below, it will <b>only</b> be assigned to those users.
                                    </p>
                                    
                                    <input 
                                        type="text" 
                                        placeholder="Search users by name..." 
                                        className="form-input"
                                        style={{ marginBottom: '1rem' }}
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                    />
                                    
                                    <div className="users-list-scrollable" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', backgroundColor: '#f9fafb' }}>
                                        {allUsers
                                            .filter(u => formData.target_roles.includes(u.role))
                                            .filter(u => u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                            .slice(0, 5)
                                            .map(user => (
                                                <label key={user.id} className="role-checkbox" style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.target_user_ids?.includes(user.id) || false}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setFormData(prev => {
                                                                const newIds = checked 
                                                                    ? [...(prev.target_user_ids || []), user.id]
                                                                    : (prev.target_user_ids || []).filter(id => id !== user.id);
                                                                return { ...prev, target_user_ids: newIds };
                                                            });
                                                        }}
                                                    />
                                                    <span style={{ marginLeft: '0.5rem' }}>{user.name} <span style={{color: '#6b7280', fontSize: '0.85em', textTransform: 'capitalize'}}>({user.role})</span></span>
                                                </label>
                                        ))}
                                        {allUsers.filter(u => formData.target_roles.includes(u.role)).length === 0 && (
                                            <p className="text-sm text-gray-500">No users found for the selected roles.</p>
                                        )}
                                        {allUsers.filter(u => formData.target_roles.includes(u.role)).length > 0 && 
                                         allUsers.filter(u => formData.target_roles.includes(u.role) && u.name?.toLowerCase().includes(userSearchQuery.toLowerCase())).length === 0 && (
                                            <p className="text-sm text-gray-500">No users match your search.</p>
                                        )}
                                    </div>
                                </div>
                            )}

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
            </main>
        </div>
    );
};

export default CreateAssignedTraining;
