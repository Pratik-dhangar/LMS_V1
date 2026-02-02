import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Loader from "../../components/common/Loader";
import RichTextEditor from "../../components/RichTextEditor";
import { FaSave, FaTimes, FaImage, FaGlobe } from "react-icons/fa";
import aboutUsService from "../../api/services/aboutUsService";
import adminService from "../../api/services/adminService";
import "../../styles/ManageUsersLayout.css";
import "../../styles/admin/AdminAboutUs.css";

const AdminAboutUs = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aboutUsId, setAboutUsId] = useState(null);
  const [activeTab, setActiveTab] = useState("hero");

  const [formData, setFormData] = useState({
    language_code: "en",
    is_active: true,
    hero_title: "",
    hero_subtitle: "",
    intro_title: "Who We Are",
    intro_content: "",
    mission_title: "Our Mission",
    mission_content: "",
    vision_title: "Our Vision",
    vision_content: "",
    programs_title: "What We Teach",
    programs_content: "",
    methodology_title: "How We Teach",
    methodology_content: "",
    why_us_title: "Why Choose Us",
    why_us_content: "",
    team_title: "Our Educators",
    team_content: "",
    learner_focus_title: "Learner & Parent Focus",
    learner_focus_content: "",
    values_title: "Our Values",
    values_content: "",
    commitment_title: "Our Commitment",
    commitment_content: "",
    featured_coach_id: null,
    status: "draft",
  });

  const [featuredImage, setFeaturedImage] = useState(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);

  useEffect(() => {
    fetchAboutUs();
    fetchCoaches();
  }, []);

  // Set selected coach when coaches are loaded and featured_coach_id exists
  useEffect(() => {
    if (coaches.length > 0 && formData.featured_coach_id) {
      const coach = coaches.find(c => c.id === formData.featured_coach_id);
      if (coach) {
        setSelectedCoach(coach);
      }
    }
  }, [coaches, formData.featured_coach_id]);

  const fetchCoaches = async () => {
    try {
      const data = await adminService.getAllConsultants();
      setCoaches(data || []);
    } catch (err) {
      console.error("Error fetching coaches:", err);
      toast.error("Failed to load coaches");
    }
  };

  const fetchAboutUs = async () => {
    try {
      setLoading(true);
      const aboutUs = await aboutUsService.getAdminAboutUs("en");
      if (aboutUs) {
        setAboutUsId(aboutUs.id);
        setFormData({
          language_code: aboutUs.language_code,
          is_active: aboutUs.is_active,
          hero_title: aboutUs.hero_title || "",
          hero_subtitle: aboutUs.hero_subtitle || "",
          intro_title: aboutUs.intro_title || "Who We Are",
          intro_content: aboutUs.intro_content || "",
          mission_title: aboutUs.mission_title || "Our Mission",
          mission_content: aboutUs.mission_content || "",
          vision_title: aboutUs.vision_title || "Our Vision",
          vision_content: aboutUs.vision_content || "",
          programs_title: aboutUs.programs_title || "What We Teach",
          programs_content: aboutUs.programs_content || "",
          methodology_title: aboutUs.methodology_title || "How We Teach",
          methodology_content: aboutUs.methodology_content || "",
          why_us_title: aboutUs.why_us_title || "Why Choose Us",
          why_us_content: aboutUs.why_us_content || "",
          team_title: aboutUs.team_title || "Our Educators",
          team_content: aboutUs.team_content || "",
          learner_focus_title:
            aboutUs.learner_focus_title || "Learner & Parent Focus",
          learner_focus_content: aboutUs.learner_focus_content || "",
          values_title: aboutUs.values_title || "Our Values",
          values_content: aboutUs.values_content || "",
          commitment_title: aboutUs.commitment_title || "Our Commitment",
          commitment_content: aboutUs.commitment_content || "",
          featured_coach_id: aboutUs.featured_coach_id || null,
          status: aboutUs.status,
        });
        if (aboutUs.featured_image_url) {
          setFeaturedImagePreview(aboutUs.featured_image_url);
        }
        // Set selected coach if exists
        if (aboutUs.featured_coach_id) {
          const coach = coaches.find(c => c.id === aboutUs.featured_coach_id);
          if (coach) {
            setSelectedCoach(coach);
          }
        }
      }
    } catch (err) {
      // If no About Us page exists yet, that's okay - we'll create one
      if (err.response?.status === 404) {
        console.log("No About Us page exists yet. Ready to create one.");
      } else {
        console.error("Error fetching About Us:", err);
        toast.error("Failed to fetch About Us page");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleContentChange = (field, html) => {
    setFormData((prev) => ({ ...prev, [field]: html }));
  };

  const handleCoachSelect = (e) => {
    const coachId = parseInt(e.target.value);
    const coach = coaches.find(c => c.id === coachId);
    setSelectedCoach(coach || null);
    setFormData((prev) => ({
      ...prev,
      featured_coach_id: coachId || null,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedTypes.includes(file.type)) {
        toast.error(
          "Invalid file type. Please upload a JPEG, PNG, or WebP image."
        );
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size too large. Maximum size is 5MB.");
        return;
      }

      setFeaturedImage(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setFeaturedImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = async () => {
    try {
      // If there's an aboutUsId and an image preview, delete from server first
      if (aboutUsId && featuredImagePreview) {
        try {
          await aboutUsService.deleteFeaturedImage(aboutUsId);
          toast.success("Featured image deleted successfully");
        } catch (err) {
          // If delete fails with 404, it's likely the image doesn't exist on server
          // Still allow clearing local state
          if (err.response?.status === 404) {
            console.warn(
              "Featured image not found on server, clearing local state"
            );
          } else {
            throw err;
          }
        }
      }
      // Clear local state
      setFeaturedImage(null);
      setFeaturedImagePreview(null);
    } catch (err) {
      console.error("Error deleting featured image:", err);
      toast.error(
        err.response?.data?.detail || "Failed to delete featured image"
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const formDataToSend = new FormData();

      // Append all form fields
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (featuredImage) {
        formDataToSend.append("featured_image", featuredImage);
      }

      if (aboutUsId) {
        await aboutUsService.updateAboutUs(aboutUsId, formDataToSend);
        toast.success("About Us page updated successfully");
      } else {
        const result = await aboutUsService.createAboutUs(formDataToSend);
        setAboutUsId(result.id);
        toast.success("About Us page created successfully");
      }

      // Refresh data
      await fetchAboutUs();
    } catch (err) {
      console.error("Error saving About Us:", err);
      toast.error(err.response?.data?.detail || "Failed to save About Us page");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "hero", label: "Hero Section", icon: "🏆" },
    { id: "intro", label: "Introduction", icon: "👋" },
    { id: "mission", label: "Mission", icon: "🎯" },
    { id: "vision", label: "Vision", icon: "🔭" },
    { id: "programs", label: "Programs", icon: "📚" },
    { id: "methodology", label: "Methodology", icon: "🎓" },
    { id: "why_us", label: "Why Us", icon: "⭐" },
    { id: "team", label: "Team", icon: "👥" },
    { id: "learner_focus", label: "Learner Focus", icon: "🎪" },
    { id: "values", label: "Values", icon: "💎" },
    { id: "commitment", label: "Commitment", icon: "🤝" },
    { id: "book_appointment", label: "Book Appointment", icon: "📅" },
  ];

  if (loading) {
    return (
      <div>
        <Loader />
      </div>
    );
  }

  return (
    <div className="page-main">
        <div className="page-content">
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
            {/* Left Side: Title and Subtitle */}
            <div>
              <h1 className="page-title">Edit About US</h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="admin-aboutus-form">
            {/* Top Controls */}
            <div className="admin-aboutus-settings-card">
              <h2 className="admin-aboutus-settings-title">
                <span className="admin-aboutus-title-accent"></span>
                Page Settings
              </h2>
              <div className="admin-aboutus-settings-grid">
                {/* Language */}
                <div className="admin-aboutus-form-group">
                  <label className="admin-aboutus-label">
                    <FaGlobe className="admin-aboutus-label-icon" />
                    Language
                  </label>
                  <select
                    name="language_code"
                    value={formData.language_code}
                    onChange={handleChange}
                    className="admin-aboutus-select"
                  >
                    <option value="en">🇬🇧 English</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="fr">🇫🇷 French</option>
                  </select>
                </div>

                {/* Status */}
                <div className="admin-aboutus-form-group">
                  <label className="admin-aboutus-label">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="admin-aboutus-select"
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="published">✅ Published</option>
                  </select>
                </div>

                {/* Active Toggle */}
                <div className="admin-aboutus-form-group">
                  <label className="admin-aboutus-label">Page Status</label>
                  <label className="admin-aboutus-toggle-container">
                    <div className="admin-aboutus-toggle-wrapper">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleChange}
                        className="admin-aboutus-toggle-input"
                      />
                      <div
                        className={`admin-aboutus-toggle-bg ${
                          formData.is_active
                            ? "admin-aboutus-toggle-bg-active"
                            : "admin-aboutus-toggle-bg-inactive"
                        }`}
                      ></div>
                      <div
                        className={`admin-aboutus-toggle-thumb ${
                          formData.is_active
                            ? "admin-aboutus-toggle-thumb-active"
                            : ""
                        }`}
                      ></div>
                    </div>
                    <span
                      className={`admin-aboutus-toggle-label ${
                        formData.is_active
                          ? "admin-aboutus-toggle-label-active"
                          : "admin-aboutus-toggle-label-inactive"
                      }`}
                    >
                      {formData.is_active ? "🟢 Active" : "🔴 Inactive"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Featured Image */}
              <div className="admin-aboutus-image-section">
                <label className="admin-aboutus-label">
                  <FaImage className="admin-aboutus-label-icon" />
                  Featured Hero Image
                </label>

                {featuredImagePreview ? (
                  <div className="admin-aboutus-image-preview-container">
                    <div className="admin-aboutus-image-preview-wrapper">
                      <img
                        src={featuredImagePreview}
                        alt="Featured preview"
                        className="admin-aboutus-image-preview"
                      />
                      <div className="admin-aboutus-image-preview-overlay"></div>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="admin-aboutus-image-remove-btn"
                    >
                      <FaTimes />
                    </button>
                  </div>
                ) : (
                  <div className="admin-aboutus-upload-wrapper">
                    <label className="admin-aboutus-upload-label">
                      <div className="admin-aboutus-upload-content">
                        <div className="admin-aboutus-upload-icon-wrapper">
                          <FaImage className="admin-aboutus-upload-icon" />
                        </div>
                        <p className="admin-aboutus-upload-text">
                          <span className="admin-aboutus-upload-text-bold">
                            Click to upload
                          </span>{" "}
                          or drag and drop
                        </p>
                        <p className="admin-aboutus-upload-hint">
                          PNG, JPG, WebP (MAX. 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="admin-aboutus-upload-input"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Tabbed Content Editor */}
            <div className="admin-aboutus-tabs-container">
              {/* Tab Navigation */}
              <div className="admin-aboutus-tabs-nav">
                <div className="admin-aboutus-tabs-list">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`admin-aboutus-tab-button ${
                        activeTab === tab.id
                          ? "admin-aboutus-tab-button-active"
                          : "admin-aboutus-tab-button-inactive"
                      }`}
                    >
                      <span className="admin-aboutus-tab-icon">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="admin-aboutus-tab-content">
                {/* Hero Section */}
                {activeTab === "hero" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✨</span>
                        Hero Title
                      </label>
                      <input
                        type="text"
                        name="hero_title"
                        value={formData.hero_title}
                        onChange={handleChange}
                        placeholder="e.g., Empowering Learners Worldwide"
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">💬</span>
                        Hero Subtitle
                      </label>
                      <textarea
                        name="hero_subtitle"
                        value={formData.hero_subtitle}
                        onChange={handleChange}
                        rows={3}
                        placeholder="e.g., Quality education through technology and expert guidance"
                        className="admin-aboutus-textarea"
                      />
                    </div>
                  </div>
                )}

                {/* Introduction */}
                {activeTab === "intro" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="intro_title"
                        value={formData.intro_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.intro_content}
                        onChange={(html) =>
                          handleContentChange("intro_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Mission */}
                {activeTab === "mission" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="mission_title"
                        value={formData.mission_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.mission_content}
                        onChange={(html) =>
                          handleContentChange("mission_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Vision */}
                {activeTab === "vision" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="vision_title"
                        value={formData.vision_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.vision_content}
                        onChange={(html) =>
                          handleContentChange("vision_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Programs */}
                {activeTab === "programs" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="programs_title"
                        value={formData.programs_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.programs_content}
                        onChange={(html) =>
                          handleContentChange("programs_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Methodology */}
                {activeTab === "methodology" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="methodology_title"
                        value={formData.methodology_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.methodology_content}
                        onChange={(html) =>
                          handleContentChange("methodology_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Why Us */}
                {activeTab === "why_us" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="why_us_title"
                        value={formData.why_us_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.why_us_content}
                        onChange={(html) =>
                          handleContentChange("why_us_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Team */}
                {activeTab === "team" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="team_title"
                        value={formData.team_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.team_content}
                        onChange={(html) =>
                          handleContentChange("team_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Learner Focus */}
                {activeTab === "learner_focus" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="learner_focus_title"
                        value={formData.learner_focus_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.learner_focus_content}
                        onChange={(html) =>
                          handleContentChange("learner_focus_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Values */}
                {activeTab === "values" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="values_title"
                        value={formData.values_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.values_content}
                        onChange={(html) =>
                          handleContentChange("values_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Commitment */}
                {activeTab === "commitment" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📌</span>
                        Section Title
                      </label>
                      <input
                        type="text"
                        name="commitment_title"
                        value={formData.commitment_title}
                        onChange={handleChange}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                      />
                    </div>
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">✍️</span>
                        Content
                      </label>
                      <RichTextEditor
                        value={formData.commitment_content}
                        onChange={(html) =>
                          handleContentChange("commitment_content", html)
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Book Appointment */}
                {activeTab === "book_appointment" && (
                  <div className="admin-aboutus-tab-content-inner">
                    <div className="admin-aboutus-content-section">
                      <label className="admin-aboutus-section-label">
                        <span className="admin-aboutus-section-icon">📅</span>
                        Featured Coach
                      </label>
                      <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                        Select a coach to be displayed on the landing page for quick appointment booking
                      </p>
                      <select
                        value={formData.featured_coach_id || ''}
                        onChange={handleCoachSelect}
                        className="admin-aboutus-input admin-aboutus-input-lg"
                        style={{ marginBottom: '20px' }}
                      >
                        <option value="">-- Select a Coach --</option>
                        {coaches.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name} {coach.specialization ? `- ${coach.specialization}` : ''}
                          </option>
                        ))}
                      </select>

                      {/* Coach Preview Card */}
                      {selectedCoach && (
                        <div style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '20px',
                          backgroundColor: '#f9fafb',
                          marginTop: '20px'
                        }}>
                          <h4 style={{ marginBottom: '15px', color: '#374151', fontSize: '16px', fontWeight: '600' }}>
                            Preview - How it will appear on Landing Page:
                          </h4>
                          <div style={{
                            border: '2px solid #3b82f6',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            maxWidth: '400px',
                            backgroundColor: '#ffffff',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}>
                            {/* Coach Profile Picture */}
                            {selectedCoach.profile_picture_url ? (
                              <img
                                src={selectedCoach.profile_picture_url}
                                alt={selectedCoach.name}
                                style={{
                                  width: '100%',
                                  height: '200px',
                                  objectFit: 'cover'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '200px',
                                backgroundColor: '#e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '48px',
                                color: '#9ca3af'
                              }}>
                                {selectedCoach.name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            
                            {/* Coach Details */}
                            <div style={{ padding: '20px' }}>
                              <h3 style={{
                                fontSize: '20px',
                                fontWeight: '700',
                                color: '#1f2937',
                                marginBottom: '8px'
                              }}>
                                Book Appointment with {selectedCoach.name}
                              </h3>
                              {selectedCoach.specialization && (
                                <p style={{
                                  fontSize: '14px',
                                  color: '#6b7280',
                                  marginBottom: '16px'
                                }}>
                                  <strong>Specialization:</strong> {selectedCoach.specialization}
                                </p>
                              )}
                              <button
                                type="button"
                                disabled
                                style={{
                                  width: '100%',
                                  padding: '12px',
                                  backgroundColor: '#3b82f6',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '16px',
                                  fontWeight: '600',
                                  cursor: 'not-allowed',
                                  opacity: '0.7'
                                }}
                              >
                                Book Appointment
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="admin-aboutus-actions">
              <button
                type="button"
                onClick={() => navigate("/admin/dashboard")}
                className="admin-aboutus-btn-cancel"
              >
                <FaTimes className="admin-aboutus-btn-icon" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="admin-aboutus-btn-save"
              >
                {saving ? (
                  <>
                    <div className="admin-aboutus-spinner"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FaSave className="admin-aboutus-btn-icon" />
                    <span>Save About Us</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

export default AdminAboutUs;
