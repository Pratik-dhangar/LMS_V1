import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import '../../styles/Dashboards.css';

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
    { id: '1.5', title: 'Manage HurshBin Coaches', onClick: () => navigate('/admin/manage-coaches') },
    { id: '1.6', title: 'View HurshBin Learners', onClick: () => navigate('/admin/view-learners') },
    { id: '1.7', title: 'Manage Training Vlogs', onClick: () => navigate('/admin/vlogs') },
  ];

  return (
    <div className="dashboard-container">
      <Navbar />
      <main className="dashboard-main">
        <div className="dashboard-content-wrapper">
          {/* Header */}
          <div className="dashboard-header">
            <h1 className="dashboard-title">
              Welcome, {user?.name}
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="stats-grid">
            {loading ? (
              <div className="stat-loading">
                Loading stats...
              </div>
            ) : error ? (
              <div className="stat-error">
                {error}
              </div>
            ) : (
              <>
                <div className="stat-card">
                  <div className="stat-label">Total Users</div>
                  <div className="stat-value stat-value-blue">{stats.total_users}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Active Sessions Today</div>
                  <div className="stat-value stat-value-green">{stats.active_sessions}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Trainers</div>
                  <div className="stat-value stat-value-red">{stats.total_trainers}</div>
                </div>
              </>
            )}
          </div>

          {/* Admin Menu */}
          <div className="dashboard-menu">
            <div className="menu-title">
              <h2>Admin Menu - Click to Open</h2>
            </div>

            <div className="menu-grid">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={item.onClick}
                  className="menu-item"
                >
                  <span className="menu-item-text">
                    {item.title}
                  </span>
                  <svg
                    className="menu-item-arrow"
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
