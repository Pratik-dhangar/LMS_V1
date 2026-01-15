import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import programAssignmentService from "../../api/services/programAssignmentService";
import "../../styles/admin/index.css";

const AssignedPrograms = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const programErrorToastShownRef = useRef(false);

  const [learningPrograms, setLearningPrograms] = useState([]);
  const [groupedPrograms, setGroupedPrograms] = useState({});
  const [loadingPrograms, setLoadingPrograms] = useState(true);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Final submission modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedProgramForSubmit, setSelectedProgramForSubmit] = useState(null);
  const [submittingProgram, setSubmittingProgram] = useState(false);
  const [learnerNotesForSubmit, setLearnerNotesForSubmit] = useState('');
  const [proofOfWorkForSubmit, setProofOfWorkForSubmit] = useState(null);

  useEffect(() => {
    fetchAssignedPrograms();
  }, []);

  const fetchAssignedPrograms = async () => {
    try {
      const data = await programAssignmentService.getMyAssignments();
      console.log("📌 Fetched assigned programs data:", data);

      if (data && data.length > 0) {
        console.log("🔍 First program item structure:", data[0]);
      }

      if (Array.isArray(data)) {
        const sortedData = data.sort((a, b) => {
          const titleA = (a.assignment_title || a.program_name || a.name || '').toLowerCase();
          const titleB = (b.assignment_title || b.program_name || b.name || '').toLowerCase();
          return titleA.localeCompare(titleB);
        });
        setLearningPrograms(sortedData);

        const grouped = sortedData.reduce((acc, prog) => {
          const title = prog.assignment_title;
          if (!acc[title]) {
            acc[title] = [];
          }
          acc[title].push(prog);
          return acc;
        }, {});
        setGroupedPrograms(grouped);

        console.log(`✅ Grouped ${sortedData.length} programs into ${Object.keys(grouped).length} assignment titles`);
      } else {
        console.warn("⚠️ Fetched data is not an array:", data);
        setLearningPrograms([]);
        setGroupedPrograms({});
      }
    } catch (error) {
      console.error("❌ Error fetching assigned programs:", error);
      if (!programErrorToastShownRef.current) {
        programErrorToastShownRef.current = true;
      }
      setLearningPrograms([]);
      setGroupedPrograms({});
    } finally {
      setLoadingPrograms(false);
    }
  };

  const handleOpenSubmitModal = (program) => {
    setSelectedProgramForSubmit(program);
    setShowSubmitModal(true);
    setLearnerNotesForSubmit('');
    setProofOfWorkForSubmit(null);
  };

  const handleCloseSubmitModal = () => {
    setShowSubmitModal(false);
    setSelectedProgramForSubmit(null);
    setLearnerNotesForSubmit('');
    setProofOfWorkForSubmit(null);
  };

  const handleProofFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 50 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setProofOfWorkForSubmit(selectedFile);
    }
  };

  const handleStartProgram = async (programId) => {
    try {
      console.log(`🚀 Starting program assignment ${programId}...`);

      await programAssignmentService.updateMyAssignment(programId, {
        completion_status: 'IN_PROGRESS'
      });

      console.log(`✅ Program started successfully`);

      await fetchAssignedPrograms();

      navigate(`/learner/program-assignment/${programId}`);
    } catch (error) {
      console.error('Failed to start program:', error);
      navigate(`/learner/program-assignment/${programId}`);
    }
  };

  const handleFinalProgramSubmit = async () => {
    if (!selectedProgramForSubmit) return;

    if (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit) {
      toast.error('Please add notes or upload proof of work');
      return;
    }

    try {
      setSubmittingProgram(true);
      console.log(`🎯 Submitting program assignment ${selectedProgramForSubmit.id}...`);

      if (proofOfWorkForSubmit) {
        console.log('📤 Uploading proof of work...');
        await programAssignmentService.uploadMyAttachment(
          selectedProgramForSubmit.id,
          proofOfWorkForSubmit,
          'Proof of Work'
        );
      }

      const updateData = {
        completion_status: 'COMPLETED'
      };

      if (learnerNotesForSubmit.trim()) {
        const currentNotes = selectedProgramForSubmit.learner_notes || '';
        const timestamp = new Date().toLocaleString();
        const newNote = `[${timestamp}] ${learnerNotesForSubmit.trim()}`;
        updateData.learner_notes = currentNotes ? `${currentNotes}\n---\n${newNote}` : newNote;
      }

      await programAssignmentService.updateMyAssignment(selectedProgramForSubmit.id, updateData);

      toast.success('Program submitted successfully!');
      handleCloseSubmitModal();

      await fetchAssignedPrograms();
    } catch (error) {
      console.error('Failed to submit program:', error);
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to submit program';
      toast.error(errorMessage);
    } finally {
      setSubmittingProgram(false);
    }
  };

  return (
    <div className="admin-dashboard-container">
      <Navbar />

      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Assigned Programs (Home Program)
            </h1>
          </div>

          {/* Assigned Home Programs */}
          <div style={{
            marginTop: '2.5rem',
            background: '#ffffff',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            padding: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1f2937',
              borderBottom: '1px solid #e5e7eb',
              paddingBottom: '0.75rem',
              marginBottom: '1rem'
            }}>
              📚 Assigned Programs (Grouped by Assignment Title)
            </h2>

            {loadingPrograms ? (
              <p style={{ color: '#6b7280' }}>Loading assigned programs...</p>
            ) : learningPrograms.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No home programs assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Object.entries(groupedPrograms).map(([titleKey, programsList]) => {
                  const firstProg = programsList[0];
                  const completionStatus = firstProg.completion_status || 'NEW';
                  const hasFinalFeedback = firstProg.final_feedback_rating && firstProg.final_feedback_rating > 0;
                  const isSubmitted = completionStatus === 'COMPLETED';
                  const needsResubmission = isSubmitted && hasFinalFeedback;
                  const isInProgress = completionStatus === 'IN_PROGRESS';
                  const isNotStarted = completionStatus === 'NEW';

                  return (
                    <div
                      key={titleKey}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        background: '#f9fafb',
                        transition: 'background-color 0.2s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                            📌 {titleKey}
                          </h3>

                          {/* Programs List */}
                          <div style={{ marginBottom: '0.75rem' }}>
                            <p style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Programs:</p>
                            <div style={{ marginLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {firstProg.program_names && firstProg.program_names.length > 0 ? (
                                firstProg.program_names.map((name, idx) => (
                                  <p key={idx} style={{ fontSize: '0.875rem', color: '#374151' }}>
                                    • {name}
                                  </p>
                                ))
                              ) : (
                                <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                                  • {firstProg.program_name || 'Untitled Program'}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Timeline Info */}
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#4b5563',
                            marginTop: '0.5rem',
                            paddingTop: '0.5rem',
                            borderTop: '1px solid #e5e7eb'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>📅 Start:</span>
                              <span>{new Date(firstProg.start_date || firstProg.assigned_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>⏰ Deadline:</span>
                              <span style={{ fontWeight: '600' }}>{new Date(firstProg.end_date).toLocaleDateString()}</span>
                            </div>
                            {firstProg.duration_days && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⏱️ Duration:</span>
                                <span>{firstProg.duration_days} days</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', marginLeft: '1rem', flexShrink: 0 }}>
                          {/* Show Remarks button when final feedback exists */}
                          {hasFinalFeedback && (
                            <button
                              style={{
                                background: 'linear-gradient(to right, #f59e0b, #ea580c)',
                                color: '#ffffff',
                                padding: '0.625rem 1.25rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}
                              onClick={() => {
                                setSelectedFeedback({
                                  rating: firstProg.final_feedback_rating,
                                  remarks: firstProg.final_feedback_remarks,
                                  programName: titleKey,
                                  givenAt: firstProg.final_feedback_given_at
                                });
                                setShowFeedbackModal(true);
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #c2410c)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #ea580c)'}
                            >
                              <span style={{ fontSize: '1rem' }}>💬</span>
                              <span>Remarks</span>
                            </button>
                          )}

                          {/* Show Submit button only for IN_PROGRESS or RESUBMISSION_REQUIRED */}
                          {(isInProgress || needsResubmission) && (
                            <button
                              style={{
                                background: 'linear-gradient(to right, #10b981, #059669)',
                                color: '#ffffff',
                                padding: '0.625rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => handleOpenSubmitModal(firstProg)}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #10b981, #059669)'}
                            >
                              Submit
                            </button>
                          )}

                          {/* Button Logic Based on Status */}
                          {isNotStarted && (
                            <button
                              style={{
                                background: 'linear-gradient(to right, #f59e0b, #d97706)',
                                color: '#ffffff',
                                padding: '0.625rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => handleStartProgram(firstProg.id)}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
                            >
                              Start
                            </button>
                          )}

                          {isInProgress && (
                            <button
                              style={{
                                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                                color: '#ffffff',
                                padding: '0.625rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => navigate(`/learner/program-assignment/${firstProg.id}`)}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)'}
                            >
                              Continue
                            </button>
                          )}

                          {isSubmitted && (
                            <button
                              style={{
                                background: 'linear-gradient(to right, #a855f7, #9333ea)',
                                color: '#ffffff',
                                padding: '0.625rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s'
                              }}
                              onClick={() => navigate(`/learner/program-assignment/${firstProg.id}`)}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #9333ea, #7e22ce)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #a855f7, #9333ea)'}
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Feedback Modal */}
      {showFeedbackModal && selectedFeedback && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '28rem',
            width: '100%',
            animation: 'fadeIn 0.3s ease-in'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(to right, #f59e0b, #ea580c)',
              color: '#ffffff',
              padding: '1.5rem',
              borderRadius: '1rem 1rem 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>Head's Feedback</h3>
                  <p style={{ color: '#fef3c7', fontSize: '0.875rem' }}>{selectedFeedback.programName}</p>
                </div>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  style={{
                    color: '#ffffff',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(217, 119, 6, 0.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Rating */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>Rating</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        style={{
                          fontSize: '1.5rem',
                          color: star <= selectedFeedback.rating ? '#fbbf24' : '#d1d5db'
                        }}
                      >
                        {star <= selectedFeedback.rating ? '★' : '☆'}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: '1.125rem', fontWeight: '700', color: '#d97706' }}>
                    {selectedFeedback.rating}/5
                  </span>
                </div>
              </div>

              {/* Remarks */}
              {selectedFeedback.remarks && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>Remarks</label>
                  <div style={{
                    background: '#fef3c7',
                    borderLeft: '4px solid #fbbf24',
                    padding: '1rem',
                    borderRadius: '0.375rem'
                  }}>
                    <p style={{ color: '#1f2937', fontStyle: 'italic', lineHeight: '1.625' }}>
                      "{selectedFeedback.remarks}"
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {selectedFeedback.givenAt && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  textAlign: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  Feedback given on {new Date(selectedFeedback.givenAt).toLocaleDateString()} at{' '}
                  {new Date(selectedFeedback.givenAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem', paddingTop: 0 }}>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(to right, #f59e0b, #d97706)',
                  color: '#ffffff',
                  fontWeight: '600',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Program Submission Modal */}
      {showSubmitModal && selectedProgramForSubmit && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxWidth: '28rem',
            width: '100%',
            animation: 'fadeIn 0.3s ease-in'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(to right, #10b981, #059669)',
              color: '#ffffff',
              padding: '1.5rem',
              borderRadius: '1rem 1rem 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>Submit Program</h3>
                </div>
                <button
                  onClick={handleCloseSubmitModal}
                  disabled={submittingProgram}
                  style={{
                    color: '#ffffff',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '0.5rem',
                    cursor: submittingProgram ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => !submittingProgram && (e.currentTarget.style.background = 'rgba(5, 150, 105, 0.5)')}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem' }}>

              {/* Learner Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="submit-notes" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>
                  Notes (Required)
                </label>
                <textarea
                  id="submit-notes"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: 'inherit'
                  }}
                  rows="4"
                  placeholder="Add your notes about this submission..."
                  value={learnerNotesForSubmit}
                  onChange={(e) => setLearnerNotesForSubmit(e.target.value)}
                  disabled={submittingProgram}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
              </div>

              {/* Proof of Work */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="submit-proof" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.5rem', display: 'block' }}>
                  Proof of Work (Optional)
                </label>
                <input
                  type="file"
                  id="submit-proof"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    outline: 'none'
                  }}
                  onChange={handleProofFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                  disabled={submittingProgram}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                />
                {proofOfWorkForSubmit && (
                  <p style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.5rem' }}>
                    Selected: {proofOfWorkForSubmit.name} ({(proofOfWorkForSubmit.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Max file size: 50MB</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1.5rem', paddingTop: 0, display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleCloseSubmitModal}
                disabled={submittingProgram}
                style={{
                  flex: 1,
                  background: '#e5e7eb',
                  color: '#1f2937',
                  fontWeight: '600',
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: submittingProgram ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => !submittingProgram && (e.currentTarget.style.background = '#d1d5db')}
                onMouseLeave={(e) => e.currentTarget.style.background = '#e5e7eb'}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalProgramSubmit}
                disabled={submittingProgram || (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit)}
                style={{
                  flex: 1,
                  background: 'linear-gradient(to right, #10b981, #059669)',
                  color: '#ffffff',
                  fontWeight: '600',
                  padding: '0.625rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  cursor: (submittingProgram || (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit)) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  opacity: (submittingProgram || (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit)) ? 0.5 : 1
                }}
                onMouseEnter={(e) => !(submittingProgram || (!learnerNotesForSubmit.trim() && !proofOfWorkForSubmit)) && (e.currentTarget.style.background = 'linear-gradient(to right, #059669, #047857)')}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #10b981, #059669)'}
              >
                {submittingProgram ? 'Submitting...' : 'Submit Program'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AssignedPrograms;
