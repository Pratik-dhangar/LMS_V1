import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import learningProgramsService from "../../api/services/learningProgramsService";


const LearningProgramDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await learningProgramsService.getProgramDetails(id);
        setProgram(data);
      } catch (e) {
        console.error("Error loading program details:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading)
    return (
      <div className="page-container">
        <div className="loading-container">
          <Loader2 className="loading-spinner" />
        </div>
      </div>
    );

  return (
    <div className="page-container">
      <Navbar />

      <main className="page-main">
        <button
          onClick={() => navigate(-1)}
          className="back-button"
        >
          ⬅ Back
        </button>

        <div className="detail-card">
          <h1 className="detail-title">{program.program_title}</h1>

          <p className="detail-description">
            {program.program_description}
          </p>

          {program.assigned_at && (
            <p className="detail-meta">
              Assigned On: {new Date(program.assigned_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LearningProgramDetails;
