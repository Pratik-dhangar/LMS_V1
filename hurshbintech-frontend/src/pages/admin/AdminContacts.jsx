import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
    FaArrowLeft,
    FaSearch,
    FaFilter,
    FaTrash,
    FaEdit,
    FaEnvelope,
    FaPhone,
    FaCalendar,
    FaCheckCircle,
    FaTimesCircle,
    FaTimes,
    FaSave,
    FaCheck
} from "react-icons/fa";
import Loader from "../../components/common/Loader";
import contactService from "../../api/services/contactService";
import "../../styles/ManageUsersLayout.css";
import "../../styles/admin/AdminContacts.css";

const AdminContacts = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [contacts, setContacts] = useState([]);
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState({
        skip: 0,
        limit: 10,
        total: 0,
    });

    // Filter and search
    const [filters, setFilters] = useState({
        status: "",
        search: "",
        unresolved_only: false,
    });

    // Modal state
    const [selectedContact, setSelectedContact] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Form state for updating contact
    const [updateForm, setUpdateForm] = useState({
        status: "",
        admin_notes: "",
        is_resolved: false,
    });

    // Fetch contacts and stats
    const fetchData = async (skip = 0) => {
        try {
            setLoading(true);
            const [contactsData, statsData] = await Promise.all([
                contactService.getAdminContacts(skip, pagination.limit, filters),
                contactService.getContactStats(),
            ]);

            setContacts(contactsData.data);
            setPagination({
                skip: contactsData.skip,
                limit: contactsData.limit,
                total: contactsData.total,
            });
            setStats(statsData);
        } catch (error) {
            console.error("Error fetching contacts:", error);
            toast.error("Failed to load contacts");
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchData(0);
    }, []);

    // Refresh when filters change
    useEffect(() => {
        fetchData(0);
    }, [filters]);

    const handleFilterChange = (filterName, value) => {
        setFilters((prev) => ({
            ...prev,
            [filterName]: value,
        }));
    };

    const handleSearchChange = (value) => {
        setFilters((prev) => ({
            ...prev,
            search: value,
        }));
    };

    const handlePageChange = (newSkip) => {
        fetchData(newSkip);
    };

    // Modal handlers
    const openDetailModal = (contact) => {
        setSelectedContact(contact);
        setUpdateForm({
            status: contact.status,
            admin_notes: contact.admin_notes || "",
            is_resolved: contact.is_resolved,
        });
        setShowDetailModal(true);
    };

    const closeDetailModal = () => {
        setShowDetailModal(false);
        setSelectedContact(null);
        setUpdateForm({
            status: "",
            admin_notes: "",
            is_resolved: false,
        });
    };

    const handleUpdateContact = async () => {
        if (!selectedContact) return;

        try {
            setIsUpdating(true);
            await contactService.updateContact(selectedContact.id, updateForm);

            toast.success("Contact updated successfully");
            closeDetailModal();
            fetchData(pagination.skip);
        } catch (error) {
            console.error("Error updating contact:", error);
            toast.error("Failed to update contact");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteContact = async (contactId) => {
        if (!window.confirm("Are you sure you want to delete this contact?")) {
            return;
        }

        try {
            await contactService.deleteContact(contactId);
            toast.success("Contact deleted successfully");
            fetchData(pagination.skip);
        } catch (error) {
            console.error("Error deleting contact:", error);
            toast.error("Failed to delete contact");
        }
    };

    const handleMarkAsResolved = async (contact) => {
        try {
            await contactService.markAsResolved(contact.id);
            toast.success("Contact marked as resolved");
            fetchData(pagination.skip);
        } catch (error) {
            console.error("Error marking contact as resolved:", error);
            toast.error("Failed to update contact");
        }
    };

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case "new":
                return "badge-new";
            case "read":
                return "badge-read";
            case "replied":
                return "badge-replied";
            case "archived":
                return "badge-archived";
            default:
                return "badge-new";
        }
    };

    const getStatusLabel = (status) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const totalPages = Math.ceil(pagination.total / pagination.limit);
    const currentPage = Math.floor(pagination.skip / pagination.limit) + 1;

    if (loading && contacts.length === 0) {
        return <Loader />;
    }

    return (
        <div className="manage-users-container">
            <div className="page-header">
                <button
                    className="back-button"
                    onClick={() => navigate("/admin/dashboard")}
                    title="Go back to dashboard"
                >
                    <FaArrowLeft /> Back to Dashboard
                </button>
                <div>
                    <h1 className="page-title">Contact Submissions</h1>
                    <p className="page-description">View and manage messages submitted by users</p>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="contact-stats-container">
                    <div className="stat-card stat-total">
                        <div className="stat-number">{stats.total_contacts}</div>
                        <div className="stat-label">Total Contacts</div>
                    </div>
                    <div className="stat-card stat-new">
                        <div className="stat-number">{stats.new_contacts}</div>
                        <div className="stat-label">New Contacts</div>
                    </div>
                    <div className="stat-card stat-unresolved">
                        <div className="stat-number">{stats.unresolved_contacts}</div>
                        <div className="stat-label">Unresolved</div>
                    </div>
                    <div className="stat-card stat-replied">
                        <div className="stat-number">{stats.replied_contacts}</div>
                        <div className="stat-label">Replied</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filter-section">
                <div className="search-box">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search by name, email, or message..."
                        value={filters.search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>

                <div className="filter-controls">
                    <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="new">New</option>
                        <option value="read">Read</option>
                        <option value="replied">Replied</option>
                        <option value="archived">Archived</option>
                    </select>

                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={filters.unresolved_only}
                            onChange={(e) =>
                                handleFilterChange("unresolved_only", e.target.checked)
                            }
                        />
                        Unresolved Only
                    </label>
                </div>
            </div>

            {/* Contacts Table */}
            <div className="contacts-table-container">
                {contacts.length === 0 ? (
                    <div className="empty-state">
                        <p>No contacts found</p>
                    </div>
                ) : (
                    <table className="contacts-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Message Preview</th>
                                <th>Status</th>
                                <th>Resolved</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contacts.map((contact) => (
                                <tr key={contact.id} className="contact-row">
                                    <td className="name-cell">{contact.parent_name}</td>
                                    <td>
                                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                                    </td>
                                    <td>{contact.phone || "-"}</td>
                                    <td className="message-preview">
                                        {contact.message.substring(0, 50)}
                                        {contact.message.length > 50 ? "..." : ""}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusBadgeColor(contact.status)}`}>
                                            {getStatusLabel(contact.status)}
                                        </span>
                                    </td>
                                    <td className="resolved-cell">
                                        {contact.is_resolved ? (
                                            <FaCheckCircle className="text-success" />
                                        ) : (
                                            <FaTimesCircle className="text-danger" />
                                        )}
                                    </td>
                                    <td className="date-cell">
                                        {new Date(contact.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="actions-cell">
                                        <button
                                            className="btn-icon btn-view"
                                            onClick={() => openDetailModal(contact)}
                                            title="View details"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="btn-icon btn-delete"
                                            onClick={() => handleDeleteContact(contact.id)}
                                            title="Delete contact"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <div className="pagination">
                <button
                    disabled={pagination.skip === 0}
                    onClick={() => handlePageChange(Math.max(0, pagination.skip - pagination.limit))}
                    className="pagination-btn"
                >
                    Previous
                </button>
                <span className="pagination-info">
                    Page {currentPage} of {totalPages || 1}
                </span>
                <button
                    disabled={pagination.skip + pagination.limit >= pagination.total}
                    onClick={() => handlePageChange(pagination.skip + pagination.limit)}
                    className="pagination-btn"
                >
                    Next
                </button>
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedContact && (
                <div className="modal-overlay" onClick={closeDetailModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Contact Details</h2>
                            <button className="btn-close" onClick={closeDetailModal}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Contact Info */}
                            <div className="contact-info-section">
                                <h3>Submitter Information</h3>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <label>Name:</label>
                                        <span>{selectedContact.parent_name}</span>
                                    </div>
                                    <div className="info-item">
                                        <label>
                                            <FaEnvelope /> Email:
                                        </label>
                                        <a href={`mailto:${selectedContact.email}`}>
                                            {selectedContact.email}
                                        </a>
                                    </div>
                                    {selectedContact.phone && (
                                        <div className="info-item">
                                            <label>
                                                <FaPhone /> Phone:
                                            </label>
                                            <span>{selectedContact.phone}</span>
                                        </div>
                                    )}
                                    <div className="info-item">
                                        <label>
                                            <FaCalendar /> Submitted:
                                        </label>
                                        <span>{new Date(selectedContact.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Message */}
                            <div className="message-section">
                                <h3>Message</h3>
                                <div className="message-box">{selectedContact.message}</div>
                            </div>

                            {/* Admin Form */}
                            <div className="admin-form-section">
                                <h3>Admin Response</h3>

                                <div className="form-group">
                                    <label>Status:</label>
                                    <select
                                        value={updateForm.status}
                                        onChange={(e) =>
                                            setUpdateForm((prev) => ({
                                                ...prev,
                                                status: e.target.value,
                                            }))
                                        }
                                        className="form-control"
                                    >
                                        <option value="new">New</option>
                                        <option value="read">Read</option>
                                        <option value="replied">Replied</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Admin Notes:</label>
                                    <textarea
                                        value={updateForm.admin_notes}
                                        onChange={(e) =>
                                            setUpdateForm((prev) => ({
                                                ...prev,
                                                admin_notes: e.target.value,
                                            }))
                                        }
                                        className="form-control"
                                        placeholder="Add admin notes here..."
                                        rows="4"
                                    />
                                </div>

                                <div className="form-group checkbox">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={updateForm.is_resolved}
                                            onChange={(e) =>
                                                setUpdateForm((prev) => ({
                                                    ...prev,
                                                    is_resolved: e.target.checked,
                                                }))
                                            }
                                        />
                                        Mark as Resolved
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={closeDetailModal}
                                disabled={isUpdating}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleUpdateContact}
                                disabled={isUpdating}
                            >
                                {isUpdating ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i> Saving...
                                    </>
                                ) : (
                                    <>
                                        <FaSave /> Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminContacts;
