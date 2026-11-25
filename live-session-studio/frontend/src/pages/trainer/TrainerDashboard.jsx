import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosInstance from '../../api/axios';
import { toast } from 'react-toastify';
import { Play, LogOut, FileText, Upload, RefreshCw, UserCheck, Video } from 'lucide-react';

export default function TrainerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [learners, setLearners] = useState([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    try {
      const [learnersRes, roomRes, matsRes] = await Promise.all([
        axiosInstance.get('/learners'),
        axiosInstance.get('/rooms/current'),
        axiosInstance.get('/materials'),
      ]);
      setLearners(learnersRes.data || []);
      if (learnersRes.data && learnersRes.data.length > 0 && !selectedLearnerId) {
        setSelectedLearnerId(String(learnersRes.data[0].id));
      }
      setCurrentRoom(roomRes.data?.room || null);
      setMaterials(matsRes.data?.materials || matsRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSession = async () => {
    if (!selectedLearnerId) {
      toast.warning('Please select a learner to start session');
      return;
    }
    setStarting(true);
    try {
      const res = await axiosInstance.post('/rooms', {
        learner_id: parseInt(selectedLearnerId, 10),
      });
      const room = res.data;
      toast.success(`Session created! ID: ${room.session_id}`);
      navigate(`/trainer/session/${room.session_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);
      const res = await axiosInstance.post('/materials', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Uploaded ${file.name}`);
      setMaterials((prev) => [res.data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Live Session Studio</h1>
            <p className="text-xs text-slate-400">Trainer Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium text-white">{user?.name}</div>
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Trainer</div>
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

      {/* Main dashboard body */}
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Active room resume card if any */}
        {currentRoom && (
          <div className="p-6 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Active Session In Progress
              </div>
              <h2 className="text-xl font-bold text-white">Session {currentRoom.session_id}</h2>
              <p className="text-sm text-slate-300 mt-1">
                Paired with learner: <span className="font-medium text-white">{currentRoom.learner_name || 'Assigned Learner'}</span>
              </p>
            </div>
            <button
              onClick={() => navigate(`/trainer/session/${currentRoom.session_id}`)}
              className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume Session
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start New Session */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                Start Live Session
              </h2>
              <button
                onClick={fetchData}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-400">
              Select a learner. Starting creates an active paired room and delivers a targeted invitation to their screen.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Target Learner
              </label>
              {loading ? (
                <div className="h-10 bg-slate-800 rounded-xl animate-pulse" />
              ) : learners.length === 0 ? (
                <div className="text-sm text-amber-400 p-3 bg-amber-500/10 rounded-xl">
                  No learners found.
                </div>
              ) : (
                <select
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} - {l.email}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              onClick={handleStartSession}
              disabled={starting || learners.length === 0}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
            >
              {starting ? (
                'Creating Session...'
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Start Live Session
                </>
              )}
            </button>
          </div>

          {/* Learning Materials Library */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Learning Materials
              </h2>
              <label className="cursor-pointer inline-flex items-center gap-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Add Material'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  accept="application/pdf,image/*,video/*,audio/*"
                />
              </label>
            </div>

            <p className="text-sm text-slate-400">
              Upload PDF documents, images, audio, or video files to use on the live session whiteboard canvas.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {materials.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                  No materials uploaded yet. Upload a PDF or image above.
                </div>
              ) : (
                materials.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-800"
                  >
                    <div className="truncate mr-2">
                      <div className="text-sm font-medium text-slate-200 truncate">{m.title}</div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider">{m.content_type || m.type}</div>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">Ready</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
