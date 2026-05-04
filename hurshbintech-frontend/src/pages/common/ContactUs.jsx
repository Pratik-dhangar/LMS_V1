import React, { useState } from "react";
import { toast } from "react-toastify";
import { FaPaperPlane, FaCheckCircle, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaWhatsapp, FaSeedling, FaInstagram, FaFacebook, FaYoutube, FaSpinner } from "react-icons/fa";
import confetti from "canvas-confetti";
import contactService from "../../api/services/contactService";
import "../../styles/components/common/Modal.css";
import "../../styles/admin/ContactUs.css";

const ContactUs = () => {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        parent_name: "",
        child_name: "",
        child_age: "",
        address: "",
        email: "",
        phone: "",
        message: "",
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!formData.parent_name.trim()) {
            newErrors.parent_name = "Name is required";
        } else if (formData.parent_name.length < 2) {
            newErrors.parent_name = "Name must be at least 2 characters";
        }

        if (formData.child_name && formData.child_name.trim().length > 0 && formData.child_name.trim().length < 2) {
            newErrors.child_name = "Child name must be at least 2 characters";
        }

        if (formData.child_age && formData.child_age.trim().length > 20) {
            newErrors.child_age = "Child age is too long";
        }

        if (formData.address && formData.address.length > 1000) {
            newErrors.address = "Address must not exceed 1000 characters";
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!formData.message.trim()) {
            newErrors.message = "Message is required";
        } else if (formData.message.length < 5) {
            newErrors.message = "Message must be at least 5 characters";
        } else if (formData.message.length > 5000) {
            newErrors.message = "Message must not exceed 5000 characters";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors((prev) => ({
                ...prev,
                [name]: "",
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error("Please fix the errors in the form");
            return;
        }

        setLoading(true);

        try {
            // Submit the contact form
            await contactService.submitContact(formData);

            // Show success animation
            confetti({
                particleCount: 150,
                spread: 60,
                origin: { y: 0.8 },
                colors: ["#F28C28", "#8B4513"],
            });

            // Show success state
            setSubmitted(true);
            toast.success("Thank you! We'll get back to you soon.");

            // Reset form after 3 seconds
            setTimeout(() => {
                setFormData({
                    parent_name: "",
                    child_name: "",
                    child_age: "",
                    address: "",
                    email: "",
                    phone: "",
                    message: "",
                });
                setSubmitted(false);
            }, 3000);
        } catch (error) {
            console.error("Error submitting contact form:", error);
            const errorMessage =
                error.response?.data?.detail || "Failed to submit contact form. Please try again.";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="contact-page-wrapper">
            {/* Floating WhatsApp Button */}
            <a
                href="https://wa.me/911234567890"
                className="whatsapp-float"
                target="_blank"
                rel="noopener noreferrer"
                title="Chat with us on WhatsApp"
            >
                <FaWhatsapp />
            </a>

            <div className="contact-page-container">
                {/* Contact Card */}
                <div className="contact-card">
                    {/* Brand Panel */}
                    <div className="brand-panel">
                        <div>
                            <h2>
                                <FaSeedling /> Let's Grow
                            </h2>
                            <p>Supporting your child's journey with care and expertise.</p>

                            <div style={{ marginTop: "35px" }}>
                                <div className="contact-item">
                                    <FaMapMarkerAlt /> Mumbai, Maharashtra
                                </div>
                                <div className="contact-item">
                                    <FaPhoneAlt /> +91 8928765220
                                </div>
                                <div className="contact-item">
                                    <FaEnvelope /> help@hurshbin.com
                                </div>
                            </div>
                        </div>

                        <div className="social-links">
                            <a
                                href="https://www.instagram.com/hurshbin_mumbai?igsh=d3E0YXhuaTAwZGd3   "
                                className="social-icon"
                                title="Follow us on Instagram"
                                target="_blank"
                            >
                                <FaInstagram />
                            </a>
                            <a
                                href="#"
                                className="social-icon"
                                title="Follow us on Facebook"
                                onClick={(e) => e.preventDefault()}
                            >
                                <FaFacebook />
                            </a>
                            <a
                                href="#"
                                className="social-icon"
                                title="Subscribe on YouTube"
                                onClick={(e) => e.preventDefault()}
                            >
                                <FaYoutube />
                            </a>
                        </div>
                    </div>

                    {/* Form Panel */}
                    <div className="form-panel">
                        <h3>Send a Message</h3>

                        {submitted ? (
                            <div className="success-message">
                                <FaCheckCircle style={{ fontSize: "40px", marginBottom: "15px" }} />
                                <h4>Message Sent Successfully!</h4>
                                <p>Thank you for reaching out. We'll get back to you soon.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="contact-form">
                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="parent_name"
                                        placeholder="Parent's Name"
                                        value={formData.parent_name}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.parent_name ? "error" : ""}
                                    />
                                    {errors.parent_name && (
                                        <span className="error-message">{errors.parent_name}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="child_name"
                                        placeholder="Child's Name"
                                        value={formData.child_name}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.child_name ? "error" : ""}
                                    />
                                    {errors.child_name && (
                                        <span className="error-message">{errors.child_name}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="child_age"
                                        placeholder="Child Age"
                                        value={formData.child_age}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.child_age ? "error" : ""}
                                    />
                                    {errors.child_age && (
                                        <span className="error-message">{errors.child_age}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="address"
                                        placeholder="Address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.address ? "error" : ""}
                                    />
                                    {errors.address && (
                                        <span className="error-message">{errors.address}</span>
                                    )}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Email Address"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.email ? "error" : ""}
                                    />
                                    {errors.email && <span className="error-message">{errors.email}</span>}
                                </div>

                                <div className="input-group">
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="Phone Number (Optional)"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="input-group">
                                    <textarea
                                        name="message"
                                        rows="4"
                                        placeholder="How can we help?"
                                        value={formData.message}
                                        onChange={handleInputChange}
                                        disabled={loading}
                                        className={errors.message ? "error" : ""}
                                    />
                                    {errors.message && (
                                        <span className="error-message">{errors.message}</span>
                                    )}
                                    <span className="char-count">
                                        {formData.message.length}/5000
                                    </span>
                                </div>

                                <div className="form-action-row">
                                    <button
                                        type="submit"
                                        className="submit-btn"
                                        disabled={loading}
                                        style={{
                                            opacity: loading ? 0.6 : 1,
                                            cursor: loading ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        {loading ? (
                                            <>
                                                <FaSpinner style={{ animation: "spin 1s linear infinite" }} /> Sending...
                                            </>
                                        ) : (
                                            <>
                                                Start Growing Together <FaPaperPlane />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                {/* Map Container */}
                <div className="map-container">
                    {/* <iframe
                        src="https://maps.app.goo.gl/KtE8DqUyKZPQvW7K6"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                    /> */}
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.342512597982!2d72.8540764228729!3d19.22389887416818!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b72af48ffd1d%3A0xc717043938ec6753!2sHurshBin%20Child%20Development%20%26%20ABA%20Therapy%20Services!5e0!3m2!1sen!2sin!4v1777883363748!5m2!1sen!2sin"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade">
                    </iframe>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
