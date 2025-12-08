// ViewConsultants.jsx - Admin view of all registered consultants/coaches (read-only)

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
    Users,
    AlertCircle,
    Loader2,
    Eye,
    EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import SearchBar from '../../components/common/SearchBar';
import '../../styles/Pages.css';


// ViewConsultants Component - Admin can view all consultants (no edit capability)
const ViewConsultants = () => {
    const { user: _user } = useAuth();

    // State management for consultant data and filtering
    const [consultants, setConsultants] = useState([]);
    const [filteredConsultants, setFilteredConsultants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSearchQuery, setActiveSearchQuery] = useState('');
    const [error, setError] = useState('');
    const [visiblePasscodes, setVisiblePasscodes] = useState({});

    // Fetch consultants data when component mounts
    useEffect(() => {
        fetchConsultants();
    }, []);


    // Fetch all consultants from the server
    const fetchConsultants = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await adminService.getAllConsultants();
            setConsultants(data);
            setFilteredConsultants(data);
        } catch (err) {
            console.error('Error fetching consultants:', err);
            setError('Failed to load consultants. Please try again.');
            toast.error('Failed to load consultants');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Filters consultants based on search query (triggered by Search button click)
     * 
     * @param {string} query - The search query from SearchBar component
     */
    const handleSearch = (query) => {
        setActiveSearchQuery(query);
        if (query.trim() === '') {
            setFilteredConsultants(consultants);
        } else {
            const lowerQuery = query.toLowerCase();
            const filtered = consultants.filter(consultant =>
                consultant.name.toLowerCase().includes(lowerQuery) ||
                consultant.passcode.toLowerCase().includes(lowerQuery) ||
                (consultant.contact_no && consultant.contact_no.toLowerCase().includes(lowerQuery))
            );
            setFilteredConsultants(filtered);
        }
    };

    /**
     * Toggle passcode visibility for a specific consultant
     * @param {number} consultantId - The consultant ID (profile ID)
     * @param {number} userId - The user ID
     */
    const togglePasscodeVisibility = async (consultantId, userId) => {
        const currentlyVisible = !!visiblePasscodes[consultantId];
        if (currentlyVisible) {
            setVisiblePasscodes(prev => ({ ...prev, [consultantId]: false }));
            return;
        }

        try {
            const resp = await adminService.revealPasscode(userId);
            setVisiblePasscodes(prev => ({ ...prev, [consultantId]: resp.passcode }));
        } catch (err) {
            console.error('Failed to reveal passcode for consultant', consultantId, err);
            toast.error('Failed to reveal passcode');
            setVisiblePasscodes(prev => ({ ...prev, [consultantId]: false }));
        }
    };

    return (
        <div className="page-container">
            <Navbar />
            <main className="page-main">
                <div className="page-content">
                    {/* Header */}
                    <div className="page-header">

                        <h1 className="page-title">
                            View HurshBin Coaches/Consultants
                        </h1>
                        <p className="page-description">View all registered coaches/consultants in the system</p>
                    </div>

                    {/* Search Bar */}
                    <div className="search-section">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search by name, passcode, contact number..."
                        />
                    </div>
                    {activeSearchQuery && (
                        <div className="search-results-info">
                            <p className="search-results-text">
                                Found {filteredConsultants.length} result{filteredConsultants.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            <div className="error-message-content">
                                <AlertCircle className="error-icon" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="loading-container">
                            <Loader2 className="loading-spinner-icon" />
                            <p className="loading-text">Loading consultants...</p>
                        </div>
                    ) : (
                        /* Table */
                        <div className="data-table-container">
                            {filteredConsultants.length === 0 ? (
                                <div className="empty-state">
                                    <Users className="empty-state-icon" />
                                    <p className="empty-state-title">
                                        {activeSearchQuery ? 'No consultants found' : 'No consultants registered yet'}
                                    </p>
                                    <p className="text-gray-500">
                                        {activeSearchQuery
                                            ? 'Try adjusting your search criteria'
                                            : 'No consultants have been registered in the system'
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="admin-table-container">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th className="admin-table-th">
                                                    Sr. No.
                                                </th>
                                                <th className="admin-table-th">
                                                    Name
                                                </th>
                                                <th className="admin-table-th">
                                                    Passcode
                                                </th>
                                                <th className="admin-table-th">
                                                    Contact Number
                                                </th>
                                                <th className="admin-table-th">
                                                    Date Joined
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredConsultants.map((consultant, index) => (
                                                <tr key={consultant.id}>
                                                    <td className="admin-table-td admin-table-td-center">
                                                        {index + 1}
                                                    </td>
                                                    <td className="admin-table-td">
                                                        <div className="data-table-name">{consultant.name}</div>
                                                        <div className="data-table-subtext">{consultant.role}</div>
                                                    </td>
                                                    <td className="admin-table-td">
                                                        <div className="passcode-container">
                                                            <span className="passcode-badge">
                                                                {visiblePasscodes[consultant.id] ? visiblePasscodes[consultant.id] : '••••••'}
                                                            </span>
                                                            <button
                                                                onClick={() => togglePasscodeVisibility(consultant.id, consultant.user_id)}
                                                                className="passcode-toggle-btn"
                                                                title={visiblePasscodes[consultant.id] ? 'Hide passcode' : 'Show passcode'}
                                                            >
                                                                {visiblePasscodes[consultant.id] ? (
                                                                    <EyeOff className="icon-sm" />
                                                                ) : (
                                                                    <Eye className="icon-sm" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="admin-table-td">
                                                        {consultant.contact_no || 'N/A'}
                                                    </td>
                                                    <td className="admin-table-td">
                                                        {consultant.date_of_joining
                                                            ? new Date(consultant.date_of_joining).toLocaleDateString()
                                                            : 'N/A'
                                                        }
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
                    {!loading && filteredConsultants.length > 0 && (
                        <div className="page-summary">
                            Showing {filteredConsultants.length} of {consultants.length} consultant{consultants.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default ViewConsultants;
