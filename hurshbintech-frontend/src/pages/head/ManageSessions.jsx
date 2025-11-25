import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import sessionService from '../../api/services/sessionService';
import SearchBar from '../../components/common/SearchBar';

const ManageSessions = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  // const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      // Assuming we need to create an endpoint for head to get all sessions
      const data = await sessionService.getAllSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredSessions = sessions.filter(session => {
    const matchesFilter = filter === 'all' || session.status === filter;
    const matchesSearch = !searchTerm ||
      session.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.trainer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.learner_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || (session.scheduled_date && session.scheduled_date.slice(0, 10) === dateFilter);
    return matchesFilter && matchesSearch && matchesDate;
  });

  return (
    <div className="  flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 md:px-4 md:py-6">
          {/* Header */}
          <div className="mb-8">

            <h1 className="text-3xl font-bold text-gray-800 border-b-2 border-gray-800 pb-3 md:text-2xl">
              Manage Training Sessions
            </h1>
            <p className="text-gray-600 mt-2">View and manage all training sessions</p>
          </div>

          {/* Search and Add Section */}
          {/* <div className="flex flex-wrap justify-center items-center gap-2 mb-6">
            <div className="flex-1 min-w-[200px]">
              <SearchBar
                onSearch={setSearchTerm}
                placeholder="Search sessions by title, trainer, or learner..."
              />
            </div>
            <button
              onClick={() => navigate('/head/schedule-session')}
              className="bg-[#27ae60] hover:bg-[#219a54] text-white px-4 py-2 rounded font-medium flex items-center shrink-0"
            >
              <span className="mr-1">+</span>
              Schedule Session
            </button>
          </div> */}
          <div className="mb-8 flex flex-wrap justify-center items-center gap-4">

            <SearchBar
              onSearch={setSearchTerm}
              placeholder="Search by title, trainer, or learner..."
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter by date"
                title="Filter sessions by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  title="Clear date filter"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => navigate('/head/schedule-session')}
              className="bg-[#27ae60] hover:bg-[#229954] text-white py-3 px-5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Schedule Session
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded font-medium ${filter === 'all'
                ? 'bg-[#34495e] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setFilter('scheduled')}
              className={`px-4 py-2 rounded font-medium ${filter === 'scheduled'
                ? 'bg-[#34495e] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Scheduled ({sessions.filter(s => s.status === 'scheduled').length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded font-medium ${filter === 'active'
                ? 'bg-[#34495e] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Active ({sessions.filter(s => s.status === 'active').length})
            </button>
            <button
              onClick={() => setFilter('ended')}
              className={`px-4 py-2 rounded font-medium ${filter === 'ended'
                ? 'bg-[#34495e] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Completed ({sessions.filter(s => s.status === 'ended').length})
            </button>
          </div>

          {/* Sessions Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No {filter !== 'all' ? filter : ''} sessions found</p>
                <p className="text-sm mt-2">Schedule a new session to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#34495e]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Session Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Trainer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Learner
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Scheduled Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                        Materials
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{session.title}</div>
                          {session.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">{session.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {session.trainer_name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {session.learner_name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {session.scheduled_date
                              ? new Date(session.scheduled_date).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{session.duration} min</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(session.status)}`}>
                            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col gap-1">
                            {session.learning_goals && session.learning_goals.length > 0 && (
                              <span className="text-xs text-green-600">
                                {session.learning_goals.length} Goal(s)
                              </span>
                            )}
                            {session.learning_contents && session.learning_contents.length > 0 && (
                              <span className="text-xs text-blue-600">
                                {session.learning_contents.length} Content(s)
                              </span>
                            )}
                            {(!session.learning_goals || session.learning_goals.length === 0) &&
                              (!session.learning_contents || session.learning_contents.length === 0) && (
                                <span className="text-xs text-gray-400">No materials</span>
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

        <Footer />
      </main>
    </div>


  );
};

export default ManageSessions;
