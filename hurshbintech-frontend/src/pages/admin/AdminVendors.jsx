import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { AlertCircle, Loader2, Edit3, Trash2, ToggleLeft, ToggleRight, Save, X } from 'lucide-react';
import vendorService from '../../api/services/vendorService';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/ManageUsersLayout.css';
import '../../styles/Table.css';
import '../../styles/admin/index.css';

const emptyForm = {
    name: '',
    email: '',
    contact_number: '',
    company_name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    website: '',
    tax_id: '',
};

const AdminVendors = () => {
    const navigate = useNavigate();

    const [vendors, setVendors] = useState([]);
    const [filteredVendors, setFilteredVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeSearchQuery, setActiveSearchQuery] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [editingVendorId, setEditingVendorId] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await vendorService.getAllVendors(0, 100, false);
            setVendors(data);
            setFilteredVendors(data);
        } catch (err) {
            console.error('Error fetching vendors:', err);
            setError('Failed to load vendors. Please try again.');
            toast.error('Failed to load vendors');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (query) => {
        setActiveSearchQuery(query);
        if (query.trim() === '') {
            setFilteredVendors(vendors);
        } else {
            const lower = query.toLowerCase();
            setFilteredVendors(
                vendors.filter(
                    (v) =>
                        v.name.toLowerCase().includes(lower) ||
                        v.email.toLowerCase().includes(lower) ||
                        v.contact_number.includes(lower) ||
                        (v.company_name && v.company_name.toLowerCase().includes(lower))
                )
            );
        }
    };

    const openAddForm = () => {
        setEditingVendorId(null);
        setFormData(emptyForm);
        setShowForm(true);
    };

    const openEditForm = (vendor) => {
        setFormData({
            name: vendor.name,
            email: vendor.email,
            contact_number: vendor.contact_number,
            company_name: vendor.company_name || '',
            address: vendor.address || '',
            city: vendor.city || '',
            state: vendor.state || '',
            country: vendor.country || '',
            postal_code: vendor.postal_code || '',
            website: vendor.website || '',
            tax_id: vendor.tax_id || '',
        });
        setEditingVendorId(vendor.id);
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingVendorId(null);
        setFormData(emptyForm);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.contact_number) {
            toast.error('Name, Email, and Contact Number are required');
            return;
        }
        try {
            if (editingVendorId) {
                const updated = await vendorService.updateVendor(editingVendorId, formData);
                setVendors((prev) => prev.map((v) => (v.id === editingVendorId ? updated : v)));
                setFilteredVendors((prev) => prev.map((v) => (v.id === editingVendorId ? updated : v)));
                toast.success('Vendor updated successfully');
            } else {
                const created = await vendorService.createVendor(formData);
                setVendors((prev) => [...prev, created]);
                setFilteredVendors((prev) => [...prev, created]);
                toast.success('Vendor created successfully');
            }
            closeForm();
        } catch (err) {
            console.error('Error saving vendor:', err);
            toast.error(err.detail || 'Failed to save vendor');
        }
    };

    const handleDelete = async (vendorId) => {
        if (!window.confirm('Are you sure you want to delete this vendor?')) return;
        try {
            await vendorService.deleteVendor(vendorId);
            setVendors((prev) => prev.filter((v) => v.id !== vendorId));
            setFilteredVendors((prev) => prev.filter((v) => v.id !== vendorId));
            toast.success('Vendor deleted successfully');
        } catch (err) {
            console.error('Error deleting vendor:', err);
            toast.error(err.detail || 'Failed to delete vendor');
        }
    };

    const handleToggleStatus = async (vendorId) => {
        try {
            const updated = await vendorService.toggleVendorStatus(vendorId);
            setVendors((prev) => prev.map((v) => (v.id === vendorId ? updated : v)));
            setFilteredVendors((prev) => prev.map((v) => (v.id === vendorId ? updated : v)));
            toast.success(`Vendor ${updated.is_active ? 'activated' : 'deactivated'} successfully`);
        } catch (err) {
            console.error('Error toggling vendor status:', err);
            toast.error(err.detail || 'Failed to toggle vendor status');
        }
    };

    return (
        <div className="page-container">
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="back-button"
                        >
                            <svg fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M15 19l-7-7 7-7"></path>
                            </svg>
                            Back to Dashboard
                        </button>
                        <div>
                            <h1 className="page-title">Manage Vendors</h1>
                            <p className="page-description">Add, edit, and manage your vendors</p>
                        </div>
                    </div>

                    {/* Search + Add */}
                    <div className="search-section">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search by name, email, or contact..."
                        />
                        <button
                            onClick={openAddForm}
                            className="app-modal-btn app-modal-btn--success"
                            disabled={showForm && !editingVendorId}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '1rem', height: '1rem' }} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Add Vendor
                        </button>
                    </div>

                    {activeSearchQuery && (
                        <div className="search-results-info">
                            <p className="search-results-text">
                                Found {filteredVendors.length} result{filteredVendors.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}

                    {/* Add / Edit Form */}
                    {showForm && (
                        <div className="form-section">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 className="form-section-heading">
                                    {editingVendorId ? 'Edit Vendor' : 'Add New Vendor'}
                                </h3>
                                <button onClick={closeForm} className="app-modal-btn app-modal-btn--secondary">
                                    <X size={16} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmitForm}>
                                <p className="form-section-description">Required Information</p>
                                <div className="form-grid form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Vendor Name <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="text" name="name" value={formData.name} onChange={handleFormChange} required placeholder="Enter vendor name" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="email" name="email" value={formData.email} onChange={handleFormChange} required placeholder="Enter vendor email" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Number <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleFormChange} required placeholder="Enter contact number" className="form-input" />
                                    </div>
                                </div>

                                <p className="form-section-description">Business Information (Optional)</p>
                                <div className="form-grid form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Company Name</label>
                                        <input type="text" name="company_name" value={formData.company_name} onChange={handleFormChange} placeholder="Enter company name" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input type="url" name="website" value={formData.website} onChange={handleFormChange} placeholder="https://example.com" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">GST No.</label>
                                        <input type="text" name="tax_id" value={formData.tax_id} onChange={handleFormChange} placeholder="Enter GST No." className="form-input" />
                                    </div>
                                </div>

                                <p className="form-section-description">Address (Optional)</p>
                                <div className="form-grid form-grid-2">
                                    <div className="form-group full-width">
                                        <label className="form-label">Street Address</label>
                                        <input type="text" name="address" value={formData.address} onChange={handleFormChange} placeholder="Enter street address" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">City</label>
                                        <input type="text" name="city" value={formData.city} onChange={handleFormChange} placeholder="Enter city" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">State</label>
                                        <input type="text" name="state" value={formData.state} onChange={handleFormChange} placeholder="Enter state" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Country</label>
                                        <input type="text" name="country" value={formData.country} onChange={handleFormChange} placeholder="Enter country" className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Postal Code</label>
                                        <input type="text" name="postal_code" value={formData.postal_code} onChange={handleFormChange} placeholder="Enter postal code" className="form-input" />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button type="submit" className="app-modal-btn app-modal-btn--success">
                                        <Save size={16} />
                                        {editingVendorId ? 'Update Vendor' : 'Create Vendor'}
                                    </button>
                                    <button type="button" onClick={closeForm} className="app-modal-btn app-modal-btn--secondary">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="error-icon" />
                                <p>{error}</p>
                            </div>
                            <button onClick={fetchVendors} className="app-modal-btn app-modal-btn--secondary">Retry</button>
                        </div>
                    )}

                    {/* Table / Loading */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner-icon" />
                            <p className="loading-text">Loading vendors...</p>
                        </div>
                    ) : (
                        <div className="table-primary-container">
                            {filteredVendors.length === 0 ? (
                                <div className="admin-empty-state">
                                    <div className="admin-empty-state-icon">&#127978;</div>
                                    <h3 className="admin-empty-state-title">
                                        {activeSearchQuery ? 'No vendors found' : 'No vendors yet'}
                                    </h3>
                                    <p className="admin-empty-state-description">
                                        {activeSearchQuery
                                            ? 'Try adjusting your search criteria'
                                            : 'Add your first vendor to get started'}
                                    </p>
                                    {!activeSearchQuery && (
                                        <button onClick={openAddForm} className="app-modal-btn app-modal-btn--success">
                                            Add First Vendor
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="table-primary-wrapper">
                                    <table className="table-primary">
                                        <thead className="table-primary-header">
                                            <tr>
                                                <th className="table-primary-th table-primary-th-center">Sr. No.</th>
                                                <th className="table-primary-th">Name / Company</th>
                                                <th className="table-primary-th">Email</th>
                                                <th className="table-primary-th">Contact</th>
                                                <th className="table-primary-th">Location</th>
                                                <th className="table-primary-th table-primary-th-center">Status</th>
                                                <th className="table-primary-th table-primary-th-center">Added</th>
                                                <th className="table-primary-th table-primary-th-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="table-primary-body">
                                            {filteredVendors.map((vendor, index) => (
                                                <tr key={vendor.id} className="table-primary-row">
                                                    <td className="table-primary-td table-primary-td-center">{index + 1}</td>
                                                    <td className="table-primary-td">
                                                        <div className="table-primary-cell-name">
                                                            <span className="table-primary-cell-name-text">{vendor.name}</span>
                                                            {vendor.company_name && (
                                                                <span className="table-primary-cell-subtitle">{vendor.company_name}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="table-primary-td">{vendor.email}</td>
                                                    <td className="table-primary-td">{vendor.contact_number}</td>
                                                    <td className="table-primary-td">
                                                        {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(', ') || '\u2014'}
                                                    </td>
                                                    <td className="table-primary-td table-primary-td-center">
                                                        <span className={`admin-badge ${vendor.is_active ? 'admin-badge-success' : 'admin-badge-error'}`}>
                                                            {vendor.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="table-primary-td table-primary-td-center">
                                                        {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : '\u2014'}
                                                    </td>
                                                    <td className="table-primary-td table-primary-td-center">
                                                        <div className="vendor-actions">
                                                            <button onClick={() => openEditForm(vendor)} className="vendor-btn vendor-btn--edit" title="Edit vendor">
                                                                <Edit3 size={15} />
                                                            </button>
                                                            <button onClick={() => handleToggleStatus(vendor.id)} className={`vendor-btn ${vendor.is_active ? 'vendor-btn--deactivate' : 'vendor-btn--activate'}`} title={vendor.is_active ? 'Deactivate' : 'Activate'}>
                                                                {vendor.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                                            </button>
                                                            <button onClick={() => handleDelete(vendor.id)} className="vendor-btn vendor-btn--delete" title="Delete vendor">
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    {!loading && filteredVendors.length > 0 && (
                        <div className="page-summary">
                            Showing {filteredVendors.length} of {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminVendors;
