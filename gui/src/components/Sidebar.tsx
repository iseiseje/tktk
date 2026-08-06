'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radio, Film, Settings, Video, Sparkles, Terminal } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      desc: 'Overview & Active Recorder',
    },
    {
      name: 'Live Monitor',
      href: '/monitor',
      icon: Radio,
      desc: 'Check & Stream Preview',
    },
    {
      name: 'Video Vault',
      href: '/videos',
      icon: Film,
      desc: 'Recorded Clips Library',
    },
    {
      name: 'Settings & Config',
      href: '/settings',
      icon: Settings,
      desc: 'Cookies, Telegram & Engine',
    },
  ];

  return (
    <aside className="w-64 bg-[#090d16] border-r border-slate-800/60 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#fe2c55] to-[#00f2fe] p-[2px] flex items-center justify-center shadow-lg shadow-[#fe2c55]/20">
            <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
              <Video className="w-5 h-5 text-[#00f2fe]" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide bg-gradient-to-r from-white via-slate-200 to-[#00f2fe] bg-clip-text text-transparent">
              TikTok Recorder
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[11px] font-medium text-slate-400">GUI Dashboard v7.7</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fe2c55]/20 to-[#00f2fe]/10 border border-[#fe2c55]/30 text-white font-semibold shadow-md shadow-[#fe2c55]/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <div
                  className={`p-2 rounded-lg transition-colors ${
                    isActive ? 'bg-[#fe2c55] text-white' : 'bg-slate-800/60 text-slate-400 group-hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm">{item.name}</span>
                  <span className="text-[10px] text-slate-500 font-normal">{item.desc}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/60 m-3 rounded-xl bg-slate-900/40 glass-panel">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00f2fe]" /> Engine Core
          </span>
          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">Python 3.14</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Powered by <span className="text-slate-300 font-mono">tiktok-live-recorder</span> v7.7.1
        </p>
      </div>
    </aside>
  );
}
