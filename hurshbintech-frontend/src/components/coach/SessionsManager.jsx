import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import coachService from '../../api/services/coachService';
import { toast } from 'react-toastify';
import SearchBar from '../common/SearchBar';
import '../../styles/coach/SessionsManager.css';
import '../../styles/Table.css';
import '../../styles/Pages.css';

const SessionsManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const sessionsData = await coachService.getMySessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const getSessionStatus = (session) => {
    if (session.status === 'cancelled') {
      return 'cancelled';
    }
    if (session.status === 'active') {
      return 'active';
    }
    if (session.status === 'ended') {
      return 'ended';
    }
    if (session.status === 'scheduled' && session.session_date) {
      try {
        const now = new Date();
        const scheduled = new Date(session.session_date);
        const sessionTime = session.session_time || '10am';
        
        const timeParts = sessionTime.match(/(\d+)(am|pm)/i);
        if (timeParts) {
          let hours = parseInt(timeParts[1]);
          const meridiem = timeParts[2].toLowerCase();
          if (meridiem === 'pm' && hours !== 12) hours += 12;
          if (meridiem === 'am' && hours === 12) hours = 0;
          scheduled.setHours(hours, 0, 0, 0);
        }
        
        const durationMs = 60 * 60 * 1000;
        const sessionEndTime = new Date(scheduled.getTime() + durationMs);
        
        if (now >= sessionEndTime) {
          return 'expired';
        }
      } catch (e) {
        console.warn('Error parsing session date:', e);
      }
    }
    return session.status;
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      expired: 'bg-gray-300 text-gray-900'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || getSessionStatus(session) === filter;
    const matchesSearch = !searchTerm ||
      session.session_title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || (session.session_date && session.session_date.slice(0, 10) === dateFilter);
    return matchesFilter && matchesSearch && matchesDate;
  });

  if (loading) {
    return <div className="loading-container">Loading sessions...</div>;
  }

  return (
    <div className="sessions-manager">
      <div className="search-section search-section-extended">
        <SearchBar
          onSearch={setSearchTerm}
          placeholder="Search by session title..."
        />
        <div className="date-filter-group">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="form-input"
            aria-label="Filter by date"
            title="Filter sessions by date"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="btn-icon-secondary"
              title="Clear date filter"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => navigate('/coach/sessions/create')}
          className="btn-success"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="icon-sm" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create Session
        </button>
      </div>

      <div className="filter-tabs">
        <button
          onClick={() => setFilter('all')}
          className={`filter-tab ${filter === 'all' ? 'filter-tab-active' : ''}`}
        >
          All ({sessions.length})
        </button>
        <button
          onClick={() => setFilter('scheduled')}
          className={`filter-tab ${filter === 'scheduled' ? 'filter-tab-active' : ''}`}
        >
          Scheduled ({sessions.filter(s => getSessionStatus(s) === 'scheduled').length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`filter-tab ${filter === 'active' ? 'filter-tab-active' : ''}`}
        >
          Active ({sessions.filter(s => s.status === 'active').length})
        </button>
        <button
          onClick={() => setFilter('ended')}
          className={`filter-tab ${filter === 'ended' ? 'filter-tab-active' : ''}`}
        >
          Completed ({sessions.filter(s => s.status === 'ended').length})
        </button>
        <button
          onClick={() => setFilter('cancelled')}
          className={`filter-tab ${filter === 'cancelled' ? 'filter-tab-active' : ''}`}
        >
          Cancelled ({sessions.filter(s => s.status === 'cancelled').length})
        </button>
      </div>

      <div className="table-primary-container">
        {filteredSessions.length === 0 ? (
          <div className="table-primary-empty">
            <p className="table-primary-empty-title">No {filter !== 'all' ? filter : ''} sessions found</p>
            <p className="table-primary-empty-description">Create a new session to get started</p>
          </div>
        ) : (
          <div className="table-primary-wrapper">
            <table className="table-primary">
              <thead className="table-primary-header">
                <tr>
                  <th className="table-primary-th">Session Title</th>
                  <th className="table-primary-th">Date</th>
                  <th className="table-primary-th">Time</th>
                  <th className="table-primary-th">Participants</th>
                  <th className="table-primary-th">Status</th>
                  <th className="table-primary-th">Actions</th>
                </tr>
              </thead>
              <tbody className="table-primary-body">
                {filteredSessions.map((session) => (
                  <tr key={session.id} className="table-primary-row">
                    <td className="table-primary-td">
                      <div className="table-primary-cell-name-text">
                        {session.session_title || 'Untitled Session'}
                      </div>
                      {session.description && (
                        <div className="table-primary-cell-subtitle">{session.description}</div>
                      )}
                    </td>
                    <td className="table-primary-td">
                      <div>
                        {session.session_date
                          ? new Date(session.session_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="table-primary-td">
                      <div>{session.session_time || 'N/A'}</div>
                    </td>
                    <td className="table-primary-td">
                      <div>
                        {session.participants?.length || 0} participant(s)
                      </div>
                    </td>
                    <td className="table-primary-td">
                      <span className={`status-badge ${getStatusBadge(getSessionStatus(session))}`}>
                        {getSessionStatus(session) === 'expired' ? 'Expired' : getSessionStatus(session).charAt(0).toUpperCase() + getSessionStatus(session).slice(1)}
                      </span>
                    </td>
                    <td className="table-primary-td">
                      <div className="actions-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/coach/sessions/${session.id}`)}
                          className="btn btn-secondary"
                          title="View session details"
                          style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                        >
                          👁️ View
                        </button>
                        {getSessionStatus(session) === 'scheduled' && (
                          <button
                            onClick={() => navigate(`/coach/sessions/edit/${session.id}`)}
                            className="btn-primary"
                            title="Edit this session"
                            style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          >
                            ✏️ Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionsManager;
