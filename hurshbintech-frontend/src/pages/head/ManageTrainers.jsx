// ManageTrainers.jsx - view and manage all registered trainers

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {            
  Users,         
  Edit3,         
  AlertCircle,   
  Loader2        
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import headService from '../../api/services/headService';
import SearchBar from '../../components/common/SearchBar';


// ManageTrainers Component
const ManageTrainers = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();

  // State management for trainer data and filtering
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);    
  const [loading, setLoading] = useState(true);              
  const [activeSearchQuery, setActiveSearchQuery] = useState('');        
  const [error, setError] = useState('');

  // Fetch trainers data when component mounts
  useEffect(() => {
    fetchTrainers();
  }, []);

  
  // Fetch all trainers from the server
  const fetchTrainers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await headService.getAllTrainers();
      setTrainers(data);
      setFilteredTrainers(data);
    } catch (err) {
      console.error('Error fetching trainers:', err);
      setError('Failed to load trainers. Please try again.');
      toast.error('Failed to load trainers', {
        position: "top-center",
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navigates to the edit page for a specific trainer
   * 
   * @param {number} trainerId - The unique identifier of the trainer to edit
   */
  const handleEditTrainer = (trainerId) => {
    navigate(`/head/edit-trainer/${trainerId}`);
  };

  /**
   * Filters trainers based on search query (triggered by Search button click)
   * 
   * @param {string} query - The search query from SearchBar component
   */
  const handleSearch = (query) => {
    setActiveSearchQuery(query);
    if (query.trim() === '') {
      setFilteredTrainers(trainers);
    } else {
      const lowerQuery = query.toLowerCase();
      const filtered = trainers.filter(trainer => 
        trainer.name.toLowerCase().includes(lowerQuery) ||
        trainer.passcode.toLowerCase().includes(lowerQuery) ||
        (trainer.contact_no && trainer.contact_no.toLowerCase().includes(lowerQuery))
      );
      setFilteredTrainers(filtered);
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
              Manage HurshBin Trainers
            </h1>
            <p className="text-gray-600 mt-2">View and manage all registered trainers</p>
          </div>

          {/* Search Bar and Add New Trainer Button */}
          <div className="mb-8 flex justify-center items-center gap-4">
            
            <SearchBar 
              onSearch={handleSearch} 
              placeholder="Search by name, passcode, contact number..." 
            />
            <button
              onClick={() => navigate('/head/register-trainer')}
              className="bg-[#27ae60] hover:bg-[#229954] text-white py-3 px-5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add New Trainer
            </button>
          </div>
          {activeSearchQuery && (
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600">
                Found {filteredTrainers.length} result{filteredTrainers.length !== 1 ? 's' : ''}
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
              <p className="text-gray-600 font-medium">Loading trainers...</p>
            </div>
          ) : (
            /* Table */
            <div className="bg-white rounded-lg shadow-sm overflow-hidden border-2 border-gray-300">
              {filteredTrainers.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    {activeSearchQuery ? 'No trainers found' : 'No trainers registered yet'}
                  </p>
                  <p className="text-gray-500">
                    {activeSearchQuery 
                      ? 'Try adjusting your search criteria'
                      : 'Register your first trainer to get started'
                    }
                  </p>
                  {!activeSearchQuery && (
                    <button
                      onClick={() => navigate('/head/register-trainer')}
                      className="mt-4 px-6 py-2 bg-[#27ae60] text-white rounded-lg font-medium hover:bg-[#229954] transition-colors"
                    >
                      Register Trainer
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#34495e] text-white">
                      <tr>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Sr. No.
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Name
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Passcode
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Contact Number
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Date Joined
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider border border-gray-400">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTrainers.map((trainer, index) => (
                        <tr 
                          key={trainer.id} 
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-700 font-medium border border-gray-300">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap border border-gray-300">
                            <div className="text-sm font-medium text-gray-900">{trainer.name}</div>
                            <div className="text-xs text-gray-500">{trainer.role}</div>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap border border-gray-300">
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {trainer.passcode}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                            {trainer.contact_no || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-700 border border-gray-300">
                            {trainer.date_of_joining
                              ? new Date(trainer.date_of_joining).toLocaleDateString()
                              : 'N/A'
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center border border-gray-300">
                            <button
                              onClick={() => handleEditTrainer(trainer.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-[#3498db] text-white text-sm font-medium rounded-lg hover:bg-[#2980b9] transition-colors shadow-md hover:shadow-lg"
                            >
                              <Edit3 className="w-4 h-4" />
                              Edit Profile
                            </button>
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
          {!loading && filteredTrainers.length > 0 && (
            <div className="mt-6 text-sm text-gray-600 text-center">
              Showing {filteredTrainers.length} of {trainers.length} trainer{trainers.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ManageTrainers;