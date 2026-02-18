import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from 'lucide-react';
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import programAssignmentService from "../../api/services/programAssignmentService";
import "../../styles/ManageUsersLayout.css";

const AssignedPrograms = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const programErrorToastShownRef = useRef(false);

  const [learningPrograms, setLearningPrograms] = useState([]);
  const [groupedPrograms, setGroupedPrograms] = useState({});
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

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
        // Status priority order: IN_PROGRESS -> NEW -> COMPLETED
        const statusPriority = {
          'IN_PROGRESS': 1,
          'NEW': 2,
          'COMPLETED': 3
        };

        const sortedData = data.sort((a, b) => {
          const statusA = a.completion_status || 'NEW';
          const statusB = b.completion_status || 'NEW';

          const priorityA = statusPriority[statusA] || 4;
          const priorityB = statusPriority[statusB] || 4;

          // First, sort by status priority
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // Then, sort by date (newest first)
          const dateA = new Date(a.start_date || a.assigned_at || 0);
          const dateB = new Date(b.start_date || b.assigned_at || 0);
          return dateB - dateA; // Descending order (newest first)
        });

        setLearningPrograms(sortedData);
        setCurrentPage(1); // Reset to first page when data updates

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

  // Calculate pagination
  const flatteneduniquePrograms = learningPrograms.filter((prog, index, self) =>
    index === self.findIndex((p) => p.assignment_title === prog.assignment_title)
  );
  const totalPages = Math.ceil(flatteneduniquePrograms.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPrograms = flatteneduniquePrograms.slice(startIndex, endIndex);

  const handleItemsPerPageChange = (newSize) => {
    setItemsPerPage(newSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  return (
    <div className="page-container">
      <style>{`
        /* Mobile Responsive Styles for Assigned Programs */
        
        /* Mobile Portrait */
        @media (max-width: 768px) {
          .page-container {
            padding: 8px !important;
          }
          
          .page-content {
            padding: 0 !important;
          }
          
          .page-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            margin-bottom: 16px !important;
          }
          
          .page-title {
            font-size: 1.125rem !important;
            line-height: 1.3 !important;
          }
          
          .back-button {
            font-size: 0.875rem !important;
            padding: 8px 12px !important;
          }
        }
        
        /* Program Cards Mobile */
        @media (max-width: 900px) {
          .program-card-container {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 12px !important;
          }
          
          .program-card-layout {
            flex-direction: column !important;
            gap: 12px !important;
          }
          
          .program-card-info {
            width: 100% !important;
          }
          
          .program-card-actions {
            width: 100% !important;
            margin-left: 0 !important;
            margin-top: 12px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
          }
          
          .program-card-actions button {
            width: 100% !important;
            justify-content: center !important;
            font-size: 0.875rem !important;
            padding: 12px 16px !important;
            margin: 0 !important;
          }
          
          .program-timeline {
            flex-direction: column !important;
            gap: 0.5rem !important;
          }
          
          .program-card-container h3 {
            font-size: 0.95rem !important;
          }
          
          .program-card-container p {
            font-size: 0.875rem !important;
          }
        }
        
        /* Mobile Landscape */
        @media (max-width: 1024px) and (orientation: landscape) {
          .page-title {
            font-size: 1rem !important;
          }
          
          .program-card-container {
            padding: 10px !important;
          }
          
          .program-card-actions {
            flex-direction: row !important;
            flex-wrap: wrap !important;
          }
          
          .program-card-actions button {
            font-size: 0.75rem !important;
            padding: 8px 12px !important;
            flex: 1 !important;
            min-width: max-content !important;
          }
        }
        
        /* Modal Responsive */
        @media (max-width: 768px) {
          .program-modal-container {
            margin: 16px !important;
            max-width: calc(100vw - 32px) !important;
            max-height: calc(100vh - 32px) !important;
            overflow-y: auto !important;
          }
          
          .program-modal-content {
            padding: 16px !important;
          }
          
          .program-modal-footer {
            flex-direction: column !important;
            gap: 8px !important;
          }
          
          .program-modal-footer button {
            width: 100% !important;
          }
        }
        
        /* Extra Small Devices */
        @media (max-width: 480px) {
          .page-title {
            font-size: 1rem !important;
          }
          
          .program-card-container {
            padding: 10px !important;
          }
          
          .program-card-container h3 {
            font-size: 0.9rem !important;
          }
          
          .program-card-container p {
            font-size: 0.8rem !important;
          }
          
          .program-card-actions button {
            font-size: 0.8125rem !important;
            padding: 10px 12px !important;
          }
          
          .program-timeline {
            font-size: 0.7rem !important;
          }
        }
        
        /* Touch-friendly targets */
        @media (hover: none) and (pointer: coarse) {
          button {
            min-height: 44px !important;
          }
        }
      `}</style>
      <main className="page-main">
        <div className="page-content">
          {/* Page Header */}
          <div className="page-header">
            <button onClick={() => navigate('/learner/dashboard')} className="back-button">
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
            <h1 className="page-title">
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
              📚 Assigned Home Programs
            </h2>

            {loadingPrograms ? (
              <p style={{ color: '#6b7280' }}>Loading assigned home programs...</p>
            ) : learningPrograms.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No home programs assigned yet.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {paginatedPrograms.map((program) => {
                    const titleKey = program.assignment_title;
                    const completionStatus = program.completion_status || 'NEW';
                    const hasFinalFeedback = program.final_feedback_rating && program.final_feedback_rating > 0;
                    const isSubmitted = completionStatus === 'COMPLETED';
                    const needsResubmission = isSubmitted && hasFinalFeedback;
                    const isInProgress = completionStatus === 'IN_PROGRESS';
                    const isNotStarted = completionStatus === 'NEW';

                    return (
                      <div
                        key={program.id}
                        className="program-card-container"
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
                        <div className="program-card-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div className="program-card-info" style={{ flex: 1 }}>
                            <h3 style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                              📌 {titleKey}
                            </h3>

                            {/* Programs List */}
                            <div style={{ marginBottom: '.75rem' }}>
                              <p style={{ fontSize: '1rem', color: '#4b5563', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Programs:</p>
                              <div style={{ marginLeft: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {program.program_names && program.program_names.length > 0 ? (
                                  program.program_names.map((name, idx) => (
                                    <p key={idx} style={{ fontSize: '0.875rem', color: '#374151' }}>
                                      • {name}
                                    </p>
                                  ))
                                ) : (
                                  <p style={{ fontSize: '0.875rem', color: '#374151' }}>
                                    • {program.program_name || 'Untitled Program'}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Timeline Info */}
                            <div className="program-timeline" style={{
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
                                <span>{new Date(program.start_date || program.assigned_at).toLocaleDateString()}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⏰ Deadline:</span>
                                <span style={{ fontWeight: '600' }}>{new Date(program.end_date).toLocaleDateString()}</span>
                              </div>
                              {program.duration_days && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>⏱️ Duration:</span>
                                  <span>{program.duration_days} days</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="program-card-actions" style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', marginLeft: '1rem', flexShrink: 0 }}>
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
                                    rating: program.final_feedback_rating,
                                    remarks: program.final_feedback_remarks,
                                    programName: titleKey,
                                    givenAt: program.final_feedback_given_at
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

                            {/* Show Submit button only for IN_PROGRESS */}
                            {isInProgress && (
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
                                onClick={() => handleOpenSubmitModal(program)}
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
                                onClick={() => handleStartProgram(program.id)}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
                              >
                                Start
                              </button>
                            )}

                            {isInProgress && (
                              <button
                                style={{
                                  background: 'linear-gradient(to right, #db9d32, #b8790a)',
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
                                onClick={() => navigate(`/learner/program-assignment/${program.id}`)}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #b8790a, #9c6a08)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #db9d32, #b8790a)'}
                              >
                                Continue
                              </button>
                            )}

                            {isSubmitted && (
                              <button
                                className="btn-primary"
                                onClick={() => navigate(`/learner/program-assignment/${program.id}`)}

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

                {/* Pagination Controls */}
                {learningPrograms.length > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid #e5e7eb',
                    flexWrap: 'wrap'
                  }}>
                    {/* Items Per Page Selector */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <label style={{
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        color: '#4b5563'
                      }}>
                        List per page:
                      </label>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #d1d5db',
                          background: '#ffffff',
                          color: '#374151',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#9ca3af'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                      </select>
                    </div>

                    {/* Pagination Info and Controls */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #d1d5db',
                          background: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                          color: currentPage === 1 ? '#9ca3af' : '#374151',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage > 1) {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = currentPage === 1 ? '#f3f4f6' : '#ffffff';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        ← Previous
                      </button>

                      {/* Page Numbers */}
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              width: '2rem',
                              height: '2rem',
                              padding: '0',
                              borderRadius: '0.375rem',
                              border: pageNum === currentPage ? '2px solid #d97706' : '1px solid #d1d5db',
                              background: pageNum === currentPage ? '#d97706' : '#ffffff',
                              color: pageNum === currentPage ? '#ffffff' : '#374151',
                              fontSize: '0.875rem',
                              fontWeight: pageNum === currentPage ? '600' : '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (pageNum !== currentPage) {
                                e.currentTarget.style.background = '#d1d5db';
                                e.currentTarget.style.borderColor = '#d1d5db';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = pageNum === currentPage ? '#d97706' : '#ffffff';
                              e.currentTarget.style.borderColor = pageNum === currentPage ? '#d97706' : '#d1d5db';
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.375rem',
                          border: '1px solid #d1d5db',
                          background: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                          color: currentPage === totalPages ? '#9ca3af' : '#374151',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (currentPage < totalPages) {
                            e.currentTarget.style.background = '#f9fafb';
                            e.currentTarget.style.borderColor = '#9ca3af';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = currentPage === totalPages ? '#f3f4f6' : '#ffffff';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        Next →
                      </button>
                    </div>

                    {/* Page Info */}
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280'
                    }}>
                      Page {currentPage} of {totalPages} ({flatteneduniquePrograms.length} total)
                    </span>
                  </div>
                )}
              </>
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
          <div className="program-modal-container" style={{
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
            <div className="program-modal-content" style={{ padding: '1.5rem' }}>
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
            <div className="program-modal-footer" style={{ padding: '1.5rem', paddingTop: 0 }}>
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
          <div className="program-modal-container" style={{
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
            <div className="program-modal-content" style={{ padding: '1.5rem' }}>

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
            <div className="program-modal-footer" style={{ padding: '1.5rem', paddingTop: 0, display: 'flex', gap: '0.75rem' }}>
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

    </div>
  );
};

export default AssignedPrograms;
