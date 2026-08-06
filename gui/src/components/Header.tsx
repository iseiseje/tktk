'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, RefreshCw, Radio, HardDrive, CheckCircle2, AlertCircle } from 'lucide-react';
import { SystemStats } from '@/lib/types';

interface HeaderProps {
  stats?: SystemStats | null;
  onRefresh?: () => void;
  onOpenNewRecordModal?: () => void;
}

export default function Header({ stats, onRefresh, onOpenNewRecordModal }: HeaderProps) {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800/60 bg-[#090d16]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Status Badges */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
          <span className="text-slate-500 font-mono">CLOCK</span>
          <span suppressHydrationWarning className="font-mono text-emerald-400 font-semibold">{time || '00:00:00'}</span>
        </div>

        {stats && (
          <div className="flex items-center gap-3">
            {/* Active Jobs */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${stats.activeRecordings > 0 ? 'bg-[#fe2c55] animate-ping' : 'bg-slate-600'}`}></span>
              <span className="text-slate-400">Active:</span>
              <span className={`font-semibold ${stats.activeRecordings > 0 ? 'text-[#fe2c55]' : 'text-slate-300'}`}>
                {stats.activeRecordings} session{stats.activeRecordings !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Python / FFmpeg checks */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
              <span className="text-slate-400">Engine:</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Python
              </span>
              <span className="text-slate-600">|</span>
              {stats.ffmpegAvailable ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> FFmpeg
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400" title="FFmpeg not found in path, post-processing might be limited">
                  <AlertCircle className="w-3.5 h-3.5" /> No FFmpeg
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition-all border border-slate-700/50"
            title="Refresh Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {onOpenNewRecordModal && (
          <button
            onClick={onOpenNewRecordModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#fe2c55] to-[#ff0055] hover:from-[#e0264b] hover:to-[#e6004c] text-white font-medium text-sm shadow-lg shadow-[#fe2c55]/25 transition-all transform hover:-translate-y-0.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Live Record</span>
          </button>
        )}
      </div>
    </header>
  );
}
