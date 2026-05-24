import React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import trainerService from "../../api/services/trainerService";
import { CalendarDays, CalendarPlus2 } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import '../../styles/ManageUsersLayout.css';
import '../../styles/trainer/Dashboard.css';
import '../../styles/admin/index.css';

const TrainerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [canScheduleIlp, setCanScheduleIlp] = useState(false);

  useEffect(() => {
    const loadPermission = async () => {
      try {
        const response = await trainerService.getIlpPermission();
        setCanScheduleIlp(!!response?.can_trainers_schedule_ilp);
      } catch {
        setCanScheduleIlp(false);
      }
    };

    loadPermission();
  }, []);

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          <div className="trainer-dashboard-hero admin-dashboard-header">
            <div>
              <h1 className="admin-dashboard-title">Trainer Dashboard</h1>
              <div className="admin-dashboard-welcome">
                Welcome, <span className="admin-dashboard-welcome-name">{user?.name || "Trainer"}</span>!
              </div>
            </div>
          </div>

          <div className="admin-dashboard-menu">
            <div className="admin-menu-grid trainer-dashboard-grid">
              <div
                className="admin-menu-card"
                onClick={() => navigate('/trainer/sessions')}
                style={{ '--i': 0 }}
              >
                <div className="admin-menu-card-icon">
                  <CalendarDays size={48} />
                </div>
                <h3 className="admin-menu-card-title">Today Schedule</h3>
                <p className="admin-menu-card-description">All upcoming and active sessions for today appear here.</p>
              </div>

              <div className="trainer-dashboard-schedule-block">
                <div
                  className="admin-menu-card"
                  onClick={() => navigate('/trainer/schedule')}
                  style={{ '--i': 1 }}
                >
                  <div className="admin-menu-card-icon">
                    <CalendarPlus2 size={48} />
                  </div>
                  <h3 className="admin-menu-card-title">Schedule ILP</h3>
                  <p className="admin-menu-card-description">
                    {canScheduleIlp
                      ? 'Open the same full session creation flow as the Head dashboard.'
                      : 'This feature is disabled until your Head enables trainer ILP scheduling.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrainerDashboard;
