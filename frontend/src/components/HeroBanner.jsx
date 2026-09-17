import React from 'react';
import { Stethoscope } from 'lucide-react';

export default function HeroBanner({ currentUser }) {
  const userName = currentUser?.full_name?.split(' ')[0] || 'Patient';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 p-7 shadow-xl shadow-emerald-950/40 flex items-center justify-between min-h-[175px]">
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-8 right-32 w-52 h-52 bg-teal-400/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Left Content */}
      <div className="relative z-10 max-w-lg">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-emerald-300/90 text-sm font-medium">Welcome {userName}</span>
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
          Check Your Health!
        </h2>
        <p className="text-emerald-100/75 text-xs sm:text-sm mt-1 leading-relaxed">
          Here's Your Health At A Glance & Real-time AI Risk Attribution...
        </p>
      </div>

      {/* 3D Character / Medical Agent Mascot */}
      <div className="relative z-10 hidden sm:flex items-center justify-center shrink-0 pr-4">
        <div className="relative w-36 h-36 flex items-center justify-center">
          {/* Circular soft glow behind mascot */}
          <div className="absolute inset-2 bg-emerald-400/20 rounded-full blur-xl animate-pulse"></div>
          
          {/* Stylized Medical Doctor Badge / Avatar */}
          <div className="relative z-10 w-32 h-32 rounded-2xl bg-gradient-to-tr from-emerald-900/80 to-forest-800/60 border border-emerald-400/30 p-2 flex flex-col items-center justify-center text-center shadow-lg backdrop-blur-md">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 mb-1.5 shadow-md shadow-emerald-500/20">
              <Stethoscope className="w-6 h-6 stroke-[2]" />
            </div>
            <span className="text-[11px] font-bold text-white leading-tight">AuraHealth AI</span>
            <span className="text-[9px] text-emerald-300 font-medium">Respiratory Agent</span>
          </div>
        </div>
      </div>
    </div>
  );
}
