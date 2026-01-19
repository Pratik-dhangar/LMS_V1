import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  GraduationCap,
  BookMarked,
  BookOpen,
  ShoppingCart,
  MessageSquare,
  Calendar,
  History
} from "lucide-react";
import "../../styles/admin/index.css";

const LearnerDashboard = () => {
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: GraduationCap,
      title: "Individualised Intervention Program(IIP)",
      onClick: () => navigate("/learner/my-sessions"),
    },
    {
      icon: BookMarked,
      title: "Home Program (HP)",
      onClick: () => navigate("/learner/assigned-programs"),
    },
    {
      icon: BookOpen,
      title: "Learning Content",
      onClick: () => navigate("/learner/learning-content"),
    },
    {
      icon: ShoppingCart,
      title: "Buy Learning Material",
      onClick: () => navigate("/learner/learning-material"),
    },
    {
      icon: MessageSquare,
      title: "Communication",
      onClick: () => navigate("/learner/communication"),
    },
    {
      icon: Calendar,
      title: "Book Appointment",
      onClick: () => navigate("/book-appointment"),
    },
    {
      icon: History,
      title: "Learning Material Purchase History",
      onClick: () => navigate("/learner/profile-order-history"),
    },
  ];

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              HurshBin Learner Dashboard
            </h1>
          </div>

          {/* Menu Cards */}
          <div className="admin-dashboard-menu">
            <div className="admin-menu-grid">
              {menuItems.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={index}
                    onClick={item.onClick}
                    className="admin-menu-card"
                  >
                    <div className="admin-menu-card-icon">
                      <IconComponent size={48} strokeWidth={1.5} />
                    </div>
                    <div className="admin-menu-card-title">{item.title}</div>
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

export default LearnerDashboard;
