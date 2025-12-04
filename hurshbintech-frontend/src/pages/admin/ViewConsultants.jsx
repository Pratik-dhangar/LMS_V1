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
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Navbar />
            <main className="flex-1">
                <div className="max-w-6xl mx-auto px-6 py-8 md:px-4 md:py-6">
                    {/* Header */}
                    <div className="mb-8">

                        <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
                            View HurshBin Coaches/Consultants
                        </h1>
                        <p className="text-gray-600 mt-2">View all registered coaches/consultants in the system</p>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-8 flex justify-center items-center">
                        <SearchBar
                            onSearch={handleSearch}
                            placeholder="Search by name, passcode, contact number..."
                        />
                    </div>
                    {activeSearchQuery && (
                        <div className="text-center mb-4">
                            <p className="text-sm text-gray-600">
                                Found {filteredConsultants.length} result{filteredConsultants.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-2 border-red-500 text-red-800 p-4 rounded-lg mb-8">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 flex flex-col items-center">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Loading consultants...</p>
                        </div>
                    ) : (
                        /* Table */
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-gray-300">
                            {filteredConsultants.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-xl font-semibold text-gray-700 mb-2">
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
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead className="bg-[#34495e] text-white">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider border border-gray-400">
                                                    Sr. No.
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider border border-gray-400">
                                                    Name
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider border border-gray-400">
                                                    Passcode
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider border border-gray-400">
                                                    Contact Number
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider border border-gray-400">
                                                    Date Joined
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {filteredConsultants.map((consultant, index) => (
                                                <tr
                                                    key={consultant.id}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium border border-gray-300">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                                                        <div className="text-sm font-medium text-gray-900">{consultant.name}</div>
                                                        <div className="text-xs text-gray-500">{consultant.role}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap border border-gray-300">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                                {visiblePasscodes[consultant.id] ? visiblePasscodes[consultant.id] : '••••••'}
                                                            </span>
                                                            <button
                                                                onClick={() => togglePasscodeVisibility(consultant.id, consultant.user_id)}
                                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                                title={visiblePasscodes[consultant.id] ? 'Hide passcode' : 'Show passcode'}
                                                            >
                                                                {visiblePasscodes[consultant.id] ? (
                                                                    <EyeOff className="w-4 h-4 text-gray-600" />
                                                                ) : (
                                                                    <Eye className="w-4 h-4 text-gray-600" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                                                        {consultant.contact_no || 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 border border-gray-300">
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
                        <div className="mt-6 text-sm text-gray-600 text-center">
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
