import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, Settings } from 'lucide-react';
import '../../styles/admin/index.css';

const CoachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: '1', title: 'My Appointments', description: 'View and manage appointments scheduled by clients', icon: Calendar, onClick: () => navigate('/coach/appointments') },
    { id: '2', title: 'Manage Sessions', description: 'Create and manage group coaching sessions', icon: Clock, onClick: () => navigate('/coach/sessions') },
    { id: '3', title: 'My Availability', description: 'Set availability and manage time slots', icon: Settings, onClick: () => navigate('/coach/availability') },
    { id: '4', title: 'Learning Material Purchase History', description: 'View your learning material purchase history', icon: Calendar, onClick: () => navigate('/coach/profile-order-history') },
  ];



  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Coach Dashboard
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || 'Coach'}</span>!
            </div>
          </div>

          {/* Coach Menu */}
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

export default CoachDashboard;
