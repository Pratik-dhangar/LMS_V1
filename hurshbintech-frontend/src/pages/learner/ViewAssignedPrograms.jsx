import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import learningProgramsService from "../../api/services/learningProgramsService";
import { Loader2 } from "lucide-react";
import '../../styles/Pages.css';

const ViewAssignedPrograms = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const data = await learningProgramsService.getAssignedProgramsForLearner();
        console.log("Fetched assigned programs data in ViewAssignedPrograms:", data); // Debug log
        setPrograms(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load assigned programs", e);
        // Add toast notification for user feedback
        toast.error("Failed to load assigned learning programs. Please try refreshing the page.");
        setPrograms([]); // Ensure programs is set to empty array on error
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="page-container">
      <Navbar />

      <main className="page-main">
        <h1 className="page-title">
          My Learning Programs
        </h1>

        {loading ? (
          <div className="loading-container">
            <Loader2 className="loading-spinner" />
            <p className="loading-text">Loading programs...</p>
          </div>
        ) : programs.length === 0 ? (
          <p className="empty-state-description">No learning programs assigned yet.</p>
        ) : (
          <div className="programs-list">
            {programs.map((p) => (
              <div
                key={p.id}
                className="program-card"
              >
                <h3 className="program-title">
                  {p.name || p.program_title}
                </h3>
                {(p.description || p.program_description) && (
                  <p className="program-description">
                    {p.description || p.program_description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ViewAssignedPrograms;
