import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
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
    } catch (error) {
      toast.error("Failed to load learners");
    }
  };

  const fetchContents = async () => {
    try {
      const data = await learningContentAssignmentService.getContents();
      setContents(data);
    } catch (error) {
      toast.error("Failed to load learning contents");
    }
  };

  const fetchAssignedContents = async (learnerId) => {
    if (!learnerId) return;
    setLoading(true);
    try {
      const data = await learningContentAssignmentService.getAssignmentsByLearner(learnerId);
      setAssignedContents(data);
    } catch (error) {
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
    } catch (error) {
      toast.error("Failed to revoke assignment");
    }
  };

  const handleLearnerChange = (learnerId) => {
    setSelectedLearner(learnerId);
    fetchAssignedContents(learnerId);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Manage Assigned Learning Content
        </h1>

        {/* Assignment Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Assign New Content</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Learner
              </label>
              <select
                value={selectedLearner}
                onChange={(e) => handleLearnerChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Content
              </label>
              <select
                value={selectedContent}
                onChange={(e) => setSelectedContent(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose content...</option>
                {contents.map((content) => (
                  <option key={content.id} value={content.id}>
                    {content.title} ({content.content_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleAssign}
                disabled={assigning || !selectedLearner || !selectedContent}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>

        {/* Assigned Contents */}
        {selectedLearner && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Assigned Content for {learners.find(l => l.id.toString() === selectedLearner)?.name}
            </h2>

            {loading ? (
              <div className="text-center py-6 text-gray-500">Loading assigned contents...</div>
            ) : assignedContents.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No content assigned yet.</div>
            ) : (
              <div className="space-y-4">
                {assignedContents.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border rounded-lg p-4 flex justify-between items-center bg-gray-50"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">
                        {assignment.content_title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Type: {assignment.content_type} | Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Assigned by: {assignment.assigned_by_name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevoke(assignment.id)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-md text-sm transition-colors"
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
    </div>
  );
};

export default ManageAssignedLearningContent;
