import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/Dashboards.css';

const ConsultantDashboard = () => {
  const { user: _user } = useAuth();

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
    <div className="dashboard-container">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <div className="consultant-page">
          <div className="consultant-content">
            {/* Header */}
            <div className="dashboard-header-flex">
              <h1 className="dashboard-title">HurshBin Coaches & Consultants Dashboard</h1>

            </div>

            {/* Search Section */}
            <div className="consultant-search-section">
              <h3 className="consultant-search-title">Connect with Learner or Trainer</h3>

              <div className="consultant-search-box">
                <input
                  type="text"
                  placeholder="Search by name..."
                  className="consultant-search-input"
                />
                <button className="consultant-search-btn">
                  Connect
                </button>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="consultant-content-grid">
              {/* Recent Connections */}
              <div className="consultant-card">
                <h3 className="consultant-card-title">Recent Connections</h3>

                <div className="consultant-list">
                  {recentConnections.map((connection, index) => (
                    <div key={index} className="consultant-list-item">
                      <span className="consultant-name">{connection.name}</span>
                      <span className="consultant-type">({connection.type})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Consultations */}
              <div className="consultant-card">
                <h3 className="consultant-card-title">Upcoming Consultations</h3>

                <div className="consultant-list">
                  {upcomingConsultations.map((consultation, index) => (
                    <div key={index} className="consultant-list-item consultant-list-item-green">
                      <div className="consultant-date">{consultation.date}</div>
                      <div className="consultant-client">{consultation.client}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Learning Content Section */}
            <div className="consultant-card">
              <h3 className="consultant-search-title">Access Learning Content</h3>

              <div className="consultant-library-grid">
                <div className="consultant-library-item">
                  <h4 className="consultant-library-title">Content Library</h4>
                  <p className="consultant-library-desc">Browse all content</p>
                </div>
                <div className="consultant-library-item">
                  <h4 className="consultant-library-title">Recent Content</h4>
                  <p className="consultant-library-desc">Recently accessed</p>
                </div>
                <div className="consultant-library-item">
                  <h4 className="consultant-library-title">Favorites</h4>
                  <p className="consultant-library-desc">Saved content</p>
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
