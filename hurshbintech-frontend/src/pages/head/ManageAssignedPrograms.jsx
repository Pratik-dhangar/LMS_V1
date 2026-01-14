

import React, { useEffect, useState } from "react";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import headService from "../../api/services/headService";
import learningProgramsService from "../../api/services/learningProgramsService";
import { Loader2, Trash2, ListChecks } from "lucide-react";
import { toast } from "react-toastify";

import '../../styles/head/ManageAssignedPrograms.css';
import '../../styles/Table.css';

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
    <div className="page-container">
      <Navbar />

      <main className="page-main">
        <h1 className="page-title">Manage Assigned Programs</h1>

        {loading ? (
          <div className="loading-container">
            <Loader2 className="loading-spinner" />
            Loading...
          </div>
        ) : (
          <>
            {/* Select Learner */}
            <div className="form-container">
              <label className="app-modal-form-label">Select Learner</label>
              <select
                className="app-modal-form-select"
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
            <div className="form-container">
              <div className="form-section-header">
                <div className="form-section-title-group">
                  <ListChecks className="icon-md" />
                  <h2 className="form-section-title">Learning Programs from Admin</h2>
                </div>
              </div>

              {/* ✅ Search Box */}
              <input
                type="text"
                placeholder="Search learning program..."
                className="app-modal-form-input"
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {/* ✅ List View */}
              <ul className="checkbox-list">
                {programs
                  .filter((p) => p.goal.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((program) => (
                    <li
                      key={program.id}
                      className={`checkbox-list-item ${selectedPrograms.includes(program.id) ? 'selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (selectedPrograms.includes(program.id)) {
                            setSelectedPrograms(selectedPrograms.filter((id) => id !== program.id));
                          } else {
                            setSelectedPrograms([...selectedPrograms, program.id]);
                          }
                        }
                      }}
                      onClick={(e) => {
                        // Prevent toggling when clicking on the inner checkbox or button
                        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button'))) {
                          return;
                        }
                        // Toggle selection
                        if (selectedPrograms.includes(program.id)) {
                          setSelectedPrograms(selectedPrograms.filter((id) => id !== program.id));
                        } else {
                          setSelectedPrograms([...selectedPrograms, program.id]);
                        }
                      }}
                    >
                      <div className="checkbox-list-content">
                        <input
                          type="checkbox"
                          checked={selectedPrograms.includes(program.id)}
                          onChange={(e) => {
                            // Prevent parent onClick from firing (toggle twice)
                            e.stopPropagation();
                            if (selectedPrograms.includes(program.id)) {
                              setSelectedPrograms(selectedPrograms.filter((id) => id !== program.id));
                            } else {
                              setSelectedPrograms([...selectedPrograms, program.id]);
                            }
                          }}
                        />
                        <span className="checkbox-label">{program.goal}</span>
                      </div>
                      <span className="checkbox-description">{program.goal_description}</span>
                    </li>
                  ))}
              </ul>

              <div className="assign-actions">
                <span className="assign-count">{selectedPrograms.length} selected</span>
                <button
                  className="app-modal-btn app-modal-btn--primary"
                  disabled={assigning}
                  onClick={handleAssign}
                >
                  {assigning ? "Assigning..." : "Assign Selected Programs"}
                </button>
              </div>
            </div>

            {/* Assigned Programs */}
            {selectedLearner && (
              <div className="form-container">
                <h2 className="form-section-title">Assigned Programs</h2>

                {assigned.length === 0 ? (
                  <p className="table-primary-empty-description">No programs assigned yet.</p>
                ) : (
                  <div className="table-primary-container">
                    <table className="table-primary">
                      <thead className="table-primary-header">
                        <tr>
                          <th className="table-primary-th">Program</th>
                          <th className="table-primary-th">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="table-primary-body">
                        {assigned.map((row) => (
                          <tr key={row.id} className="table-primary-row">
                            <td className="table-primary-td">{row.program_title}</td>
                            <td className="table-primary-td table-primary-td-center">
                              <button
                                className="app-modal-btn app-modal-btn--danger btn-icon"
                                onClick={() => handleRemove(row.id)}
                              >
                                <Trash2 className="table-primary-icon-sm" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
