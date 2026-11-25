import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axios';
import { toast } from 'react-toastify';
import { UserCheck, GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('trainer');
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'trainer' ? '/trainer/dashboard' : '/learner/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    let active = true;
    const fetchProfiles = async () => {
      setLoadingProfiles(true);
      try {
        const res = await axiosInstance.get(`/demo/profiles?role=${role}`);
        if (active) {
          setProfiles(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedProfileId(String(res.data[0].id));
          } else {
            setSelectedProfileId('');
          }
        }
      } catch (err) {
        if (active) {
          toast.error('Failed to load demo profiles. Please ensure backend is running.');
        }
      } finally {
        if (active) setLoadingProfiles(false);
      }
    };
    fetchProfiles();
    return () => {
      active = false;
    };
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProfileId) {
      toast.warning('Please select a profile to login');
      return;
    }
    setSubmitting(true);
    try {
      const loggedUser = await login(role, parseInt(selectedProfileId, 10));
      toast.success(`Logged in as ${loggedUser.name}`);
      navigate(loggedUser.role === 'trainer' ? '/trainer/dashboard' : '/learner/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4 border border-emerald-500/20">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Live Session Studio</h1>
          <p className="text-sm text-slate-400 mt-1">Standalone Trainer / Learner Live Classroom</p>
        </div>

        {/* Role toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800/80 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => setRole('trainer')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              role === 'trainer'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Trainer
          </button>
          <button
            type="button"
            onClick={() => setRole('learner')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              role === 'learner'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Learner
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Select Demo {role === 'trainer' ? 'Trainer' : 'Learner'}
            </label>
            {loadingProfiles ? (
              <div className="py-3 px-4 bg-slate-800 rounded-xl text-sm text-slate-400 animate-pulse">
                Loading profiles...
              </div>
            ) : profiles.length === 0 ? (
              <div className="py-3 px-4 bg-slate-800 rounded-xl text-sm text-amber-400">
                No demo profiles found for this role.
              </div>
            ) : (
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.title ? `(${p.title})` : ''} - {p.email}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Passwordless demo login. Session is isolated to this browser tab.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || profiles.length === 0}
            className={`w-full py-3 px-4 rounded-xl font-medium text-sm text-white flex items-center justify-center gap-2 transition-all shadow-lg ${
              role === 'trainer'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {submitting ? 'Signing in...' : `Enter as ${role === 'trainer' ? 'Trainer' : 'Learner'}`}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
