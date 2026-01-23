import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Calendar, MessageSquare, ShoppingCart, GraduationCap, User } from 'lucide-react';
import '../../styles/ManageUsersLayout.css';

const TrainerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      id: '1',
      title: 'IIP Programs',
      description: "View today's schedule and manage sessions",
      icon: GraduationCap,
      onClick: () => navigate('/trainer/schedule')
    },
    {
      id: '4',
      title: 'Buy Learning Material',
      description: 'Browse and purchase learning resources',
      icon: ShoppingCart,
      onClick: () => navigate('/store')
    },
    {
      id: '5',
      title: 'Learning Material Purchase History',
      description: 'View your profile and manage orders',
      icon: User,
      onClick: () => navigate('/trainer/profile-order-history')
    },
    {
      id: '2',
      title: 'Communication',
      description: 'Send messages and communicate with team',
      icon: MessageSquare,
      onClick: () => navigate('/trainer/communication')
    },
  ];

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Trainer Dashboard
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || "Trainer"}</span>!
            </div>
          </div>

         
          {/* Trainer Menu */}
          <div className="admin-dashboard-menu">
            

            <div className="admin-menu-grid">
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className="admin-menu-card"
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

export default TrainerDashboard;
