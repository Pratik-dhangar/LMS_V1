import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-center py-16 px-6 rounded-b-2xl shadow-md">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">HurshBinTech</h1>
        <p className="text-lg sm:text-xl opacity-90 mb-8">
          Online ABA Therapy Platform - Learn from Your Own Space
        </p>
        <button
          onClick={() => navigate("/login")}
          className="bg-white text-indigo-600 font-semibold py-2.5 px-8 rounded-md text-lg shadow-md hover:bg-indigo-50 transition"
        >
          Get Started
        </button>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto py-10 px-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "ABOUT US", text: "Learn more about our mission and approach" },
          { title: "READ BLOGS", text: "Educational articles and insights" },
          { title: "VIEW VLOGS", text: "Video content and tutorials" },
          { title: "BOOK APPOINTMENT", text: "Schedule sessions with professionals" },
          { title: "SUBSCRIBE LEARNING CONTENT", text: "Access premium learning materials" },
          { title: "BUY LEARNING MATERIAL", text: "Purchase recommended resources" },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md transition"
          >
            <h3 className="text-gray-800 font-semibold text-base mb-1">{item.title}</h3>
            <p className="text-gray-500 text-sm">{item.text}</p>
          </div>
        ))}
      </section>

      {/* Quick Features */}
      <section className="max-w-6xl mx-auto w-full bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
        <h2 className="text-center text-gray-800 text-xl font-semibold mb-6">
          Quick Features
        </h2>

        <div className="grid sm:grid-cols-2 gap-3 text-gray-800">
          {[
            "Real-time video therapy sessions",
            "Personalized learning programs",
            "Interactive whiteboard tools",
            "Progress tracking & reports",
          ].map((feature, index) => (
            <div key={index} className="flex items-center gap-3 bg-white rounded-md p-3 border border-gray-100">
              <div className="flex-shrink-0 w-5 h-6  flex items-center justify-center">
                <span className="text-black text-xl font-bold">✓</span>
              </div>
              <p className="text-sm font-medium">{feature}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Home;
