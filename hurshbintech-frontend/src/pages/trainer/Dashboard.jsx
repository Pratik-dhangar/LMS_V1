import React from "react";
import { useNavigate } from "react-router-dom";
import TodaysSchedule from "./TodaysSchedule";
import { useAuth } from "../../context/AuthContext";
import '../../styles/ManageUsersLayout.css';

const TrainerDashboard = () => {
  const { user } = useAuth();

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

          {/* Schedule Content */}
          <TodaysSchedule />
        </div>
      </main>
    </div>
  );
};

export default TrainerDashboard;
