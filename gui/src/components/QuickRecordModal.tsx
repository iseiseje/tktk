'use client';

import { useState } from 'react';
import { X, Play, Radio, Shield, Send, Sliders, AlertCircle, Sparkles } from 'lucide-react';

interface QuickRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function QuickRecordModal({ isOpen, onClose, onSuccess }: QuickRecordModalProps) {
  const [user, setUser] = useState('');
  const [url, setUrl] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'manual' | 'automatic' | 'followers'>('manual');
  const [interval, setInterval] = useState(5);
  const [duration, setDuration] = useState<string>('');
  const [proxy, setProxy] = useState('');
  const [bitrate, setBitrate] = useState('');
  const [telegram, setTelegram] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !url && !roomId && mode !== 'followers') {
      setError('Please provide a TikTok Username, Live URL, or Room ID.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/recorder/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: user.trim(),
          url: url.trim(),
          roomId: roomId.trim(),
          mode,
          interval: mode === 'automatic' ? Number(interval) : undefined,
          duration: duration ? Number(duration) : undefined,
          proxy: proxy.trim(),
          bitrate: bitrate.trim(),
          telegram,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(data.error || 'Failed to start recording session');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090d16]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#fe2c55] to-[#ff0055] p-[2px] flex items-center justify-center shadow-lg shadow-[#fe2c55]/20">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <Radio className="w-4 h-4 text-[#fe2c55] animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white text-base">New TikTok Live Recording</h3>
              <p className="text-xs text-slate-400">Configure & launch recording session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Recording Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'manual', name: 'Manual', desc: 'Record live immediately' },
                { id: 'automatic', name: 'Automatic', desc: 'Poll user interval' },
                { id: 'followers', name: 'Followers', desc: 'All followed accounts' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mode === m.id
                      ? 'bg-gradient-to-br from-[#fe2c55]/20 to-[#00f2fe]/10 border-[#fe2c55] text-white shadow-md shadow-[#fe2c55]/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <p className="font-semibold text-xs">{m.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* User / URL / Room ID inputs */}
          {mode !== 'followers' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  TikTok Username <span className="text-[#fe2c55]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">@</span>
                  <input
                    type="text"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="khaby.lame"
                    className="w-full pl-8 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#fe2c55] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Or Live Stream URL</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://tiktok.com/@user/live"
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f2fe] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Or TikTok Room ID</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="71234567890..."
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f2fe] transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Automatic mode interval */}
          {mode === 'automatic' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Polling Check Interval (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-[#00f2fe]"
              />
            </div>
          )}

          {/* Optional Advanced Parameters */}
          <div className="p-3.5 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-[#00f2fe]" /> Advanced Controls
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Duration Limit (Seconds)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 3600 (Optional)"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Custom Bitrate</label>
                <input
                  type="text"
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value)}
                  placeholder="e.g. 1M or 1000k (Optional)"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={telegram}
                  onChange={(e) => setTelegram(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-[#fe2c55] focus:ring-0"
                />
                <span className="flex items-center gap-1">
                  <Send className="w-3 h-3 text-cyan-400" /> Upload to Telegram when done
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#fe2c55] to-[#ff0055] hover:from-[#e0264b] hover:to-[#e6004c] text-white font-medium text-xs shadow-lg shadow-[#fe2c55]/25 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Initializing Process...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Recording Now</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
