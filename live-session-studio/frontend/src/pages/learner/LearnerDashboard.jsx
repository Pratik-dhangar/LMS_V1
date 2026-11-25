import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../api/axios';
import { toast } from 'react-toastify';
import { Video, LogOut, Play, Radio, Clock, ShieldAlert } from 'lucide-react';

export default function LearnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const pollTimerRef = useRef(null);

  const fetchInvitations = async () => {
    try {
      const res = await axiosInstance.get('/invitations/mine');
      setInvitations(res.data?.invitations || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      console.error('Error polling invitations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();

    // 3-second targeted polling interval as required by spec
    pollTimerRef.current = setInterval(fetchInvitations, 3000);

    const handleFocus = () => fetchInvitations();
    window.addEventListener('focus', handleFocus);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleJoin = async (invitation) => {
    const sessionId = invitation.session_id || invitation.session_str_id;
    setJoining(true);
    try {
      await axiosInstance.post(`/rooms/${sessionId}/join`);
      navigate(`/learner/session/${sessionId}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to join session');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Live Session Studio</h1>
            <p className="text-xs text-slate-400">Learner Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-white">{user?.name}</div>
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Learner</div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main body */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-400" />
                Live Session Invitations
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Targeted invitations delivered exclusively from your assigned trainer.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Checking every 3s
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
              Scanning for incoming session invitations...
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-300">No Active Sessions Right Now</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                When your trainer starts a live session with you, a prompt will appear right here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((inv) => (
                <div
                  key={inv.id || inv.session_id}
                  className="p-6 bg-gradient-to-r from-blue-950/40 to-slate-900 border border-blue-500/30 rounded-2xl flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      Session Ready
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      Live Class with {inv.trainer_name || 'Trainer'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Session ID: <span className="font-mono text-slate-300">{inv.session_id}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleJoin(inv)}
                    disabled={joining}
                    className="py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {joining ? 'Connecting...' : 'Join Session'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
