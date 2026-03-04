import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import programAssignmentService from "../../api/services/programAssignmentService";

import "../../styles/LearnerProgramAssignmentDetails.css";
import { toast } from "react-toastify";

const LearnerProgramAssignmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [assignedContents, setAssignedContents] = useState([]);
  const [allProgramsInTitle, setAllProgramsInTitle] = useState([]); // All programs with same title
  const [failedImageIds, setFailedImageIds] = useState(new Set()); // Track failed image loads
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [learnerNotes, setLearnerNotes] = useState("");
  const [proofOfWork, setProofOfWork] = useState(null);
  const [proofNotes, setProofNotes] = useState("");
  const [previousProofNotes, setPreviousProofNotes] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAssignment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ============ FETCH ASSIGNMENT ============
  const fetchAssignment = async () => {
    try {
      setLoading(true);
      // console.log(`\n📖 FETCHING ASSIGNMENT DETAILS FOR ID ${id}`);

      // Fetch the specific assignment with its contents
      const assignmentData = await programAssignmentService.getMyAssignmentById(
        parseInt(id)
      );
      // console.log(`✅ API returned assignment:`, assignmentData);

      if (assignmentData) {
        setAssignment(assignmentData);

        // Get contents from the assignment's content_assignments
        const contents = assignmentData.content_assignments || [];
        // console.log(`✅ Found ${contents.length} contents for this assignment`);

        if (contents && contents.length > 0) {
          contents.forEach((c, idx) => {
            // console.log(`  [${idx + 1}] ${c.learning_content?.title} - Status: ${c.completion_status}`);
          });
        }

        setAssignedContents(contents);

        // Fetch ALL assignments to get all programs with the same assignment_title
        if (assignmentData.assignment_title) {
          // console.log(`🔍 Fetching all programs for assignment title: "${assignmentData.assignment_title}"`);
          const allAssignments =
            await programAssignmentService.getMyAssignments();
          // Filter to get all programs with the same assignment_title
          const programsWithSameTitle = allAssignments.filter(
            (a) => a.assignment_title === assignmentData.assignment_title
          );
          // console.log(`✅ Found ${programsWithSameTitle.length} programs with this assignment title`);
          programsWithSameTitle.forEach((p, idx) => {
            // console.log(`  [${idx + 1}] ${p.program?.goal || p.program_name}`);
          });
          setAllProgramsInTitle(programsWithSameTitle);
        }
      } else {
        console.warn("⚠️ No assignment data received");
        setAssignment(null);
        setAssignedContents([]);
      }

      // console.log(`✅ Component state updated\n`);
    } catch (e) {
      console.error("❌ Failed to load assignment:", e);
      toast.error("Failed to load assignment details");
      setAssignment(null);
      setAssignedContents([]);
    } finally {
      setLoading(false);
    }
  };

  // ============ OPEN/CLOSE MODALS ============
  const openSubmit = () => setShowSubmitModal(true);
  const closeSubmit = () => {
    setShowSubmitModal(false);
    setFile(null);
  };

  const handleViewContent = (contentAssignment) => {
    // Extract the learning content from the content assignment
    const content = contentAssignment.learning_content || contentAssignment;
    setSelectedContent(content);
    setShowContentModal(true);
  };

  const closeContentModal = () => {
    setShowContentModal(false);
    setSelectedContent(null);
  };

  // ============ CONTENT ACTIONS ============
  const handleStartContent = async (content) => {
    if (!content.content_assignment_id) {
      toast.error("Unable to start content - missing assignment ID");
      return;
    }

    try {
      console.log(
        `🔄 Starting content ${content.content_assignment_id}: ${content.title}`
      );
      await programAssignmentService.startContent(
        content.content_assignment_id
      );
      toast.success(`Started: ${content.title}`);
      await fetchAssignment(); // Refresh to get updated status
    } catch (error) {
      console.error("Failed to start content:", error);
      toast.error("Failed to start content");
    }
  };

  const handleSubmitContent = async (content) => {
    if (!content.content_assignment_id) {
      toast.error("Unable to submit content - missing assignment ID");
      return;
    }

    try {
      console.log(
        `🔄 SUBMITTING: ${content.title} (ID: ${content.content_assignment_id})`
      );
      const response = await programAssignmentService.submitContent(
        content.content_assignment_id
      );
      console.log(`✅ Backend response:`, response);

      if (response.is_late) {
        toast.warning(`Content submitted (Late): ${content.title}`);
      } else {
        toast.success(`Content submitted: ${content.title}`);
      }

      // Give backend a moment to commit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Fetch fresh learning contents
      console.log(`🔄 Fetching fresh data from API...`);
      const allContents =
        await programAssignmentService.getMyLearningContents();
      console.log(`📦 Raw API response:`, allContents);

      const programContents = allContents.filter((c) => {
        const matches = c.program_assignment_id === parseInt(id);
        return matches;
      });

      console.log(`✅ Filtered contents (${programContents.length} items):`);
      programContents.forEach((c) => {
        console.log(`   - ${c.title}: ${c.completion_status}`);
      });

      // Force React to see this as a new array
      const newContents = [...programContents];

      console.log(`📊 Setting state with new array...`);
      setAssignedContents(newContents);

      // Calculate submitted count
      const submitted = newContents.filter(
        (c) =>
          c.completion_status === "SUBMITTED" ||
          c.completion_status === "LATE_SUBMITTED" ||
          c.completion_status === "REVIEWED"
      ).length;

      console.log(`🎯 Updated progress: ${submitted} / ${newContents.length}`);
    } catch (error) {
      console.error("❌ Submit error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
      });

      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to submit content";
      toast.error(errorMessage);
    }
  };

  const openProofModal = () => {
    setShowProofModal(true);
    setProofOfWork(null);
    setProofNotes("");
    // Fetch previous proof notes from learner_notes
    if (assignment?.learner_notes) {
      // Split by separator and filter empty entries
      const notes = assignment.learner_notes
        .split("---")
        .map((note) => note.trim())
        .filter((note) => note.length > 0);
      setPreviousProofNotes(notes);
    }
  };

  const closeProofModal = () => {
    setShowProofModal(false);
    setProofOfWork(null);
  };

  const handleSubmitProofOnly = async (e) => {
    // Prevent any form submission or event propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Allow either a file OR notes (or both). Require at least one.
    if (!proofOfWork && !proofNotes.trim()) {
      toast.error("Please upload a file or add notes for your proof of work");
      return;
    }

    try {
      setUploading(true);
      const statusBefore = assignment?.completion_status;
      console.log(`📤 PROOF-ONLY SUBMISSION: Starting for assignment ${id}`);
      console.log(`📌 Status BEFORE: ${statusBefore}`);

      // If a file is present, upload it. Otherwise skip upload.
      if (proofOfWork) {
        console.log(`📌 Proof file: ${proofOfWork.name}`);
        const uploadResponse = await programAssignmentService.uploadMyAttachment(
          parseInt(id),
          proofOfWork,
          "Proof of Work"
        );
        console.log(`✅ Upload successful:`, uploadResponse);
      }

      // If notes provided, append them to learner_notes
      if (proofNotes.trim()) {
        const currentNotes = assignment?.learner_notes || "";
        const timestamp = new Date().toLocaleString();
        const newNote = `[${timestamp}] ${proofNotes.trim()}`;
        const updatedNotes = currentNotes
          ? `${currentNotes}\n---\n${newNote}`
          : newNote;

        // Update assignment with new notes
        const updateResponse =
          await programAssignmentService.updateMyAssignment(parseInt(id), {
            learner_notes: updatedNotes,
          });

        console.log(`📝 Notes saved:`, updateResponse);

        // Update local assignment state so notes display properly on next modal open
        setAssignment((prevAssignment) => ({
          ...prevAssignment,
          learner_notes: updatedNotes,
        }));
      }

      // Success - show message and close
      toast.success("Proof of work submitted successfully!");

      // Reset file input for this modal
      setProofOfWork(null);
      // Keep notes in textarea so user can re-submit or edit if desired
      setShowProofModal(false);
    } catch (error) {
      console.error("❌ Proof submission failed:", error);
      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        "Failed to submit proof of work";
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleProofFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        toast.error("File size must be less than 50MB");
        return;
      }
      setProofOfWork(selectedFile);
    }
  };

  // ============ HELPER FUNCTIONS ============
  const getStatusBadge = (status) => {
    const statusColors = {
      NEW: "gray",
      IN_PROGRESS: "amber",
      SUBMITTED: "green",
      LATE_SUBMITTED: "orange",
      REVIEWED: "purple",
      RESUBMISSION_REQUIRED: "red",
    };
    const color = statusColors[status] || "gray";
    return (
      <span
        style={{
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "0.75rem",
          fontWeight: "600",
          backgroundColor: `var(--${color}-100, #e5e7eb)`,
          color: `var(--${color}-700, #374151)`,
        }}
      >
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  const getFileUrl = (fileUrl) => {
    if (!fileUrl) return "";

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://43.204.218.16:8000/api";
    const BACKEND_URL = API_BASE_URL.replace('/api', '');

    // Handle full URLs (already accessible)
    if (fileUrl.startsWith("https://") || fileUrl.startsWith("http://")) {
      return fileUrl;
    }

    // Handle malformed URLs like http://uploads/...
    if (
      fileUrl.startsWith("http://uploads/") ||
      fileUrl.startsWith("https://uploads/")
    ) {
      const match = fileUrl.match(/uploads\/.+/);
      return match ? `/${match[0]}` : fileUrl;
    }

    // Handle S3 URLs - route through backend proxy (avoids CORS)
    if (fileUrl.startsWith("s3://")) {
      const parts = fileUrl.replace("s3://", "").split("/");
      const key = parts.slice(1).join("/");
      return `${API_BASE_URL}/media/s3/${key}`;
    }

    // Handle backend proxy URLs from API responses (/api/media/s3/...)
    if (fileUrl.startsWith("/api/")) {
      return `${BACKEND_URL}${fileUrl}`;
    }

    // Handle local relative paths
    if (fileUrl.startsWith("/")) return fileUrl;

    // For relative paths like 'uploads/learning_content/...'
    return `/${fileUrl}`;
  };

  const handleImageLoadError = (contentId) => {
    setFailedImageIds((prev) => new Set([...prev, contentId]));
  };

  const renderContentViewer = () => {
    if (!selectedContent) return null;

    const fileUrl = getFileUrl(selectedContent.file_url);
    const contentType = selectedContent.content_type?.toLowerCase() || "";

    // Image content
    if (contentType === "image") {
      return (
        <div className="content-viewer-image">
          <img
            src={fileUrl}
            alt={selectedContent.title}
            onError={(e) => (e.target.src = "")}
          />
        </div>
      );
    }
    // Video content
    else if (contentType === "video") {
      return (
        <div className="content-viewer-video">
          <video width="100%" height="auto" controls>
            <source src={fileUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    // Audio content
    else if (contentType === "audio") {
      return (
        <div className="content-viewer-audio">
          <audio controls style={{ width: "100%" }}>
            <source src={fileUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }
    // PDF content
    else if (contentType === "pdf") {
      return (
        <div className="content-viewer-pdf">
          <iframe
            src={fileUrl}
            width="100%"
            height="500px"
            title={selectedContent.title}
          />
        </div>
      );
    }
    // Document or text content
    else if (contentType === "document" || contentType === "text") {
      return (
        <div className="content-viewer-document">
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            Download Document: {selectedContent.title}
          </a>
        </div>
      );
    }
    // Fallback for any unsupported type - offer download
    else {
      return (
        <div className="content-viewer-unsupported">
          <div className="unsupported-message">
            <p>Preview not available for this content type ({contentType})</p>
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="download-link"
              >
                📥 Download {selectedContent.title}
              </a>
            ) : (
              <p className="no-file">No file available for download</p>
            )}
          </div>
        </div>
      );
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        toast.error("File size must be less than 50MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async () => {
    if (!learnerNotes.trim() && !file) {
      toast.error("Please add notes or upload a file");
      return;
    }

    try {
      setUploading(true);
      console.log("📤 Submitting assignment submission...");
      // TODO: Implement submission logic here
      toast.success("Assignment submitted successfully");
      closeSubmit();
    } catch (error) {
      console.error("Failed to submit:", error);
      toast.error("Failed to submit assignment");
    } finally {
      setUploading(false);
    }
  };

  const calculateDaysLeft = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 ? daysLeft : 0;
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="loading">Loading assignment...</div>
        </div>
      </div>
    );
  }

  if (!assignedContents || assignedContents.length === 0) {
    return (
      <div className="page-container">
        <div className="page-content">
          <div className="error-state">
            <h2>No Contents Found</h2>
            <p>This program assignment has no contents assigned yet.</p>
          </div>
        </div>
      </div>
    );
  }

  // Count submitted items
  const submittedCount = assignedContents.filter(
    (c) =>
      c.completion_status === "SUBMITTED" ||
      c.completion_status === "LATE_SUBMITTED" ||
      c.completion_status === "REVIEWED"
  ).length;

  // Check if assignment is already completed
  const isAssignmentCompleted = assignment?.completion_status === "COMPLETED";

  // Debug logging
  console.log("🔍 Assignment Status:", assignment?.completion_status);
  console.log("✅ Is Completed:", isAssignmentCompleted);

  // Collect all program names from the current assignment
  // The assignment now has program_names array from the backend
  const allPrograms = assignment?.program_names || [];

  // console.log('🔍 Assignment program_names:', assignment?.program_names);
  // console.log('📋 allPrograms:', allPrograms);

  return (
    <div className="page-container">
      <div className="page-main">
        <div className="page-content">
          {/* Header with Back Button */}
          <div className="page-header">
            <button
              onClick={() => navigate("/learner/assigned-programs")}
              className="back-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Assignments
            </button>
            <div>
              <h1 className="page-title">
                📌 {assignment?.assignment_title || "Program Assignment"}
              </h1>
              <p className="page-description">
                This assignment includes content from all assigned programs
                combined.
              </p>
            </div>
          </div>

          <div className="assignment-details">
            <div className="programs-info">
              <p className="programs-label">
                <strong>Learning Goals in this Assignment:</strong>
              </p>
              {allPrograms && allPrograms.length > 0 ? (
                <ul className="programs-list">
                  {allPrograms.map((programName, idx) => (
                    <li key={idx}>• {programName}</li>
                  ))}
                </ul>
              ) : (
                <p className="no-programs">
                  No programs assigned to this Home Learning Program title yet.
                </p>
              )}
            </div>

            {/* Head Notes Section */}
            {assignment?.head_notes && (
              <div className="notes-section">
                <h4 className="subsection-title">👔 Instructions from Head</h4>
                <div className="notes-content notes-readonly">{assignment.head_notes}</div>
              </div>
            )}
          </div>

          <div className="contents-section">
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 className="contents-title">📚 Learning Contents</h2>
              <p className="contents-subtitle">
                All content from all programs in this assignment:
              </p>
            </div>
            <div className="contents-grid">
              {assignedContents.map((contentAssignment, idx) => {
                const content =
                  contentAssignment.learning_content || contentAssignment;
                const contentType = content.content_type?.toLowerCase() || "";
                const fileUrl = getFileUrl(content.file_url);

                return (
                  <div
                    key={contentAssignment.id}
                    className="content-card"
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    {/* Preview Thumbnail */}
                    <div
                      className="content-preview"
                      onClick={() => handleViewContent(contentAssignment)}
                    >
                      {contentType === "image" &&
                        fileUrl &&
                        !failedImageIds.has(contentAssignment.id) ? (
                        <img
                          src={fileUrl}
                          alt={content.title}
                          className="preview-image"
                          onError={() =>
                            handleImageLoadError(contentAssignment.id)
                          }
                        />
                      ) : contentType === "image" ||
                        failedImageIds.has(contentAssignment.id) ? (
                        <div className="preview-placeholder image">
                          <span className="image-icon">🖼️</span>
                          <span className="content-type-overlay">IMAGE</span>
                        </div>
                      ) : contentType === "video" ? (
                        <div className="preview-placeholder video">
                          <span className="play-icon">▶</span>
                          <span className="content-type-overlay">VIDEO</span>
                        </div>
                      ) : contentType === "audio" ? (
                        <div className="preview-placeholder audio">
                          <span className="audio-icon">🔊</span>
                          <span className="content-type-overlay">AUDIO</span>
                        </div>
                      ) : contentType === "pdf" ? (
                        <div className="preview-placeholder pdf">
                          <span className="pdf-icon">📄</span>
                          <span className="content-type-overlay">PDF</span>
                        </div>
                      ) : (
                        <div className="preview-placeholder document">
                          <span className="doc-icon">📎</span>
                          <span className="content-type-overlay">
                            {contentType?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="content-header">
                      <h3>{content.title}</h3>
                    </div>

                    {content.description && (
                      <p className="content-description">
                        {content.description}
                      </p>
                    )}

                    <div className="content-actions">
                      <button
                        className="btn app-modal-btn app-modal-btn--secondary"
                        onClick={() => handleViewContent(contentAssignment)}
                      >
                        👁️ View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Complete Assignment or Submit More Proof button at the end */}
            {/* Upload Proof Button - Only show if assignment is not COMPLETED */}
            {assignment?.completion_status !== 'COMPLETED' && (
              <div style={{ marginTop: "2rem", textAlign: "center" }}>
                <button
                  type="button"
                  className="btn btn-complete"
                  onClick={(e) => {
                    e.preventDefault();
                    openProofModal();
                  }}
                  style={{
                    padding: "12px 30px",
                    backgroundColor: "#10B981",
                    color: "white",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "600",
                    fontSize: "1rem",
                  }}
                >
                  📤 Submit Proof of Work
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Modal */}
        {showContentModal && selectedContent && (
          <div className="app-modal-overlay" onClick={closeContentModal}>
            <div
              className="app-modal-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-modal-header">
                <h2 className="app-modal-title">{selectedContent.title}</h2>
                <button
                  type="button"
                  className="app-modal-close"
                  onClick={closeContentModal}
                >
                  ✕
                </button>
              </div>
              <div className="app-modal-content">{renderContentViewer()}</div>
            </div>
          </div>
        )}

        {/* Proof of Work Submission Modal - Can submit multiple times */}
        {showProofModal && (
          <div className="app-modal-overlay" onClick={closeProofModal}>
            <div
              className="app-modal-container"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-modal-header">
                <h2 className="app-modal-title">
                  📤 Submit More Proof of Work
                </h2>
                <button
                  type="button"
                  className="app-modal-close"
                  onClick={(e) => {
                    e.preventDefault();
                    closeProofModal();
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="app-modal-content">
                {/* Previous Notes History */}
                {previousProofNotes && previousProofNotes.length > 0 && (
                  <div className="app-modal-form-field previous-notes-section">
                    <label className="app-modal-form-label">
                      📝 Previous Notes:
                    </label>
                    <div className="previous-notes-list">
                      {previousProofNotes.map((note, index) => (
                        <div key={index} className="note-item">
                          <p className="note-text">{note}</p>
                          <hr style={{ margin: "10px 0", opacity: 0.3 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label" htmlFor="proof-file">
                    Proof of Work (Optional)
                  </label>
                  <input
                    type="file"
                    id="proof-file"
                    className="app-modal-form-input"
                    onChange={handleProofFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                  />
                  {proofOfWork && (
                    <p className="file-selected">
                      Selected: {proofOfWork.name} (
                      {(proofOfWork.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  <p className="form-hint">Max file size: 50MB</p>
                </div>

                <div className="app-modal-form-field">
                  <label className="app-modal-form-label" htmlFor="proof-notes">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="proof-notes"
                    className="app-modal-form-textarea"
                    rows="4"
                    placeholder="Add any notes or comments about this proof of work submission..."
                    value={proofNotes}
                    onChange={(e) => setProofNotes(e.target.value)}
                  />
                  <p className="form-hint">
                    {proofNotes.length}/500 characters
                  </p>
                </div>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--secondary"
                  onClick={(e) => {
                    e.preventDefault();
                    closeProofModal();
                  }}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--primary"
                  onClick={handleSubmitProofOnly}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Submit Proof"}
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default LearnerProgramAssignmentDetails;
