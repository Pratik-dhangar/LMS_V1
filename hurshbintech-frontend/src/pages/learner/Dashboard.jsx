import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import "../../styles/admin/index.css";
import orderService from "../../api/services/ecommerce/orderService";

const LearnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    {
      icon: "🎓",
      title: "Individualised Intervention Program(IIP)",
      onClick: () => navigate("/learner/my-sessions"),
    },
    {
      icon: "📚",
      title: "Home Program (HP)",
      onClick: () => navigate("/learner/assigned-programs"),
    },
    {
      icon: "📖",
      title: "Learning Content",
      onClick: () => navigate("/learner/learning-content"),
    },
    {
      icon: "🛒",
      title: "Buy Learning Material",
      onClick: () => navigate("/learner/learning-material"),
    },
    {
      icon: "💬",
      title: "Communication",
      onClick: () => navigate("/learner/communication"),
    },
    {
      icon: "📅",
      title: "Book Appointment",
      onClick: () => navigate("/book-appointment"),
    },
  ];

  return (
    <div className="admin-dashboard-container">
      <Navbar />

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
              {menuItems.map((item, index) => (
                <div
                  key={index}
                  onClick={item.onClick}
                  className="admin-menu-card"
                >
                  <div className="admin-menu-card-icon">
                    {item.icon}
                  </div>
                  <div className="admin-menu-card-title">{item.title}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LearnerDashboard;
