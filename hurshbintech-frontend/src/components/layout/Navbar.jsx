import React, { useState } from "react";
import { LogOut, LogIn, Menu, X, Home } from "lucide-react";
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
  const isCoachPage = location.pathname.includes("/coach/dashboard");
  const isLearnerPage = location.pathname.includes("/learner/dashboard");

  // Helper function to close menu on navigation
  const handleNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  // Define role-specific navigation
  const getRoleNavigation = () => {
    if (!user) return null;

    const navConfig = {
      admin: {
        label: 'Admin',
        path: '/admin/dashboard',
        isActive: isAdminPage
      },
      head: {
        label: 'Head',
        path: '/head/dashboard',
        isActive: isHeadPage
      },
      trainer: {
        label: 'Trainer',
        path: '/trainer/dashboard',
        isActive: isTrainerPage
      },
      coach: {
        label: 'Coach',
        path: '/coach/dashboard',
        isActive: isCoachPage
      },
      learner: {
        label: 'Learner',
        path: '/learner/dashboard',
        isActive: isLearnerPage
      }
    };

    return navConfig[user.role];
  };

  const roleNav = getRoleNavigation();

  return (
    <nav className="navbar" onDragStart={(e) => e.preventDefault()} onDragOver={(e) => e.preventDefault()}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <h1 className="navbar-title" onClick={() => handleNavigate("/")} >
            {location.pathname !== "/" && <Home className="w-5 h-5" />}
            HurshBinTech
          </h1>

          <div className="navbar-nav navbar-nav-desktop">
            {/* Role-specific dashboard link - Only show if user is logged in */}
            {user && roleNav && (
              <button
                className={`navbar-btn ${roleNav.isActive ? "active" : ""}`}
                onClick={() => handleNavigate(roleNav.path)}
              >
                {roleNav.label}
              </button>
            )}


          </div>
        </div>

        <div className="navbar-actions">
          <div className="navbar-actions-desktop">
            {!user ? (
              <button
                className="navbar-btn login-btn"
                onClick={() => navigate("/login")}
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            ) : (
              <button
                className="navbar-btn logout-btn"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                onDragStart={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
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

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="navbar-mobile-menu">
            {/* Role-specific landing link - Only show if user is logged in */}
            {user && roleNav && (
              <button
                className={`navbar-btn ${roleNav.isActive ? "active" : ""}`}
                onClick={() => handleNavigate(roleNav.path)}
              >
                {roleNav.label}
              </button>
            )}

           
            {/* Blogs link - Always visible */}
           

            {/* Admin Blog Management - Only for admins */}
            {user && user.role === 'admin' && (
              <button
                className={`navbar-btn ${location.pathname.includes("/admin/blogs") ? "active" : ""}`}
                onClick={() => handleNavigate("/admin/blogs")}
              >
                Manage Blogs
              </button>
            )}

            {/* Login Button */}
            {!user && (
              <button
                className="navbar-btn"
                onClick={() => handleNavigate("/login")}
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}

            {/* Logout Button */}
            {user && (
              <button
                className="navbar-btn"
                onClick={(e) => {
                  e.preventDefault();
                  handleLogout();
                }}
                onDragStart={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;