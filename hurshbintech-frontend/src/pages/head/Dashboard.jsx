// Head Dashboard Page

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, BookOpen, MessageSquare, UserCog, BarChart3, Calendar, CreditCard } from 'lucide-react';
import '../../styles/admin/index.css';

// Head Dashboard Component
const HeadDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: '1', title: 'Manage Trainers', description: 'Register and manage HurshBin Trainers', icon: UserCog, onClick: () => navigate('/head/manage-trainers') },
    { id: '2', title: 'Manage Learners', description: 'View and manage learner profiles, assessments, and progress', icon: Users, onClick: () => navigate('/head/manage-learners') },
    { id: '3', title: 'Manage Trainings', description: 'View and manage learner profiles, programs, and assessments', icon: BookOpen, onClick: () => navigate('/head/manage-sessions') },
    { id: '4', title: 'Manage Learner Subscriptions', description: 'Assign and manage learner subscriptions', icon: CreditCard, onClick: () => navigate('/head/subscriptions/learners') },
    { id: '5', title: 'Manage Home Program', description: 'Assign and manage learning programs for learners', icon: BookOpen, onClick: () => navigate('/head/manage-program-assignments') },
    { id: '6', title: 'Session Reports', description: 'View and analyze learner session reports and progress', icon: BarChart3, onClick: () => navigate('/head/reports') },
    { id: '7', title: 'Book Appointment with Coach', description: 'Schedule appointments with HurshBin Coaches/Consultants', icon: Calendar, onClick: () => navigate('/book-appointment') },
  ];

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Head Dashboard
            </h1>
            <div className="admin-dashboard-welcome">
              Welcome, <span className="admin-dashboard-welcome-name">{user?.name || 'Head'}</span>!
            </div>
          </div>

          {/* Head Menu */}
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

export default HeadDashboard;
