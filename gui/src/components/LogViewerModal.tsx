'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Copy, Check, Trash2, Download, ArrowDown } from 'lucide-react';
import { RecordingSession } from '@/lib/types';

interface LogViewerModalProps {
  session: RecordingSession | null;
  onClose: () => void;
}

export default function LogViewerModal({ session, onClose }: LogViewerModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    setLogs(session.logs || []);

    // Poll logs if session is running
    let interval: NodeJS.Timeout | null = null;
    if (session.status === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/recorder/logs?sessionId=${session.id}`);
          const data = await res.json();
          if (data.success && data.logs) {
            setLogs(data.logs);
          }
        } catch (e) {
          console.error('Failed fetching logs', e);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  if (!session) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const element = document.createElement('a');
    const file = new Blob([logs.join('\n')], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `log_${session.user}_${session.id}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090d16]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Session Logs: @{session.user}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold uppercase ${
                    session.status === 'running'
                      ? 'bg-[#fe2c55]/20 text-[#fe2c55] border border-[#fe2c55]/40 animate-pulse'
                      : session.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {session.id} | Mode: {session.mode}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                autoScroll ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <ArrowDown className="w-3.5 h-3.5" /> Auto-scroll
            </button>
            <button
              onClick={copyToClipboard}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Copy Logs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={downloadLogs}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Download Log File"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Logs Terminal Area */}
        <div className="p-6 bg-[#06080d] font-mono text-xs overflow-y-auto flex-1 space-y-1.5 text-slate-300 selection:bg-[#fe2c55] selection:text-white">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic py-8 text-center">Waiting for output logs...</div>
          ) : (
            logs.map((log, index) => {
              let color = 'text-slate-300';
              if (log.includes('[ERR]') || log.includes('Error') || log.includes('CRITICAL')) {
                color = 'text-red-400 font-semibold';
              } else if (log.includes('[SYS]')) {
                color = 'text-cyan-400 font-medium';
              } else if (log.includes('[*]') || log.includes('INFO')) {
                color = 'text-emerald-400';
              } else if (log.includes('[CMD]')) {
                color = 'text-yellow-400';
              }

              return (
                <div key={index} className={`leading-relaxed whitespace-pre-wrap ${color}`}>
                  <span className="text-slate-600 select-none mr-3">{String(index + 1).padStart(3, ' ')} |</span>
                  {log}
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
