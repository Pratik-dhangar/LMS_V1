// Navbar.jsx - Updated to always render all navigation buttons

import React, { useState } from "react";
import { LogOut, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";

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
  const isConsultantPage = location.pathname.includes("/consultant/dashboard");
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
    <nav className="bg-[#2f4153] p-0 sticky top-0 z-[1000] shadow-md pointer-events-auto" onDragStart={(e) => e.preventDefault()} onDragOver={(e) => e.preventDefault()}>
      <div className="max-w-[1400px] mx-auto px-8 py-4 flex flex-wrap justify-between items-center">
        <div className="flex flex-col items-start">
          <h1 className="text-white text-[1.8rem] font-bold m-0 tracking-wide md:text-2xl" style={{ color: '#ffffff' }}>
            HurshBinTech
          </h1>

          <div className="hidden md:flex items-center mt-2 gap-4">
            <button
              className={` ${isDashboardPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/");
              }}
            >
              Dashboard
            </button>

            <button
              className={` ${isAdminPage ? "bg-[#3498db]" : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/admin/dashboard");
              }}
              disabled={!user || user.role !== "admin"}
            >
              Admin
            </button>

            <button
              className={` ${isHeadPage ? "bg-[#3498db]" : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/head/dashboard");
              }}
              disabled={!user || user.role !== "head"}
            >
              Head
            </button>

            <button
              className={` ${isTrainerPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/trainer/dashboard");
              }}
              disabled={!user || user.role !== "trainer"}
            >
              Trainer
            </button>

            <button
              className={` ${isConsultantPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/consultant/dashboard");
              }}
              disabled={!user || user.role !== "consultant"}
            >
              Coach
            </button>

            <button
              className={` ${isLearnerPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/learner/dashboard");
              }}
              disabled={!user || user.role !== "learner"}
            >
              Learner
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4">
            <button
              className="bg-[#4a6278] hover:bg-[#3498db] text-white border-none py-2 px-4 mt-9 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => navigate("/login")}
              disabled={!!user}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>

            <button
              className="bg-[#4a6278] hover:bg-[#3498db] text-white border-none py-2 px-4 mt-9 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="md:hidden text-white p-1"
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
          <div className="md:hidden w-full flex flex-col items-start gap-3 mt-4">
            <button
              className={`w-full text-left ${isDashboardPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => {
                navigate("/");
              }}
            >
              Dashboard
            </button>

            {/* Menu Admin */}
            <button
              className={`w-full text-left ${isAdminPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-3Two hundred flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => handleNavigate("/admin/dashboard")}
              disabled={
                !user || user.role !== "admin"
              }
            >
              Admin
            </button>

            {/* Menu Head */}
            <button
              className={`w-full text-left ${isHeadPage
                ? "bg-[#3498db]"
                : "bg-[#4a6278] hover:bg-[#3498db]"
                } text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed`}
              onClick={() => handleNavigate("/trainer/dashboard")}
              disabled={
                !user || user.role !== "head"
              }
            >
              Head
            </button>

            {/* Menu Login Button */}
            <button
              className="w-full text-left bg-[#4a6278] hover:bg-[#3498db] text-white border-none py-2 px-4 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleNavigate("/login")}
              disabled={!!user}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>

            {/* Menu Logout Button */}

            <button
              className="w-full text-left bg-[#4a6278] hover:bg-[#3498db] text-white border-none py-2 px-4 rounded-sm text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed"
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
