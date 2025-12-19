// Navbar.jsx - Updated to always render all navigation buttons

import React, { useState } from "react";
import { LogOut, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import '../../styles/components/layout/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Active page checks 
  const isDashboardPage = location.pathname.endsWith("/");
  const isAdminPage = location.pathname.includes("/admin/dashboard");
  const isHeadPage = location.pathname.includes("/head/dashboard");
  const isTrainerPage = location.pathname.includes("/trainer/dashboard");
  const isConsultantPage = location.pathname.includes("/coach/dashboard");
  const isLearnerPage = location.pathname.includes("/learner/dashboard");

  // Helper function to close menu on navigation
  const handleNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar" onDragStart={(e) => e.preventDefault()} onDragOver={(e) => e.preventDefault()}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1 className="navbar-title">
            HurshBinTech
          </h1>

          <div className="navbar-nav navbar-nav-desktop">
            <button
              className={`navbar-btn ${isDashboardPage ? "active" : ""}`}
              onClick={() => {
                navigate("/");
              }}
            >
              Dashboard
            </button>

            <button
              className={`navbar-btn ${isAdminPage ? "active" : ""}`}
              onClick={() => {
                navigate("/admin/dashboard");
              }}
              disabled={!user || user.role !== "admin"}
            >
              Admin
            </button>

            <button
              className={`navbar-btn ${isHeadPage ? "active" : ""}`}
              onClick={() => {
                navigate("/head/dashboard");
              }}
              disabled={!user || user.role !== "head"}
            >
              Head
            </button>

            <button
              className={`navbar-btn ${isTrainerPage ? "active" : ""}`}
              onClick={() => {
                navigate("/trainer/dashboard");
              }}
              disabled={!user || user.role !== "trainer"}
            >
              Trainer
            </button>

            <button
              className={`navbar-btn ${isConsultantPage ? "active" : ""}`}
              onClick={() => {
                navigate("/coach/dashboard");
              }}
              disabled={!user || user.role !== "coach"}
            >
              Coach
            </button>

            <button
              className={`navbar-btn ${isLearnerPage ? "active" : ""}`}
              onClick={() => {
                navigate("/learner/dashboard");
              }}
              disabled={!user || user.role !== "learner"}
            >
              Learner
            </button>
          </div>
        </div>

        <div className="navbar-actions">
          <div className="navbar-actions-desktop">
            <button
              className="navbar-btn login-btn"
              onClick={() => navigate("/login")}
              disabled={!!user}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>

            <button
              className="navbar-btn logout-btn"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
              onDragStart={(e) => e.preventDefault()}
              onDragOver={(e) => e.preventDefault()}
              disabled={!user}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <button
            className="navbar-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {isMenuOpen && (
          <div className="navbar-mobile-menu">
            <button
              className={`navbar-btn ${isDashboardPage ? "active" : ""}`}
              onClick={() => {
                navigate("/");
              }}
            >
              Dashboard
            </button>

            {/* Menu Admin */}
            <button
              className={`navbar-btn ${isAdminPage ? "active" : ""}`}
              onClick={() => handleNavigate("/admin/dashboard")}
              disabled={
                !user || user.role !== "admin"
              }
            >
              Admin
            </button>

            {/* Menu Head */}
            <button
              className={`navbar-btn ${isHeadPage ? "active" : ""}`}
              onClick={() => handleNavigate("/trainer/dashboard")}
              disabled={
                !user || user.role !== "head"
              }
            >
              Head
            </button>

            {/* Menu Login Button */}
            <button
              className="navbar-btn"
              onClick={() => handleNavigate("/login")}
              disabled={!!user}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>

            {/* Menu Logout Button */}

            <button
              className="navbar-btn"
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              onDragStart={(e) => e.preventDefault()}
              onDragOver={(e) => e.preventDefault()}
              disabled={!user}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
