'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import VideoPlayerModal from '@/components/VideoPlayerModal';
import { Film, Search, Download, Trash2, Play, Calendar, HardDrive, Filter, FolderOpen, RefreshCw } from 'lucide-react';
import { VideoFile } from '@/lib/types';

export default function VideoVaultPage() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<VideoFile | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recorder/videos');
      const data = await res.json();
      if (data.success) {
        setVideos(data.videos || []);
      }
    } catch (e) {
      console.error('Failed fetching video library', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleDelete = async (filename: string) => {
    try {
      const res = await fetch('/api/recorder/videos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        fetchVideos();
      }
    } catch (e) {
      console.error('Failed deleting video', e);
    }
  };

  const filteredVideos = videos.filter(
    (v) =>
      v.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.userTag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onRefresh={fetchVideos} />

        <main className="p-6 md:p-8 space-y-8 flex-1">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#00f2fe] uppercase tracking-wider mb-1">
                <Film className="w-4 h-4" /> Recorded Media Vault
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">TikTok Recording Gallery</h1>
              <p className="text-xs text-slate-400 mt-1">
                Browse, preview, stream, download, and manage captured TikTok live video recordings.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recordings..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00f2fe]"
              />
            </div>
          </div>

          {/* Videos Grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs">Scanning output folder...</span>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800 space-y-3">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-semibold text-slate-300">No Video Recordings Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `No video files matched "${searchQuery}".`
                  : 'Start a TikTok live recording from the dashboard or live monitor to populate your video vault.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredVideos.map((video) => (
                <div
                  key={video.filename}
                  className="glass-panel p-4 rounded-2xl border border-slate-800/80 hover:border-[#00f2fe]/40 transition-all duration-300 group flex flex-col justify-between"
                >
                  <div>
                    {/* Thumbnail Play Box */}
                    <div
                      onClick={() => setSelectedVideo(video)}
                      className="h-40 rounded-xl bg-[#090d16] border border-slate-800 flex flex-col items-center justify-center relative cursor-pointer overflow-hidden group-hover:border-[#00f2fe]/60 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#fe2c55]/20 border border-[#fe2c55]/40 text-[#fe2c55] group-hover:scale-110 flex items-center justify-center transition-transform shadow-lg shadow-[#fe2c55]/20">
                        <Play className="w-6 h-6 fill-[#fe2c55] ml-0.5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 mt-3 px-2.5 py-0.5 rounded bg-slate-950/80">
                        {video.format}
                      </span>
                    </div>

                    <div className="mt-3.5 space-y-1">
                      <h3 className="font-bold text-sm text-white truncate" title={video.filename}>
                        {video.filename}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="text-[#00f2fe] font-medium">{video.userTag}</span>
                        <span className="font-mono text-slate-400">{video.sizeFormatted}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(video.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedVideo(video)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
                      >
                        Play
                      </button>
                      <a
                        href={video.url}
                        download={video.filename}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${video.filename}?`)) {
                            handleDelete(video.filename);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Video Modal */}
      <VideoPlayerModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}
