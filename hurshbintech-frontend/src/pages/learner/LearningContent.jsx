import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import programAssignmentService from "../../api/services/programAssignmentService";
import "../../styles/admin/index.css";

const LearningContent = () => {
  const { user } = useAuth();

  const [learningContents, setLearningContents] = useState([]);
  const [programContents, setProgramContents] = useState({});
  const [loadingContents, setLoadingContents] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(null);

  useEffect(() => {
    fetchAllLearningContents();
  }, []);

  const fetchAllLearningContents = async () => {
    try {
      setLoadingContents(true);
      const contents = await programAssignmentService.getMyLearningContents();
      console.log("🔍 API Response - Fetched all learning contents:", contents);
      console.log(`📊 Total items in response: ${Array.isArray(contents) ? contents.length : 'NOT AN ARRAY'}`);

      if (Array.isArray(contents)) {
        contents.forEach((item, idx) => {
          console.log(`  ${idx + 1}. "${item.title}" (ID: ${item.id}, Type: ${item.content_type}, Assignment: ${item.program_assignment_id}, From Program: ${item.from_program})`);
        });

        // Organize contents by program_assignment_id (the assignment they belong to)
        const byAssignment = {};
        contents.forEach(content => {
          const assignmentId = content.program_assignment_id;
          if (assignmentId) {
            if (!byAssignment[assignmentId]) {
              byAssignment[assignmentId] = [];
            }
            byAssignment[assignmentId].push(content);
          }
        });

        setProgramContents(byAssignment);
        console.log(`📂 Organized contents into ${Object.keys(byAssignment).length} assignments:`, Object.keys(byAssignment));
      }

      setLearningContents(Array.isArray(contents) ? contents : []);
      console.log(`✅ State updated with ${Array.isArray(contents) ? contents.length : 0} contents`);
    } catch (error) {
      console.error("❌ Error fetching learning contents:", error);
      setLearningContents([]);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleViewContent = (content) => {
    setSelectedContent(content);
    setShowContentModal(true);
    setContentLoading(true);

    // Set a timeout to stop loading after 3 seconds in case content fails to load
    const timeout = setTimeout(() => {
      setContentLoading(false);
    }, 3000);

    setLoadingTimeout(timeout);
  };

  const handleCloseModal = () => {
    setShowContentModal(false);
    setSelectedContent(null);
    setContentLoading(false);
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  };

  const renderContentViewer = () => {
    if (!selectedContent) return null;

    const { content_type, file_url, title } = selectedContent;
    const fullUrl = file_url?.startsWith('http') ? file_url : file_url;

    const handleLoad = () => {
      setContentLoading(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
    };
    const handleError = () => {
      setContentLoading(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
      toast.error("Failed to load content");
    };

    switch (content_type?.toLowerCase()) {
      case 'image':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img
              src={fullUrl}
              alt={title}
              style={{ 
                maxWidth: '100%', 
                maxHeight: '70vh', 
                objectFit: 'contain', 
                borderRadius: '0.5rem', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
              }}
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        );

      case 'video':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <video
              src={fullUrl}
              controls
              style={{ 
                maxWidth: '100%', 
                maxHeight: '70vh', 
                borderRadius: '0.5rem', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
              }}
              onLoadedData={handleLoad}
              onError={handleError}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <audio
              src={fullUrl}
              controls
              style={{ width: '100%', maxWidth: '28rem' }}
              onLoadedData={handleLoad}
              onError={handleError}
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      case 'pdf':
      case 'document':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <iframe
              src={fullUrl}
              style={{ 
                width: '100%', 
                height: '70vh', 
                border: '1px solid #e5e7eb', 
                borderRadius: '0.5rem', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
              }}
              title={title}
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        );

      default:
        return (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3.75rem', marginBottom: '1rem' }}>📄</div>
            <p style={{ color: '#4b5563', marginBottom: '1rem' }}>This content type is not supported for inline viewing.</p>
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
            >
              Open in New Tab
            </a>
          </div>
        );
    }
  };

  return (
    <div className="admin-dashboard-container">
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              Learning Content
            </h1>
          </div>

          {/* Learning Contents */}
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
              Learning Content ({learningContents.length})
            </h2>

            {loadingContents ? (
              <p style={{ color: '#6b7280' }}>Loading learning contents...</p>
            ) : learningContents.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No learning content assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {learningContents.map((content, idx) => (
                  <div
                    key={`content-${content.id}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#fbbf24';
                      e.currentTarget.style.background = '#fef3c7';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1rem', margin: 0 }}>
                        {content.title || 'Untitled Content'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          color: '#4b5563', 
                          background: '#ffffff', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '0.25rem', 
                          border: '1px solid #e5e7eb' 
                        }}>
                          {content.content_type || 'Unknown Type'}
                        </span>
                        {content.assigned_by && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            Assigned by: {content.assigned_by}
                          </span>
                        )}
                        {content.from_program && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#7c3aed', 
                            background: '#f5f3ff', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '0.25rem' 
                          }}>
                            📚 From Program
                          </span>
                        )}
                        {!content.from_program && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: '#059669', 
                            background: '#d1fae5', 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '0.25rem' 
                          }}>
                            ✨ Extra Material
                          </span>
                        )}
                      </div>
                      {content.description && (
                        <p style={{ 
                          fontSize: '0.75rem', 
                          color: '#6b7280', 
                          marginTop: '0.25rem', 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {content.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleViewContent(content)}
                      style={{
                        marginLeft: '1rem',
                        background: 'linear-gradient(to right, #f59e0b, #d97706)',
                        color: '#ffffff',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Content Viewer Modal */}
      {showContentModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
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
            maxWidth: '80rem',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.5rem',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                  {selectedContent?.title}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ width: '0.5rem', height: '0.5rem', background: '#f59e0b', borderRadius: '9999px' }}></span>
                    {selectedContent?.content_type}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                <a
                  href={selectedContent?.file_url?.startsWith('http') ? selectedContent.file_url : selectedContent?.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.5rem',
                    color: '#4b5563',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Open in new tab"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#1f2937';
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#4b5563';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
                <button
                  onClick={handleCloseModal}
                  style={{
                    padding: '0.5rem',
                    color: '#4b5563',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Close"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#1f2937';
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#4b5563';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg style={{ width: '1.25rem', height: '1.25rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', overflow: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
              {contentLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      animation: 'spin 1s linear infinite',
                      borderRadius: '9999px',
                      height: '3rem',
                      width: '3rem',
                      borderWidth: '0 0 2px 0',
                      borderStyle: 'solid',
                      borderColor: '#d97706',
                      margin: '0 auto 1rem'
                    }}></div>
                    <p style={{ color: '#4b5563' }}>Loading content...</p>
                  </div>
                </div>
              ) : (
                renderContentViewer()
              )}
            </div>
          </div>
        </div>
      )}
      )
    </div>
  );
};

export default LearningContent;
