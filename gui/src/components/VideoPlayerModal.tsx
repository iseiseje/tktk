'use client';

import { X, Download, Trash2, Calendar, HardDrive, User, Film, Play } from 'lucide-react';
import { VideoFile } from '@/lib/types';

interface VideoPlayerModalProps {
  video: VideoFile | null;
  onClose: () => void;
  onDelete?: (filename: string) => void;
}

export default function VideoPlayerModal({ video, onClose, onDelete }: VideoPlayerModalProps) {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#090d16]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#fe2c55]/10 text-[#fe2c55] border border-[#fe2c55]/20">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base truncate max-w-md">{video.filename}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#00f2fe]" /> {video.userTag}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" /> {video.sizeFormatted}
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                  {video.format}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={video.url}
              download={video.filename}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
            >
              <Download className="w-4 h-4" /> Download
            </a>
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${video.filename}?`)) {
                    onDelete(video.filename);
                    onClose();
                  }
                }}
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                title="Delete Video"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-black flex-1 flex items-center justify-center p-4 min-h-[400px]">
          <video
            controls
            autoPlay
            className="max-h-[60vh] max-w-full rounded-xl shadow-lg border border-slate-900"
            src={video.url}
          >
            Your browser does not support HTML5 video playback.
          </video>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-[#090d16] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Recorded on: {new Date(video.createdAt).toLocaleString()}</span>
          </div>
          <span className="font-mono text-slate-500 text-[11px] truncate max-w-sm" title={video.path}>
            {video.path}
          </span>
        </div>
      </div>
    </div>
  );
}
