import React, { useState } from "react";
// import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { toast } from "react-toastify";
import { Shield, Users, UserCog, GraduationCap, UserCheck } from "lucide-react"; //  Lucide icons
import '../../styles/pages/Login.css';

const Login = () => {

  const { userLogin } = useAuth();

  const [selectedRole, setSelectedRole] = useState(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setError("");
  };

  const roles = [
    {
      id: "admin",
      name: "HurshBin Admin",
      description: "Full system management access",
      icon: <Shield className="text-[#DB9D32] w-6 h-6" />,
    },
    {
      id: "head",
      name: "HurshBin Heads",
      description: "Program coordination and management",
      icon: <UserCheck className="text-[#DB9D32] w-6 h-6" />,
    },
    {
      id: "trainer",
      name: "HurshBin Trainers",
      description: "Conduct therapy sessions",
      icon: <Users className="text-green-600 w-6 h-6" />,
    },
    {
      id: "coach",
      name: "HurshBin Coaches/Consultants",
      description: "Consultation and guidance",
      icon: <UserCog className="text-orange-500 w-6 h-6" />,
    },
    {
      id: "learner",
      name: "Learners",
      description: "Access learning materials and sessions",
      icon: <GraduationCap className="text-[#9C4D0B] w-6 h-6" />,
    },
  ];


  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    console.log('Login form submitted', {
      selectedRole,
      hasPasscode: !!passcode
    });

    if (!selectedRole) {
      console.log('Login validation failed: No role selected');
      toast.error("Please select a role");
      return;
    }

    if (!passcode) {
      console.log('Login validation failed: No passcode entered');
      toast.error("Please enter your passcode");
      return;
    }

    setLoading(true);

    try {
      console.log('Attempting login with credentials', {
        role: selectedRole,
        passcodeLength: passcode.length
      });

      await userLogin({ role: selectedRole, passcode });
      console.log('Login successful, redirection handled by AuthContext');
    } catch (error) {
      console.error('Login component: Login failed', {
        error: error.response?.data?.detail || 'Unknown error',
        status: error.response?.status
      });
      // Error toast is already handled by AuthContext
      // Just set local error state for display
      const errorMessage = error.response?.data?.detail || "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Navbar />

      <main className="login-main">
        <div className="login-box">
          <h1 className="login-title">
            Select Your Role
          </h1>

          {/* Roles */}
          <div className="login-roles-grid">
            {roles.map((role) => (
              <div
                key={role.id}
                className={`login-role-card ${selectedRole === role.id ? 'selected' : ''}`}
                onClick={() => handleRoleSelect(role.id)}
              >
                <div className="login-role-icon">{role.icon}</div>
                <div className="login-role-info">
                  <p className="login-role-name">
                    {role.name}
                  </p>
                  <p className="login-role-description">
                    {role.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="login-form" noValidate>
            {selectedRole && (
              <div className="login-form-group">
                <label className="login-label">
                  Enter Passcode
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••"
                  maxLength="6"
                  className="login-input"
                />
              </div>
            )}

            {error && (
              <div className="login-error-message">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selectedRole}
              className="login-submit-button"
            >
              {loading ? (
                <>
                  <div className="login-spinner"></div>
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
