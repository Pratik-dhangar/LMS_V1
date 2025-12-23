import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import '../styles/pages/Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBookAppointment = () => {
    if (!user) {
      // Redirect to guest booking flow for unauthenticated users
      navigate("/guest-booking");
    } else {
      // Redirect to authenticated booking flow
      navigate("/book-appointment");
    }
  };

  return (
    <div className="home-container">
      <Navbar />

      {/* Hero Section */}
      <section className="home-hero">
        <h1 className="home-hero-title">HurshBinTech</h1>
        <p className="home-hero-subtitle">
          Online ABA Therapy Platform - Learn from Your Own Space
        </p>
        <button
          onClick={() => navigate("/login")}
          className="home-hero-button"
        >
          Get Started
        </button>
      </section>

      {/* Features Section */}
      <section className="home-features">
        {[
          { title: "ABOUT US", text: "Learn more about our mission and approach" },
          { title: "READ BLOGS", text: "Educational articles and insights" },
          { title: "VIEW VLOGS", text: "Video content and tutorials" },
          { title: "BOOK APPOINTMENT", text: "Schedule sessions with professionals", onClick: handleBookAppointment },
          { title: "SUBSCRIBE LEARNING CONTENT", text: "Access premium learning materials" },
          { title: "BUY LEARNING MATERIAL", text: "Purchase recommended resources" },
        ].map((item, i) => (
          <div 
            key={i} 
            className="home-feature-card"
            onClick={item.onClick}
            style={item.onClick ? { cursor: 'pointer' } : {}}
          >
            <h3 className="home-feature-card-title">{item.title}</h3>
            <p className="home-feature-card-text">{item.text}</p>
          </div>
        ))}
      </section>

      {/* Quick Features */}
      <section className="home-quick-features">
        <h2 className="home-quick-features-title">
          Quick Features
        </h2>

        <div className="home-quick-features-grid">
          {[
            "Real-time video therapy sessions",
            "Personalized learning programs",
            "Interactive whiteboard tools",
            "Progress tracking & reports",
          ].map((feature, index) => (
            <div key={index} className="home-quick-feature-item">
              <div className="home-quick-feature-icon">
                <span>✓</span>
              </div>
              <p className="home-quick-feature-text">{feature}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Home;
