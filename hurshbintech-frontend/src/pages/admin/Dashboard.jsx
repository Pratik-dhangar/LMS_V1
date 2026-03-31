import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Users2, BookOpen, Target, Award, GraduationCap, Video, FileText, Info, ShoppingCart, CreditCard, Lightbulb, Gift, MessageSquare, Package, Mail, UserCircle, Store } from 'lucide-react';
import '../../styles/admin/index.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: '0.1', title: 'My Profile', description: 'View and manage your profile', icon: UserCircle, color: 'violet', onClick: () => navigate('/admin/profile') },
    { id: '0.2', title: 'Manage Vendors', description: 'Add, edit, and manage vendors', icon: Store, color: 'teal', onClick: () => navigate('/admin/vendors') },
    { id: '1.1', title: 'Manage HurshBin Heads', description: 'Register and manage HurshBin Heads', icon: Users2, color: 'amber', onClick: () => navigate('/admin/manage-heads') },
    { id: '1.2', title: 'View HurshBin Trainers', description: 'View and manage HurshBin Trainers', icon: GraduationCap, color: 'green', onClick: () => navigate('/admin/view-trainers') },
    { id: '1.3', title: 'View Learners', description: 'View all learners and their learning progress', icon: Users, color: 'blue', onClick: () => navigate('/admin/manage-learners') },
    { id: '1.4', title: 'Manage Learning Content', description: 'View and manage learning content', icon: BookOpen, color: 'purple', onClick: () => navigate('/admin/learning-content') },
    { id: '1.5', title: 'Manage Learning Goals and Learning Skill', description: 'Create and manage learning goals', icon: Target, color: 'orange', onClick: () => navigate('/admin/learning-goals') },
    { id: '1.6', title: 'Manage HurshBin Coaches', description: 'Manage HurshBin Coaches and Consultants', icon: Award, color: 'teal', onClick: () => navigate('/admin/manage-coaches') },
    { id: '2.1', title: 'Training Module', description: 'Create and manage role-targeted training assignments', icon: Lightbulb, color: 'amber', onClick: () => navigate('/admin/assigned-trainings') },
    { id: '1.7', title: 'Manage Vlogs', description: 'Upload and manage training video content', icon: Video, color: 'red', onClick: () => navigate('/admin/vlogs') },
    { id: '1.8', title: 'Manage Blogs', description: 'Create and manage blog posts', icon: FileText, color: 'indigo', onClick: () => navigate('/admin/blogs') },
    { id: '1.9', title: 'Manage About Us', description: 'Edit About Us page content', icon: Info, color: 'cyan', onClick: () => navigate('/admin/about-us') },
    { id: '1.9b', title: 'Contact Submissions', description: 'View and manage contact form submissions', icon: Mail, color: 'pink', onClick: () => navigate('/admin/contacts') },
    { id: '1.10', title: 'MarketPlace Inventory', description: 'Add, edit, and manage learning material products', icon: ShoppingCart, color: 'green', onClick: () => navigate('/admin/manage-learning-materials') },
    { id: '1.11', title: 'MarketPlace Orders', description: 'Verify customer payments and approve orders', icon: CreditCard, color: 'indigo', onClick: () => navigate('/admin/payment-verification') },
    { id: '3.1', title: 'Manage Learning Packages', description: 'Create and manage subscription packages for learners', icon: Package, color: 'orange', onClick: () => navigate('/admin/subscriptions/packages') },
    { id: '3.2', title: 'Manage Discount Codes', description: 'Create and manage discount codes for subscriptions', icon: Gift, color: 'violet', onClick: () => navigate('/admin/subscriptions/discounts') },
    { id: '3.3', title: 'Manage Payment Records', description: 'View all learner subscriptions and their details', icon: BookOpen, color: 'amber', onClick: () => navigate('/admin/subscriptions/records') }
  ];

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Admin Dashboard
            </h1>
          </div>

          {/* Admin Menu */}
          <div className="admin-dashboard-menu">


            <div className="admin-menu-grid">
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className={`admin-menu-card`}
                    style={{ '--i': index }}
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
    </div>
  );
};

export default AdminDashboard;
