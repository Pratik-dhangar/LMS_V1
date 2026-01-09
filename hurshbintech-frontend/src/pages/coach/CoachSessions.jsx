import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import coachService from '../../api/services/coachService';
import SessionsManager from '../../components/coach/SessionsManager';
import { Plus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import '../../styles/coach/CoachSessions.css';

const CoachSessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await coachService.getMySessions();
      setSessions(data);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load sessions');
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coach-sessions-container">
      <Navbar />
      <main className="coach-sessions-main">
        <div className="coach-sessions-content-wrapper">
          {/* Header */}
          <div className="coach-sessions-header">
            <div>
              <h1 className="coach-sessions-title">Manage Sessions</h1>
              <p className="coach-sessions-subtitle">
                Create and manage group coaching sessions with learners, trainers, and heads
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-success btn-icon"
            >
              {showForm ? <X className="icon-sm" /> : <Plus className="icon-sm" />}
              {showForm ? 'Cancel' : 'Create Session'}
            </button>
          </div>

          {/* Sessions Manager Component */}
          <div className="coach-sessions-content">
            <SessionsManager showForm={showForm} setShowForm={setShowForm} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CoachSessions;
