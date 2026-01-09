import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import { Calendar, Clock, Settings } from 'lucide-react';
import Footer from '../../components/layout/Footer';
import coachService from '../../api/services/coachService';
import { toast } from 'react-toastify';
import '../../styles/coach/CoachDashboard.css';

const CoachDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const menuItems = [
    { id: '1', title: 'My Appointments', description: 'View and manage appointments scheduled by clients', icon: Calendar, color: 'blue', onClick: () => navigate('/coach/appointments') },
    { id: '2', title: 'Manage Sessions', description: 'Create and manage group coaching sessions', icon: Clock, color: 'green', onClick: () => navigate('/coach/sessions') },
    { id: '3', title: 'My Availability', description: 'Set availability and manage time slots', icon: Settings, color: 'purple', onClick: () => navigate('/coach/availability') },
  ];



  return (
    <div className="coach-dashboard-container">
      <Navbar />
      <main className="coach-dashboard-main">
        <div className="coach-dashboard-content-wrapper">
          {/* Header */}
          <div className="coach-dashboard-header">
            <h1 className="coach-dashboard-title">
              Coach Dashboard
            </h1>
            <div className="coach-dashboard-welcome">
              Welcome back, <span className="coach-dashboard-welcome-name">{user?.name}</span>!
            </div>
          </div>

          {/* Coach Menu */}
          <div className="coach-dashboard-menu">
            

            <div className="coach-menu-grid">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    className={`coach-menu-card coach-menu-card-${item.color}`}
                  >
                    <div className="coach-menu-card-icon">
                      <IconComponent size={48} />
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
      <Footer />
    </div>
  );
};

export default CoachDashboard;
