import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/layout/Navbar";
import Footer from "../../components/layout/Footer";
import sessionService from "../../api/services/sessionService";
import "../../styles/admin/index.css";

const MySessions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sessionErrorToastShownRef = useRef(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Track which sessions have been joined - persist to localStorage
  const [joinedSessions, setJoinedSessions] = useState(() => {
    const saved = localStorage.getItem('joinedSessions');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    fetchSessions();

    // Auto-refresh sessions every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('[MySessions] Auto-refreshing sessions...');
      fetchSessions();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist joinedSessions to localStorage
  useEffect(() => {
    localStorage.setItem('joinedSessions', JSON.stringify([...joinedSessions]));
  }, [joinedSessions]);

  const fetchSessions = async () => {
    try {
      const data = await sessionService.getLearnerSessions();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      if (!sessionErrorToastShownRef.current) {
        sessionErrorToastShownRef.current = true;
      }
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleJoinSession = (sessionId) => {
    // Mark this session as joined
    setJoinedSessions(prev => new Set([...prev, sessionId]));
    navigate(`/learner/session/${sessionId}`);
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="admin-dashboard-container">
      <Navbar />

      <main className="admin-dashboard-main">
        <div className="admin-dashboard-content-wrapper">
          {/* Page Header */}
          <div className="admin-dashboard-header">
            <h1 className="admin-dashboard-title">
              My Sessions (IIP)
            </h1>
          </div>

          {/* Upcoming Sessions */}
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
              My Sessions
            </h2>

            {loadingSessions ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>No sessions scheduled.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sessions
                  .sort((a, b) => {
                    // Sort by status priority: active first, then scheduled, then others
                    const statusPriority = { active: 0, scheduled: 1, ended: 2 };
                    const aPriority = statusPriority[a.status] ?? 3;
                    const bPriority = statusPriority[b.status] ?? 3;
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    // Within same status, sort by date (newest first)
                    return new Date(b.scheduled_date || 0) - new Date(a.scheduled_date || 0);
                  })
                  .map((session) => {
                    const isActive = session.status === 'active';
                    const isScheduled = session.status === 'scheduled';
                    const isEnded = session.status === 'ended';
                    
                    const statusColor = isActive ? { border: '#10b981', bg: '#d1fae5' } :
                      isScheduled ? { border: '#f59e0b', bg: '#fef3c7' } :
                        { border: '#d1d5db', bg: '#f9fafb' };
                    const statusBadge = isActive ? { bg: '#d1fae5', color: '#065f46' } :
                      isScheduled ? { bg: '#fef3c7', color: '#92400e' } :
                        { bg: '#f3f4f6', color: '#1f2937' };

                    return (
                      <div
                        key={session.session_id || session.id}
                        style={{
                          borderLeft: `4px solid ${statusColor.border}`,
                          borderRadius: '0.5rem',
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: statusColor.bg,
                          transition: 'all 0.2s',
                          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontWeight: '600', color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                              {session.title || `Session with ${session.trainer?.name || session.trainer_name || 'Trainer'}`}
                            </h3>
                            <span style={{
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              background: statusBadge.bg,
                              color: statusBadge.color
                            }}>
                              {(session.status || 'scheduled').charAt(0).toUpperCase() + (session.status || 'scheduled').slice(1)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: '#4b5563' }}>
                            <span>📅 {formatShortDate(session.scheduled_date ?? session.started_at)}</span>
                            {session.scheduled_date && (
                              <span>🕐 {new Date(session.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                            <span>👨‍🏫 {session.trainer?.name || session.trainer_name || '—'}</span>
                            {session.duration && <span>⏱️ {session.duration} min</span>}
                          </div>
                          {session.program && (
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Program: {session.program}</p>
                          )}
                        </div>

                        <div style={{ marginLeft: '1rem', flexShrink: 0 }}>
                          {(isActive || isScheduled) && (
                            <button
                              onClick={() => handleJoinSession(session.session_id)}
                              style={{
                                background: 'linear-gradient(to right, #f59e0b, #d97706)',
                                color: '#ffffff',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #d97706, #ea580c)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(to right, #f59e0b, #d97706)'}
                            >
                              {joinedSessions.has(session.session_id) ? 'Rejoin Session' : 'Join Session'}
                            </button>
                          )}
                          {isEnded && (
                            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Completed</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default MySessions;
