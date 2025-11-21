import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_users: 0,
    active_sessions: 0,
    total_trainers: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: '1.1', title: 'Manage HurshBin Heads', onClick: () => navigate('/admin/manage-heads') },
    { id: '1.2', title: 'View HurshBin Trainers', onClick: () => navigate('/admin/view-trainers') },
    { id: '1.3', title: 'Manage Learning Content', onClick: () => navigate('/admin/learning-content') },
    { id: '1.4', title: 'Manage Learning Goals', onClick: () => navigate('/admin/learning-goals') },
    { id: '1.5', title: 'View HurshBin Coaches/Consultants', onClick: () => navigate('/admin/manage-coaches') },
    { id: '1.6', title: 'View HurshBin Learners', onClick: () => navigate('/admin/view-learners') },
    { id: '1.7', title: 'Manage Training Vlogs', onClick: () => navigate('/admin/vlogs') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 m-6">
        <div className="max-w-7xl mx-auto px-6 py-8 md:px-4 md:py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl ml-2 font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
            Welcome, {user?.name}
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mb-8">
            {loading ? (
              <div className="col-span-full text-center p-8 text-blue-600 text-lg font-medium bg-white rounded-lg shadow-sm">
                Loading stats...
              </div>
            ) : error ? (
              <div className="col-span-full text-center p-8 text-red-600 text-lg font-medium bg-red-50 border-2 border-red-600 rounded-lg">
                {error}
              </div>
            ) : (
             <>
                    <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-600 font-medium mb-2">Total Users</div>
                      <div className="text-3xl md:text-4xl font-bold text-blue-600">{stats.total_users}</div>
                    </div>
                    <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-600 font-medium mb-2">Active Sessions Today</div>
                      <div className="text-3xl md:text-4xl font-bold text-green-600">{stats.active_sessions}</div>
                    </div>
                    <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-600 font-medium mb-2">Total Trainers</div>
                      <div className="text-3xl md:text-4xl font-bold text-red-500">{stats.total_trainers}</div>
                    </div>
                  </>
            )}
          </div>

          {/* Admin Menu */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 md:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Admin Menu - Click to Open</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menuItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={item.onClick}
                  className="flex items-center justify-between py-4 px-5 bg-white border-2 border-gray-200 rounded-lg cursor-pointer transition-all duration-200 hover:border-blue-500 hover:shadow-md group"
                >
                  <span className="text-gray-800 text-sm font-medium group-hover:text-blue-600">
                    {item.title}
                  </span>
                  <svg 
                    className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" 
                    fill="none" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
