'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import QuickRecordModal from '@/components/QuickRecordModal';
import LogViewerModal from '@/components/LogViewerModal';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import {
  Radio,
  Film,
  HardDrive,
  Cpu,
  StopCircle,
  Terminal,
  Play,
  PlayCircle,
  Clock,
  User,
  Zap,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SystemStats, RecordingSession, VideoFile } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [recentVideos, setRecentVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick form state
  const [quickUser, setQuickUser] = useState<string>('');
  const [quickStarting, setQuickStarting] = useState<boolean>(false);
  const [quickError, setQuickError] = useState<string>('');

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [activeLogSession, setActiveLogSession] = useState<RecordingSession | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<VideoFile | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statusRes, videosRes] = await Promise.all([
        fetch('/api/recorder/status'),
        fetch('/api/recorder/videos'),
      ]);

      const statusData = await statusRes.json();
      const videosData = await videosRes.json();

      if (statusData.success) {
        setStats(statusData.stats);
        setSessions(statusData.sessions || []);
      }

      if (videosData.success) {
        setRecentVideos(videosData.videos?.slice(0, 6) || []);
      }
    } catch (e) {
      console.error('Failed loading dashboard data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 3000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleQuickStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUser.trim()) return;

    setQuickStarting(true);
    setQuickError('');

    try {
      const res = await fetch('/api/recorder/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: quickUser.trim(),
          mode: 'manual',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQuickUser('');
        fetchDashboardData();
      } else {
        setQuickError(data.error || 'Failed to start recording');
      }
    } catch (err: any) {
      setQuickError(err.message || 'Error initiating recording');
    } finally {
      setQuickStarting(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to stop this recording session?')) return;
    try {
      const res = await fetch('/api/recorder/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error('Failed stopping session', e);
    }
  };

  const handleDeleteVideo = async (filename: string) => {
    try {
      const res = await fetch('/api/recorder/videos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error('Failed deleting video', e);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'running');
  const pastSessions = sessions.filter((s) => s.status !== 'running').slice(0, 5);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          stats={stats}
          onRefresh={fetchDashboardData}
          onOpenNewRecordModal={() => setIsRecordModalOpen(true)}
        />

        <main className="p-6 md:p-8 space-y-8 flex-1">
          {/* Quick Recorder Bar */}
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border border-[#fe2c55]/30 bg-gradient-to-r from-[#0d121d] via-[#111726] to-[#141221]">
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#fe2c55]/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#fe2c55] animate-ping"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#fe2c55]">Instant Live Recorder</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  Record Any TikTok Live Stream
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-lg">
                  Enter TikTok username or URL to start capturing audio and video live streams immediately.
                </p>
              </div>

              <form onSubmit={handleQuickStart} className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-80">
                  <span className="absolute left-3.5 top-3 text-slate-500 font-semibold text-sm">@</span>
                  <input
                    type="text"
                    value={quickUser}
                    onChange={(e) => setQuickUser(e.target.value)}
                    placeholder="Enter TikTok username..."
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#fe2c55] focus:ring-1 focus:ring-[#fe2c55] transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={quickStarting || !quickUser.trim()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#fe2c55] to-[#ff0055] hover:from-[#e0264b] hover:to-[#e6004c] text-white font-semibold text-sm shadow-lg shadow-[#fe2c55]/30 transition-all disabled:opacity-50 shrink-0"
                >
                  {quickStarting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Record</span>
                    </>
                  )}
                </button>
              </form>
            </div>
            {quickError && <p className="text-xs text-red-400 mt-2 font-medium">{quickError}</p>}
          </div>

          {/* Top Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Active Recordings"
              value={stats?.activeRecordings ?? 0}
              subtitle="Live background tasks"
              icon={Radio}
              gradient="pink"
              badgeText={stats && stats.activeRecordings > 0 ? 'LIVE RECORDING' : 'IDLE'}
              pulse={Boolean(stats && stats.activeRecordings > 0)}
            />
            <StatCard
              title="Total Videos Captured"
              value={stats?.totalVideos ?? 0}
              subtitle="In output folder"
              icon={Film}
              gradient="cyan"
              badgeText="Vault Library"
            />
            <StatCard
              title="Storage Occupied"
              value={stats?.totalStorageFormatted ?? '0 B'}
              subtitle="Recorded media disk usage"
              icon={HardDrive}
              gradient="purple"
            />
            <StatCard
              title="Recorder Core"
              value={stats?.pythonAvailable ? 'Online' : 'Offline'}
              subtitle={stats?.ffmpegAvailable ? 'FFmpeg Ready' : 'FFmpeg Missing'}
              icon={Cpu}
              gradient="emerald"
              badgeText="Python 3.14"
            />
          </div>

          {/* Active Recording Sessions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#fe2c55] animate-ping"></div>
                <h3 className="text-lg font-bold text-white tracking-tight">Active Live Streams</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#fe2c55]/20 border border-[#fe2c55]/30 text-[#fe2c55] text-xs font-semibold font-mono">
                  {activeSessions.length}
                </span>
              </div>
            </div>

            {activeSessions.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl text-center border border-slate-800/80">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Radio className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-slate-300">No Active Recording Sessions</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Start a manual or automatic live recording above to capture TikTok live broadcasts in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className="glass-panel p-5 rounded-2xl border border-[#fe2c55]/40 bg-gradient-to-br from-[#121826] to-[#181120] relative overflow-hidden space-y-4 shadow-xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#fe2c55]/20 border border-[#fe2c55]/30 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-[#fe2c55] animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-white">@{session.user}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="capitalize px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                              Mode: {session.mode}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400 font-mono">PID: {session.pid || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Sound wave visualizer animation */}
                      <div className="flex items-center gap-1 h-5 px-2 py-1 rounded bg-[#fe2c55]/10 border border-[#fe2c55]/30">
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                        <span className="wave-bar"></span>
                      </div>
                    </div>

                    {/* Latest log snippet */}
                    <div className="bg-[#080b12] p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-400 truncate">
                      <span className="text-[#00f2fe] font-semibold">Latest: </span>
                      {session.logs[session.logs.length - 1] || 'Capturing live stream output...'}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => setActiveLogSession(session)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      >
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Live Terminal Logs</span>
                      </button>

                      <button
                        onClick={() => handleStopSession(session.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-semibold transition-colors"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>Stop Recording</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Recorded Clips Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Film className="w-5 h-5 text-[#00f2fe]" />
                <h3 className="text-lg font-bold text-white tracking-tight">Recent Recordings</h3>
              </div>
              <a
                href="/videos"
                className="text-xs text-[#00f2fe] hover:underline font-semibold flex items-center gap-1"
              >
                View Video Library →
              </a>
            </div>

            {recentVideos.length === 0 ? (
              <div className="glass-panel p-6 rounded-2xl text-center text-xs text-slate-500">
                No recorded videos in output folder yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentVideos.map((video) => (
                  <div
                    key={video.filename}
                    className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-[#00f2fe]/40 transition-all duration-300 group flex flex-col justify-between"
                  >
                    <div>
                      {/* Video Thumbnail placeholder card with Play icon */}
                      <div
                        onClick={() => setActiveVideoModal(video)}
                        className="h-36 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center relative cursor-pointer overflow-hidden group-hover:border-[#00f2fe]/60 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#fe2c55]/20 border border-[#fe2c55]/40 text-[#fe2c55] group-hover:scale-110 flex items-center justify-center transition-transform shadow-lg shadow-[#fe2c55]/20">
                          <Play className="w-6 h-6 fill-[#fe2c55] ml-0.5" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 mt-2 px-2 py-0.5 rounded bg-slate-950/80">
                          {video.format}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-bold text-sm text-white truncate" title={video.filename}>
                          {video.filename}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                          <span className="text-[#00f2fe] font-medium">{video.userTag}</span>
                          <span>{video.sizeFormatted}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/60 text-xs">
                      <span className="text-slate-500 text-[11px]">
                        {new Date(video.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setActiveVideoModal(video)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                        >
                          Play
                        </button>
                        <button
                          onClick={() => handleDeleteVideo(video.filename)}
                          className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <QuickRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={fetchDashboardData}
      />

      <LogViewerModal
        session={activeLogSession}
        onClose={() => setActiveLogSession(null)}
      />

      <VideoPlayerModal
        video={activeVideoModal}
        onClose={() => setActiveVideoModal(null)}
        onDelete={handleDeleteVideo}
      />
    </div>
  );
}
