'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Search, Radio, CheckCircle2, XCircle, Play, RefreshCw, Sparkles, Terminal, AlertTriangle } from 'lucide-react';
import { LiveStatusResult } from '@/lib/types';

export default function LiveMonitorPage() {
  const [target, setTarget] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<LiveStatusResult | null>(null);
  const [error, setError] = useState<string>('');
  const [startMsg, setStartMsg] = useState<string>('');

  const handleCheckLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) return;

    setLoading(true);
    setError('');
    setStartMsg('');
    setResult(null);

    try {
      const res = await fetch('/api/recorder/check-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim() }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
      } else {
        setError(data.error || 'Failed checking TikTok live status.');
      }
    } catch (err: any) {
      setError(err.message || 'Error executing live check.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!result?.username) return;

    try {
      const res = await fetch('/api/recorder/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: result.username,
          mode: 'manual',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStartMsg(`Recording process initiated for @${result.username}!`);
      } else {
        setError(data.error || 'Failed to start recording');
      }
    } catch (err: any) {
      setError(err.message || 'Error starting recording process');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-6 md:p-8 space-y-8 flex-1 max-w-6xl">
          {/* Header section */}
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-[#00f2fe] uppercase tracking-wider">
              <Radio className="w-4 h-4 animate-pulse" /> TikTok Stream Inspector
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">Live Monitor & Status Checker</h1>
            <p className="text-xs text-slate-400 mt-1">
              Verify if a TikTok creator is currently live before initializing a recording session.
            </p>
          </div>

          {/* Search Box */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <form onSubmit={handleCheckLive} className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full">
                <span className="absolute left-4 top-3 text-slate-500 font-semibold text-sm">@</span>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Enter username (e.g. khaby.lame or tiktok handle)"
                  className="w-full pl-9 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00f2fe] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !target.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#00b4d8] hover:from-[#00c9d4] hover:to-[#0090ad] text-slate-950 font-bold text-sm shadow-lg shadow-[#00f2fe]/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Checking TikTok...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Check Status</span>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {startMsg && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{startMsg}</span>
              </div>
            )}
          </div>

          {/* Results Display */}
          {result && (
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-lg ${
                      result.isLive
                        ? 'bg-[#fe2c55]/20 border-[#fe2c55]/40 text-[#fe2c55] shadow-[#fe2c55]/20'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Radio className={`w-7 h-7 ${result.isLive ? 'animate-pulse' : ''}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">@{result.username}</h2>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">
                      Checked at: {new Date(result.checkedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                      result.isLive
                        ? 'bg-[#fe2c55]/20 text-[#fe2c55] border-[#fe2c55]/40 live-badge-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {result.isLive ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#fe2c55] animate-ping"></span>
                        <span>CURRENTLY LIVE</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>OFFLINE</span>
                      </>
                    )}
                  </div>

                  {result.isLive && (
                    <button
                      onClick={handleStartRecording}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#fe2c55] to-[#ff0055] hover:from-[#e0264b] text-white font-bold text-xs shadow-lg shadow-[#fe2c55]/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Recording Live Now</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Room Identifier</span>
                  <p className="text-sm font-mono font-semibold text-white">
                    {result.roomId || 'No Room ID detected'}
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stream Status</span>
                  <p className={`text-sm font-semibold ${result.isLive ? 'text-[#fe2c55]' : 'text-slate-400'}`}>
                    {result.isLive ? 'Live broadcast detected' : 'User is not broadcasting live right now'}
                  </p>
                </div>
              </div>

              {/* Raw Python Engine Output */}
              {result.rawOutput && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Python Inspection Output
                  </span>
                  <pre className="bg-[#06080d] p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {result.rawOutput}
                  </pre>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
