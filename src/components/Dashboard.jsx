import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LogOut, QrCode, CheckCircle2, History, AlertCircle, Camera, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ present: 0, total: 0, percentage: 100 });
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) throw new Error('Not authenticated');
        
        // Use user email prefix as name fallback
        const name = user.user_metadata?.full_name || user.email.split('@')[0];
        setUser({ ...user, displayName: name, photoUrl: user.user_metadata?.photo_url });

        await fetchAttendanceData(user.id);
      } catch (err) {
        console.error(err);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const fetchAttendanceData = async (userId) => {
    try {
      // Fetch recent logs with session details
      const { data: logsData, error: logsError } = await supabase
        .from('nexus_attendance_logs')
        .select(`
          id,
          timestamp,
          status,
          nexus_attendance_sessions (
            name,
            location_name
          )
        `)
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;

      setLogs(logsData || []);

      // Calculate stats (Mock logic for overall stats since we might not have total sessions)
      const presentCount = logsData?.filter(log => log.status === 'Present').length || 0;
      setStats({
        present: presentCount,
        total: logsData?.length || 0,
        percentage: logsData?.length ? Math.round((presentCount / logsData.length) * 100) : 0
      });
    } catch (err) {
      console.error('Error fetching logs', err);
      setError('Failed to load attendance history.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingPhoto(true);
      setError('');

      // Read file as Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result;
        
        // POST to Google Apps Script Web App
        const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
        
        if (!scriptUrl) {
          throw new Error('VITE_GOOGLE_SCRIPT_URL is not configured.');
        }

        const response = await fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors', // Apps script web apps often require no-cors for simple POSTs
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Data,
            filename: `${user.id}_photo.jpg`,
            mimeType: file.type
          })
        });

        // Since no-cors hides the response, we assume success if it didn't throw
        // Now update the user's metadata in Supabase to mark that they have a photo
        // For actual display, we might need a direct URL. We'll use a local fallback for preview.
        
        const localPreviewUrl = URL.createObjectURL(file);
        setUser(prev => ({ ...prev, photoUrl: localPreviewUrl }));

        const { error: updateError } = await supabase.auth.updateUser({
          data: { photo_url: 'uploaded_to_drive' } // We don't get the drive URL back due to no-cors, so we just set a flag.
        });

        if (updateError) throw updateError;
      };
      
      reader.onerror = () => {
        throw new Error('Failed to read file.');
      };

    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-nexus-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto pb-24">
      {/* Header */}
      <header className="flex justify-between items-center py-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover border-2 border-nexus-primary/30" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-nexus-primary/20 text-nexus-primary flex items-center justify-center font-bold text-lg uppercase border-2 border-nexus-primary/30">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
            )}
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 bg-nexus-bg border border-nexus-primary/50 text-nexus-primary p-1 rounded-full hover:bg-nexus-primary/20 transition-colors"
            >
              {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handlePhotoUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <div>
            <h2 className="text-white font-medium capitalize">{user?.displayName}</h2>
            <p className="text-nexus-muted text-xs">Student ID: {user?.id.substring(0, 8)}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 text-nexus-muted hover:text-white transition-colors bg-white/5 rounded-full">
          <LogOut size={18} />
        </button>
      </header>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-5 flex flex-col items-center justify-center text-center">
          <div className="relative w-16 h-16 mb-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${stats.percentage >= 75 ? 'text-nexus-success' : 'text-nexus-error'}`}
                strokeDasharray={`${stats.percentage}, 100`}
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{stats.percentage}%</span>
            </div>
          </div>
          <span className="text-xs text-nexus-muted">Overall Attendance</span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="glass-card p-4 flex-1 flex flex-col justify-center">
            <span className="text-2xl font-bold text-white mb-1">{stats.present}</span>
            <span className="text-xs text-nexus-muted">Days Present</span>
          </div>
          <div className="glass-card p-4 flex-1 flex flex-col justify-center">
            <span className="text-sm font-medium text-nexus-success flex items-center gap-1">
              <CheckCircle2 size={14} /> Good Standing
            </span>
          </div>
        </div>
      </div>

      {/* Primary Action */}
      <div className="flex justify-center mb-10">
        <button
          onClick={() => navigate('/scan')}
          className="pulse-glow relative bg-nexus-primary text-black w-48 h-48 rounded-full flex flex-col items-center justify-center gap-3 shadow-lg shadow-nexus-primary/20 transition-transform active:scale-95"
        >
          <QrCode size={48} strokeWidth={1.5} />
          <span className="font-semibold text-lg">Scan QR</span>
          <span className="text-xs opacity-70">Mark Attendance</span>
        </button>
      </div>

      {/* History Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <History size={18} className="text-nexus-primary" />
            <h3 className="font-semibold">Recent Logs</h3>
          </div>
          <button 
            onClick={() => navigate('/gallery')}
            className="text-nexus-primary text-sm font-medium hover:underline flex items-center gap-1"
          >
            View Gallery
          </button>
        </div>
        
        {error && (
          <div className="bg-nexus-error-bg text-nexus-error p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center p-6 border border-white/5 rounded-xl text-nexus-muted text-sm">
              No attendance logs found.
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{log.nexus_attendance_sessions?.name || 'Unknown Session'}</h4>
                  <p className="text-xs text-nexus-muted mt-1">
                    {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-nexus-success bg-nexus-success-bg px-2 py-1 rounded-md">
                  <CheckCircle2 size={12} />
                  <span className="text-xs font-medium">Verified</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
