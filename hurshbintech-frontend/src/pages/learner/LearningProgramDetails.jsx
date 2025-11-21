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
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-grow max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-200 px-4 py-2 rounded-md mb-4 hover:bg-gray-300"
        >
          ⬅ Back
        </button>

        <div className="bg-white p-8 rounded-lg shadow-lg border">
          <h1 className="text-3xl font-bold mb-4">{program.program_title}</h1>

          <p className="text-gray-700 whitespace-pre-line">
            {program.program_description}
          </p>

          {program.assigned_at && (
            <p className="mt-6 text-sm text-gray-500">
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
