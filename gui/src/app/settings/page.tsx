'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Settings as SettingsIcon, Save, Cookie, Send, Folder, Cpu, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { EngineSettings } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<EngineSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Local state for editing
  const [outputDir, setOutputDir] = useState<string>('');
  const [ffmpegPath, setFfmpegPath] = useState<string>('');
  const [proxy, setProxy] = useState<string>('');
  const [bitrate, setBitrate] = useState<string>('');
  const [noUpdateCheck, setNoUpdateCheck] = useState<boolean>(true);
  const [cookiesJson, setCookiesJson] = useState<string>('');
  const [telegramJson, setTelegramJson] = useState<string>('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recorder/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
        setOutputDir(data.settings.outputDir);
        setFfmpegPath(data.settings.ffmpegPath);
        setProxy(data.settings.proxy);
        setBitrate(data.settings.bitrate);
        setNoUpdateCheck(data.settings.noUpdateCheck);
        setCookiesJson(data.settings.cookiesJson);
        setTelegramJson(data.settings.telegramJson);
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    // Validate JSON string format
    try {
      JSON.parse(cookiesJson);
    } catch (e) {
      setError('Invalid JSON syntax in cookies.json!');
      setSaving(false);
      return;
    }

    try {
      JSON.parse(telegramJson);
    } catch (e) {
      setError('Invalid JSON syntax in telegram.json!');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/recorder/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputDir: outputDir.trim(),
          ffmpegPath: ffmpegPath.trim(),
          proxy: proxy.trim(),
          bitrate: bitrate.trim(),
          noUpdateCheck,
          cookiesJson,
          telegramJson,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Engine settings & credentials saved successfully!');
        setSettings(data.settings);
      } else {
        setError(data.error || 'Failed saving settings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="p-6 md:p-8 space-y-8 flex-1 max-w-5xl">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00f2fe] uppercase tracking-wider mb-1">
              <SettingsIcon className="w-4 h-4" /> System Configuration
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">Engine Settings & Integrations</h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure TikTok cookies, Telegram bot integration, output paths, and ffmpeg environment settings.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading settings...</div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {message && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* General Engine Options */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#00f2fe]" /> General Directory & Binary Options
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Output Directory Path
                    </label>
                    <input
                      type="text"
                      value={outputDir}
                      onChange={(e) => setOutputDir(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#00f2fe]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Directory where `.mp4` / `.ts` live streams are saved.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      FFmpeg Executable Binary Path
                    </label>
                    <input
                      type="text"
                      value={ffmpegPath}
                      onChange={(e) => setFfmpegPath(e.target.value)}
                      placeholder="ffmpeg or C:\ffmpeg\bin\ffmpeg.exe"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#00f2fe]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Specify custom path if FFmpeg is not in your PATH.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default HTTP Proxy (Optional)
                    </label>
                    <input
                      type="text"
                      value={proxy}
                      onChange={(e) => setProxy(e.target.value)}
                      placeholder="http://127.0.0.1:8080"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#00f2fe]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Default Output Bitrate (Optional)
                    </label>
                    <input
                      type="text"
                      value={bitrate}
                      onChange={(e) => setBitrate(e.target.value)}
                      placeholder="1M or 1000k"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#00f2fe]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={noUpdateCheck}
                      onChange={(e) => setNoUpdateCheck(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-[#fe2c55] focus:ring-0"
                    />
                    <span>Skip automatic recorder update check on startup (Faster execution)</span>
                  </label>
                </div>
              </div>

              {/* Cookies.json Editor */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cookie className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-bold text-base text-white">TikTok Cookies Config (`cookies.json`)</h3>
                      <p className="text-xs text-slate-400">Required to bypass TikTok bot protection & region login limits.</p>
                    </div>
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={cookiesJson}
                  onChange={(e) => setCookiesJson(e.target.value)}
                  className="w-full p-4 bg-[#06080d] border border-slate-800 rounded-xl font-mono text-xs text-amber-300/90 focus:outline-none focus:border-amber-500/60"
                  placeholder='{ "sessionid": "..." }'
                />
              </div>

              {/* Telegram.json Editor */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-base text-white">Telegram Integration (`telegram.json`)</h3>
                    <p className="text-xs text-slate-400">Upload recorded TikTok live streams directly to Telegram.</p>
                  </div>
                </div>

                <textarea
                  rows={5}
                  value={telegramJson}
                  onChange={(e) => setTelegramJson(e.target.value)}
                  className="w-full p-4 bg-[#06080d] border border-slate-800 rounded-xl font-mono text-xs text-cyan-300/90 focus:outline-none focus:border-cyan-500/60"
                  placeholder='{ "bot_token": "...", "chat_id": "..." }'
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#fe2c55] to-[#ff0055] hover:from-[#e0264b] text-white font-bold text-sm shadow-lg shadow-[#fe2c55]/25 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving Configuration...' : 'Save All Settings'}</span>
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
