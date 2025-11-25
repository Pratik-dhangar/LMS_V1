import React, { useState } from "react";
// import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import { toast } from "react-toastify";
import { Shield, Users, UserCog, GraduationCap, UserCheck } from "lucide-react"; //  Lucide icons

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
      icon: <Shield className="text-blue-600 w-6 h-6" />,
    },
    {
      id: "head",
      name: "HurshBin Heads",
      description: "Program coordination and management",
      icon: <UserCheck className="text-indigo-600 w-6 h-6" />,
    },
    {
      id: "trainer",
      name: "HurshBin Trainers",
      description: "Conduct therapy sessions",
      icon: <Users className="text-green-600 w-6 h-6" />,
    },
    {
      id: "consultant",
      name: "HurshBin Coaches/Consultants",
      description: "Consultation and guidance",
      icon: <UserCog className="text-orange-500 w-6 h-6" />,
    },
    {
      id: "learner",
      name: "Learners",
      description: "Access learning materials and sessions",
      icon: <GraduationCap className="text-purple-600 w-6 h-6" />,
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
    <div className="min-h-screen flex flex-col bg-gray-100 overflow-hidden">
      <Navbar />

      {/*  Centered Card  */}
     <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-8">
  <div className="bg-white rounded-xl shadow-lg w-full max-w-xs sm:max-w-sm p-5 sm:p-6">
    <h1 className="text-center text-lg font-semibold text-gray-800 mb-4">
      Select Your Role
    </h1>

    {/* Roles */}
    <div className="flex flex-col gap-2 mb-4">
      {roles.map((role) => (
        <div
          key={role.id}
          className={`flex items-center gap-2.5 p-2 border rounded-md cursor-pointer transition-all ${
            selectedRole === role.id
              ? "border-blue-500 bg-blue-50 shadow-sm"
              : "border-gray-200 hover:bg-gray-50"
          }`}
          onClick={() => handleRoleSelect(role.id)}
        >
          <div className="text-blue-600 text-lg">{role.icon}</div>
          <div>
            <p className="font-medium text-gray-800 text-sm leading-tight">
              {role.name}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {role.description}
            </p>
          </div>
        </div>
      ))}
    </div>

    {/* Login Form */}

      <form onSubmit={handleLogin} className="mt-2" noValidate>
        {selectedRole && (
          <div className="mb-2.5">
            <label className="block text-xs font-medium text-gray-700 mb-1 text-center">
              Enter Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••"
              maxLength="6"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-base text-center tracking-[0.25rem] font-semibold focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 text-xs text-center py-1 rounded-md mb-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !selectedRole}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
  

     </div>
</main>
      <Footer />
    </div>
  );
};

export default Login;
