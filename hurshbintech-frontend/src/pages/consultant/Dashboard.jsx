import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';

const ConsultantDashboard = () => {
  const { user } = useAuth();

  const recentConnections = [
    { name: 'John Doe', type: 'Learner' },
    { name: 'Jane Smith', type: 'Trainer' },
    { name: 'Mike Johnson', type: 'Learner' }
  ];

  const upcomingConsultations = [
    { date: 'Oct 5, 2025 - 2:00 PM', client: 'Emma Brown' },
    { date: 'Oct 7, 2025 - 10:00 AM', client: 'Sarah Lee' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 bg-[#f5f6fa] p-8 min-h-[calc(100vh-140px)] md:p-4">
          <div className="max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 pb-4 border-b-[3px] border-[#2c3e50] md:flex-col md:gap-4 md:items-start">
              <h1 className="text-[#2c3e50] text-[2rem] m-0 font-bold md:text-2xl">HurshBin Coaches & Consultants Dashboard</h1>
             
            </div>

            {/* Search Section */}
            <div className="bg-white p-8 rounded-xl mb-8 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
              <h3 className="text-[#2c3e50] text-[1.3rem] m-0 mb-4 font-semibold">Connect with Learner or Trainer</h3>
              
              <div className="flex gap-4 md:flex-col">
                <input 
                  type="text" 
                  placeholder="Search by name..." 
                  className="flex-1 py-4 px-6 border-2 border-[#e9ecef] rounded-lg text-base transition-colors duration-300 focus:outline-none focus:border-[#667eea]"
                />
                <button className="bg-[#3498db] text-white border-none py-4 px-10 rounded-lg text-base font-semibold cursor-pointer transition-all duration-300 hover:bg-[#2980b9] hover:-translate-y-0.5 md:w-full">
                  Connect
                </button>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-8 mb-8 md:grid-cols-1 md:gap-6">
              {/* Recent Connections */}
              <div className="bg-white p-8 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                <h3 className="text-[#2c3e50] text-xl m-0 mb-6 font-semibold">Recent Connections</h3>
                
                <div className="flex flex-col gap-4">
                  {recentConnections.map((connection, index) => (
                    <div key={index} className="py-4 px-6 bg-[#f8f9fa] rounded-lg border-l-4 border-[#3498db]">
                      <span className="font-semibold text-[#2c3e50] mr-2">{connection.name}</span>
                      <span className="text-[#666] text-[0.9rem]">({connection.type})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Consultations */}
              <div className="bg-white p-8 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
                <h3 className="text-[#2c3e50] text-xl m-0 mb-6 font-semibold">Upcoming Consultations</h3>
                
                <div className="flex flex-col gap-4">
                  {upcomingConsultations.map((consultation, index) => (
                    <div key={index} className="py-4 px-6 bg-[#f8f9fa] rounded-lg border-l-4 border-[#27ae60]">
                      <div className="font-semibold text-[#2c3e50] mb-1">{consultation.date}</div>
                      <div className="text-[#666] text-[0.95rem]">{consultation.client}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Learning Content Section */}
            <div className="bg-white p-8 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
              <h3 className="text-[#2c3e50] text-[1.3rem] m-0 mb-6 font-semibold">Access Learning Content</h3>
              
              <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 md:grid-cols-1">
                <div className="p-8 bg-[#f8f9fa] rounded-lg text-center cursor-pointer transition-all duration-300 border-2 border-transparent hover:border-[#667eea] hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <h4 className="text-[#2c3e50] text-[1.1rem] m-0 mb-2 font-semibold">Content Library</h4>
                  <p className="text-[#666] m-0 text-[0.9rem]">Browse all content</p>
                </div>
                <div className="p-8 bg-[#f8f9fa] rounded-lg text-center cursor-pointer transition-all duration-300 border-2 border-transparent hover:border-[#667eea] hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <h4 className="text-[#2c3e50] text-[1.1rem] m-0 mb-2 font-semibold">Recent Content</h4>
                  <p className="text-[#666] m-0 text-[0.9rem]">Recently accessed</p>
                </div>
                <div className="p-8 bg-[#f8f9fa] rounded-lg text-center cursor-pointer transition-all duration-300 border-2 border-transparent hover:border-[#667eea] hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <h4 className="text-[#2c3e50] text-[1.1rem] m-0 mb-2 font-semibold">Favorites</h4>
                  <p className="text-[#666] m-0 text-[0.9rem]">Saved content</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConsultantDashboard;
