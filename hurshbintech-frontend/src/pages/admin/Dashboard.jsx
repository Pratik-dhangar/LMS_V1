import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import adminService from '../../api/services/adminService';
import { Users, Users2, BookOpen, Target, Award, GraduationCap, Video, FileText, Info, ShoppingCart, CreditCard } from 'lucide-react';
import '../../styles/admin/index.css';

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
    { id: '1.1', title: 'Manage HurshBin Heads', description: 'Register and manage HurshBin Heads', icon: Users2, color: 'blue', onClick: () => navigate('/admin/manage-heads') },
    { id: '1.2', title: 'View HurshBin Trainers', description: 'View and manage HurshBin Trainers', icon: GraduationCap, color: 'green', onClick: () => navigate('/admin/view-trainers') },
    { id: '1.6', title: 'View HurshBin Learners', description: 'View and manage HurshBin Learners', icon: Users, color: 'pink', onClick: () => navigate('/admin/view-learners') },
    { id: '1.3', title: 'Manage Learning Content', description: 'View and manage learning content', icon: BookOpen, color: 'purple', onClick: () => navigate('/admin/learning-content') },
    { id: '1.4', title: 'Manage Learning Goals', description: 'Create and manage learning goals', icon: Target, color: 'orange', onClick: () => navigate('/admin/learning-goals') },
    { id: '1.5', title: 'Manage HurshBin Coaches', description: 'Manage HurshBin Coaches and Consultants', icon: Award, color: 'teal', onClick: () => navigate('/admin/manage-coaches') },
    { id: '1.7', title: 'Manage Vlogs', description: 'Upload and manage training video content', icon: Video, color: 'red', onClick: () => navigate('/admin/vlogs') },
    { id: '1.8', title: 'Manage Blogs', description: 'Create and manage blog posts', icon: FileText, color: 'indigo', onClick: () => navigate('/admin/blogs') },
    { id: '1.9', title: 'Manage About Us', description: 'Edit About Us page content', icon: Info, color: 'cyan', onClick: () => navigate('/admin/about-us') },
    { id: '1.10', title: 'Manage Learning Materials', description: 'Add, edit, and manage learning material products', icon: ShoppingCart, color: 'green', onClick: () => navigate('/admin/manage-learning-materials') },
    { id: '1.11', title: 'Order Management', description: 'Verify customer payments and approve orders', icon: CreditCard, color: 'indigo', onClick: () => navigate('/admin/payment-verification') },
  ];

  return (
    <div className="admin-dashboard-container">
      <Navbar />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Admin Dashboard
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="admin-stats-grid">
            {loading ? (
              <div className="admin-stat-loading">
                Loading stats...
              </div>
            ) : error ? (
              <div className="admin-stat-error">
                {error}
              </div>
            ) : (
              <>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Total Users</div>
                  <div className="admin-stat-value admin-stat-value-blue">{stats.total_users}</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Active Sessions Today</div>
                  <div className="admin-stat-value admin-stat-value-green">{stats.active_sessions}</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-label">Total Trainers</div>
                  <div className="admin-stat-value admin-stat-value-red">{stats.total_trainers}</div>
                </div>
              </>
            )}
          </div>

          {/* Admin Menu */}
          <div className="admin-dashboard-menu">
            <div className="admin-menu-title">
              <h2>Admin Menu - Click to Open</h2>
            </div>

            <div className="admin-menu-grid">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className={`admin-menu-card`}
                  >
                    <div className="admin-menu-card-icon">
                      <IconComponent size={48} />
                    </div>
                    <h3 className="admin-menu-card-title">
                      {item.title}
                    </h3>
                    <p className="admin-menu-card-description">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
