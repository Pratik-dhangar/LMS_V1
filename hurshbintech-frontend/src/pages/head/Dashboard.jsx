// Head Dashboard Page

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
// import headService from '../../api/services/headService';
import { FaFileAlt } from "react-icons/fa";

// Import icons 
import { FaUsers, FaBookOpen, FaComments, FaUserTie, FaChartBar, FaCalendarAlt } from 'react-icons/fa';

// Head Dashboard Component
const HeadDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const menuItems = [
    {
      title: 'Manage Trainers',
      description: 'Register and manage HurshBin Trainers',
      icon: <FaUserTie />,
      path: '/head/manage-trainers',
      color: 'red'
    },
    {
      title: 'Manage Learners',
      description: 'View and manage learner profiles, assessments, and progress',
      icon: <FaUsers />,
      path: '/head/manage-learners',
      color: 'blue'
    },
    {
      title: 'Manage Trainings',
      description: 'View and manage learner profiles, programs, and assessments',
      icon: <FaBookOpen />,
      path: '/head/manage-sessions', // Mapped from original 'Manage Training Sessions'
      color: 'purple'
    },
    {
      title: 'Manage Communication',
      description: 'Send messages to prompters, trainers, and admin',
      icon: <FaComments />,
      path: '/head/communication', // Added a placeholder path
      color: 'green'
    },
    
    {
      title: 'Manage Home Program ',
      description: 'Assign and manage learning programs for learners',
      icon: <FaBookOpen />,
      path: '/head/manage-program-assignments',
      color: 'orange'
    },
    {
      title: 'Session Reports',
      description: 'View and analyze learner session reports and progress',
      icon: <FaChartBar />,
      path: '/head/reports',
      color: 'teal'
    },
    {
      title: 'Book Appointment with Coach',
      description: 'Schedule appointments with HurshBin Coaches/Consultants',
      icon: <FaCalendarAlt />,
      path: '/book-appointment',
      color: 'yellow'
    }
  ];

  const colors = {
    blue: {
      border: 'border-blue-500',
      text: 'text-blue-500'
    },
    purple: {
      border: 'border-purple-500',
      text: 'text-purple-500'
    },
    green: {
      border: 'border-green-500',
      text: 'text-green-500'
    },
    red: {
      border: 'border-red-500',
      text: 'text-red-500'
    },
    orange: {
      border: 'border-orange-500',
      text: 'text-orange-500'
    },
    yellow: {
      border: 'border-yellow-500',
      text: 'text-yellow-500'
    },
    teal: {
      border: 'border-teal-500',
      text: 'text-teal-500'
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 md:px-4 md:py-6">
          {/* Page Title Bar (from image) */}
          <div className="mb-8">

            <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
              Head Dashboard
            </h1>
          </div>

          {/* Header Welcome Banner (from image) */}
          <div className="mb-8 p-8 rounded-lg text-center text-white bg-[linear-gradient(135deg,_#f093fb_0%,_#f5576c_100%)] shadow-lg">
            <h1 className="text-3xl font-bold">
              Welcome, {user?.name || '[Head Name]'}
            </h1>
            <p className="text-lg opacity-90">
              Bridge between Admin and Trainers - Program Coordination
            </p>

          </div>

          {/* Stats Cards (Still commented out as in original file) */}
          {/* <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 mb-8">
            ...
          </div> */}

          {/* Admin Menu Grid (from image) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems.map((item) => (
              <div
                key={item.title}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md cursor-pointer
                            border-4 ${colors[item.color].border} 
                            transition-all duration-300 hover:shadow-xl hover:scale-[1.03]`}
                style={{ minHeight: '200px' }} // Ensure cards have a nice height
              >
                <div className={`text-5xl mb-4 ${colors[item.color].text}`}>
                  {item.icon}
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
                  {item.title}
                </h2>
                <p className="text-sm text-gray-600 text-center">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HeadDashboard;