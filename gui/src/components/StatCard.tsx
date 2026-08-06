'use client';

import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: 'cyan' | 'pink' | 'purple' | 'emerald';
  badgeText?: string;
  pulse?: boolean;
}

export default function StatCard({ title, value, subtitle, icon: Icon, gradient, badgeText, pulse }: StatCardProps) {
  const gradientStyles = {
    cyan: {
      border: 'border-[#00f2fe]/30',
      iconBg: 'bg-[#00f2fe]/10 text-[#00f2fe]',
      textGlow: 'text-white',
      badge: 'bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/30',
    },
    pink: {
      border: 'border-[#fe2c55]/30',
      iconBg: 'bg-[#fe2c55]/10 text-[#fe2c55]',
      textGlow: 'text-white',
      badge: 'bg-[#fe2c55]/10 text-[#fe2c55] border-[#fe2c55]/30',
    },
    purple: {
      border: 'border-purple-500/30',
      iconBg: 'bg-purple-500/10 text-purple-400',
      textGlow: 'text-white',
      badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    },
    emerald: {
      border: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      textGlow: 'text-white',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
  }[gradient];

  return (
    <div className={`glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300 hover:scale-[1.01] ${gradientStyles.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${gradientStyles.textGlow}`}>
              {value}
            </h3>
            {badgeText && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${gradientStyles.badge} ${pulse ? 'animate-pulse' : ''}`}>
                {badgeText}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>

        <div className={`p-3.5 rounded-2xl ${gradientStyles.iconBg}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
