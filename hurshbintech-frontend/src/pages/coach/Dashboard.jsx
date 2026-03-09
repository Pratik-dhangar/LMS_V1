import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, Settings, FileText } from 'lucide-react';
import '../../styles/admin/index.css';
import '../../styles/coach/dashboard.css';

const CoachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: '1', title: 'My Appointments', description: 'View and manage appointments scheduled by clients', icon: Calendar, onClick: () => navigate('/coach/appointments') },
    { id: '2', title: 'Manage Sessions', description: 'Create and manage group coaching sessions', icon: Clock, onClick: () => navigate('/coach/sessions') },
    { id: '3', title: 'My Availability', description: 'Set availability and manage time slots', icon: Settings, onClick: () => navigate('/coach/availability') },
    { id: '4', title: 'Manage Learning Reports', description: 'View learner reports and generate progress reports', icon: FileText, onClick: () => navigate('/coach/learning-reports') },
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
          <div className="coach-dashboard-menu-wrapper">
            <div className="coach-menu-grid">
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className="coach-menu-card"
                  >
                    <div className="coach-menu-card-icon">
                      <IconComponent size={56} strokeWidth={1.5} />
                    </div>
                    <h3 className="coach-menu-card-title">
                      {item.title}
                    </h3>
                    <p className="coach-menu-card-description">
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
