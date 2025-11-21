

import React, { useEffect, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import headService from "../../api/services/headService";
import learningProgramsService from "../../api/services/learningProgramsService";
import { Loader2, Trash2, ListChecks } from "lucide-react";
import { toast } from "react-toastify";

const ManageAssignedPrograms = () => {
  const [learners, setLearners] = useState([]);
  const [selectedLearner, setSelectedLearner] = useState("");
  const [programs, setPrograms] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);

    const learnersList = await headService.getAllLearners();
    const programsList = await learningProgramsService.getAllPrograms();

    setLearners(learnersList);
    setPrograms(programsList);
    setLoading(false);
  };

  const loadAssignedPrograms = async (learnerId) => {
    const res = await learningProgramsService.getAssignedPrograms(Number(learnerId)); // ✅ FIX
    setAssigned(res);
  };

  const handleAssign = async () => {
    if (!selectedLearner || selectedPrograms.length === 0) {
      toast.error("Select learner and at least one program");
      return;
    }

    setAssigning(true);

    await learningProgramsService.assignPrograms({
      learner_id: Number(selectedLearner), // ✅ FIX: Ensure it's integer
      program_ids: selectedPrograms,
    });

    toast.success("Assigned successfully");

    setSelectedPrograms([]);
    loadAssignedPrograms(Number(selectedLearner));

    setAssigning(false);
  };

  const handleRemove = async (id) => {
    await learningProgramsService.removeAssignedProgram(id);
    toast.success("Removed successfully");

    loadAssignedPrograms(Number(selectedLearner));
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold border-b-2 pb-3">Manage Assigned Programs</h1>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto" />
            Loading...
          </div>
        ) : (
          <>
            {/* Select Learner */}
            <div className="bg-white p-6 rounded-lg shadow mt-6">
              <label className="font-semibold">Select Learner</label>
                            <select
                                className="block w-full border p-2 rounded-md mt-2"
                                onChange={(e) => {
                                    setSelectedLearner(e.target.value);
                                    loadAssignedPrograms(e.target.value);
                                }}
                            >
                                <option value="">-- Select learner --</option>
                                {learners.map((l) => (
                                    <option key={l.id} value={l.user_id}>
                                        ({l.user_id}) {l.name} 
                                    </option>
                                ))}
                            </select>
            </div>

            {/* Learning Programs List with Search */}
            <div className="bg-white p-6 rounded-lg shadow mt-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2 items-center">
                  <ListChecks className="w-6 h-6" />
                  <h2 className="text-xl font-semibold">Learning Programs from Admin</h2>
                </div>
              </div>

              {/* ✅ Search Box */}
              <input
                type="text"
                placeholder="Search learning program..."
                className="w-full p-2 border rounded mb-4"
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* ✅ List View */}
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {programs
                  .filter((p) => p.goal.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((program) => (
                    <li
                      key={program.id}
                      className="flex justify-between items-center p-3 border rounded hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedPrograms.includes(program.id)}
                          onChange={() => {
                            setSelectedPrograms(
                              selectedPrograms.includes(program.id)
                                ? selectedPrograms.filter((id) => id !== program.id)
                                : [...selectedPrograms, program.id]
                            );
                          }}
                        />
                        <span className="font-medium">{program.goal}</span>
                      </div>
                      <span className="text-sm text-gray-500">{program.goal_description}</span>
                    </li>
                  ))}
              </ul>

              <button
                className="bg-blue-600 text-white px-6 py-2 rounded-md mt-4"
                disabled={assigning}
                onClick={handleAssign}
              >
                {assigning ? "Assigning..." : "Assign Selected Programs"}
              </button>
            </div>

            {/* Assigned Programs */}
            {selectedLearner && (
              <div className="bg-white p-6 rounded-lg shadow mt-6">
                <h2 className="text-xl font-semibold mb-4">Assigned Programs</h2>

                {assigned.length === 0 ? (
                  <p>No programs assigned yet.</p>
                ) : (
                  <table className="w-full border text-left">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 border">Program</th>
                        <th className="px-4 py-2 border">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-2 border">{row.program_title}</td>
                          <td className="px-4 py-2 border text-center">
                            <button
                              className="bg-red-600 text-white px-3 py-1 rounded-md"
                              onClick={() => handleRemove(row.id)}
                            >
                              <Trash2 className="inline-block w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ManageAssignedPrograms;
