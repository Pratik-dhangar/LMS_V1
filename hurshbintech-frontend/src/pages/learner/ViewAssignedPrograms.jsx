import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import learningProgramsService from "../../api/services/learningProgramsService";
import { Loader2 } from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 border-b-4 border-blue-600 pb-2 mb-6">
          My Learning Programs
        </h1>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="text-gray-600">Loading programs...</p>
          </div>
        ) : programs.length === 0 ? (
          <p className="text-gray-600 text-lg">No learning programs assigned yet.</p>
        ) : (
          <div className="space-y-6">
            {programs.map((p) => (
              <div
                key={p.id}
                className="p-5 border rounded-lg bg-white shadow-sm hover:bg-gray-50 transition"
              >
                <h3 className="font-semibold text-gray-800 text-lg">
                  {p.name || p.program_title}
                </h3>
                {(p.description || p.program_description) && (
                  <p className="text-gray-600 text-sm mt-1">
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
