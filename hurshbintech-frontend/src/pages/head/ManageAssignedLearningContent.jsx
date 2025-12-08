import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import '../../styles/Pages.css';
import learningContentAssignmentService from "../../api/services/learningContentAssignmentService";

const ManageAssignedLearningContent = () => {
  const [learners, setLearners] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedLearner, setSelectedLearner] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [assignedContents, setAssignedContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchLearners();
    fetchContents();
  }, []);

  const fetchLearners = async () => {
    try {
      const data = await learningContentAssignmentService.getLearners();
      setLearners(data);
    } catch {
      toast.error("Failed to load learners");
    }
  };

  const fetchContents = async () => {
    try {
      const data = await learningContentAssignmentService.getContents();
      setContents(data);
    } catch {
      toast.error("Failed to load learning contents");
    }
  };

  const fetchAssignedContents = async (learnerId) => {
    if (!learnerId) return;
    setLoading(true);
    try {
      const data = await learningContentAssignmentService.getAssignmentsByLearner(learnerId);
      setAssignedContents(data);
    } catch {
      toast.error("Failed to load assigned contents");
      setAssignedContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedLearner || !selectedContent) {
      toast.error("Please select both learner and content");
      return;
    }

    setAssigning(true);
    try {
      await learningContentAssignmentService.assignContent({
        learner_id: parseInt(selectedLearner),
        learning_content_id: parseInt(selectedContent)
      });
      toast.success("Content assigned successfully");
      setSelectedContent("");
      fetchAssignedContents(selectedLearner);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to assign content");
    } finally {
      setAssigning(false);
    }
  };

  const handleRevoke = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to revoke this assignment?")) return;

    try {
      await learningContentAssignmentService.revokeAssignment(assignmentId);
      toast.success("Assignment revoked successfully");
      fetchAssignedContents(selectedLearner);
    } catch {
      toast.error("Failed to revoke assignment");
    }
  };

  const handleLearnerChange = (learnerId) => {
    setSelectedLearner(learnerId);
    fetchAssignedContents(learnerId);
  };

  return (
    <div className="page-container">
      <Navbar />
      <div className="page-content">
        <h1 className="page-title">
          Manage Assigned Learning Content
        </h1>

        {/* Assignment Form */}
        <div className="form-container">
          <h2 className="form-section-title">Assign New Content</h2>

          <div className="form-grid form-grid-3">
            <div>
              <label className="form-label">
                Select Learner
              </label>
              <select
                value={selectedLearner}
                onChange={(e) => handleLearnerChange(e.target.value)}
                className="form-select"
              >
                <option value="">Choose a learner...</option>
                {learners.map((learner) => (
                  <option key={learner.id} value={learner.id}>
                    {learner.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                Select Content
              </label>
              <select
                value={selectedContent}
                onChange={(e) => setSelectedContent(e.target.value)}
                className="form-select"
              >
                <option value="">Choose content...</option>
                {contents.map((content) => (
                  <option key={content.id} value={content.id}>
                    {content.title} ({content.content_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field-end">
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedLearner || !selectedContent}
                className="btn-primary"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Contents */}
        {selectedLearner && (
          <div className="form-container">
            <h2 className="form-section-title">
              Assigned Content for {learners.find(l => l.id.toString() === selectedLearner)?.name}
            </h2>

            {loading ? (
              <div className="loading-container">Loading assigned contents...</div>
            ) : assignedContents.length === 0 ? (
              <div className="empty-state-description">No content assigned yet.</div>
            ) : (
              <div className="assignments-list">
                {assignedContents.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="assignment-item"
                  >
                    <div className="assignment-details">
                      <h3 className="assignment-title">
                        {assignment.content_title}
                      </h3>
                      <p className="assignment-info">
                        Type: {assignment.content_type} | Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                      <p className="assignment-meta">
                        Assigned by: {assignment.assigned_by_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(assignment.id)}
                      className="btn-danger"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ManageAssignedLearningContent;
