import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react';
import headService from '../../api/services/headService';
import '../../styles/admin/index.css';

const MigrateStudent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [learners, setLearners] = useState([]);
  const [heads, setHeads] = useState([]);
  const [error, setError] = useState('');
  
  const [selectedLearner, setSelectedLearner] = useState('');
  const [selectedHead, setSelectedHead] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [learnersData, headsData] = await Promise.all([
        headService.getAllLearners(),
        headService.getActiveHeadsList()
      ]);
      
      setLearners(learnersData);
      setHeads(headsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load necessary data. Please try again.');
      toast.error('Failed to load data', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async (e) => {
    e.preventDefault();
    if (!selectedLearner || !selectedHead) {
      toast.warning('Please select both a student and a destination head.', { position: 'top-center' });
      return;
    }

    try {
      setSubmitting(true);
      await headService.migrateLearner(selectedLearner, selectedHead);
      
      toast.success('Student migrated successfully!', { position: 'top-center' });
      
      // Reset selections and refresh data
      setSelectedLearner('');
      setSelectedHead('');
      await fetchData();
      
    } catch (err) {
      console.error('Migration failed:', err);
      toast.error(err.response?.data?.detail || 'Failed to migrate student. Please try again.', { position: 'top-center' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <main className="page-main">
        <div className="page-content">
          <div className="page-header">
            <button onClick={() => navigate("/head/dashboard")} className="back-button">
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </button>
            <div>
              <h1 className="page-title">Migrate Student</h1>
              <p className="page-description">Transfer a student's management to another Head</p>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <div className="error-message-content">
                <AlertCircle className="icon-md error-icon" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading-container">
              <Loader2 className="loading-spinner" />
              <p className="loading-text">Loading...</p>
            </div>
          ) : (
            <div className="admin-form-container" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem' }}>
              <form onSubmit={handleMigrate} className="admin-form">
                <div className="admin-form-group">
                  <label htmlFor="learner-select" className="admin-form-label">
                    Select Student
                  </label>
                  <select
                    id="learner-select"
                    value={selectedLearner}
                    onChange={(e) => setSelectedLearner(e.target.value)}
                    className="admin-form-input"
                    required
                  >
                    <option value="">-- Choose a student --</option>
                    {learners.map((learner) => (
                      <option key={learner.id} value={learner.id}>
                        {learner.name} ({learner.email || 'No email'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group" style={{ marginTop: '1.5rem' }}>
                  <label htmlFor="head-select" className="admin-form-label">
                    Select Destination Head
                  </label>
                  <select
                    id="head-select"
                    value={selectedHead}
                    onChange={(e) => setSelectedHead(e.target.value)}
                    className="admin-form-input"
                    required
                  >
                    <option value="">-- Choose new head --</option>
                    {heads.map((head) => (
                      <option key={head.id} value={head.id}>
                        {head.name || 'Unknown Head'} ({head.email || 'No email'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={submitting || !selectedLearner || !selectedHead}
                    className="app-modal-btn app-modal-btn--success"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Migrating...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft size={18} />
                        Migrate Student
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MigrateStudent;
