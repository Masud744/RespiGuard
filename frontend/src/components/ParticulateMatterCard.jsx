import React from 'react';
import { Wind } from 'lucide-react';

export default function ParticulateMatterCard({ telemetry }) {
  const pm25 = telemetry?.pm2_5 ?? 17.8;
  const pm10 = telemetry?.pm10 ?? 29.3;
  const pm10_ = telemetry?.pm1_0 ?? 12.8;

  // Threshold status helpers
  const getPM25Status = (val) => {
    if (val <= 20) return { text: 'Optimal', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    if (val <= 35) return { text: 'Moderate', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    return { text: 'Hazard', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
  };

  const pm25Stat = getPM25Status(pm25);

  const pm25Pct = Math.min(100, Math.max(5, Math.round((pm25 / 50) * 100)));
  const pm10Pct = Math.min(100, Math.max(5, Math.round((pm10 / 100) * 100)));
  const pm1Pct = Math.min(100, Math.max(5, Math.round((pm10_ / 35) * 100)));

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[235px] relative overflow-hidden group">
      {/* Ambient background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with clear bottom margin */}
      <div className="flex items-center justify-between z-10 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-forest-800/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Wind className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">Particulate Matter</h3>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${pm25Stat.bg} ${pm25Stat.color}`}>
          {pm25Stat.text} Range
        </span>
      </div>

      {/* 3 Dedicated Structured Metric Rows with generous spacing */}
      <div className="space-y-2 z-10 flex-1 flex flex-col justify-center">
        {/* Row 1: PM2.5 */}
        <div className="bg-forest-950/80 border border-forest-800/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3">
          <div className="w-16 shrink-0">
            <span className="text-xs font-bold text-white">PM2.5</span>
          </div>

          <div className="flex-1">
            <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden">
              <div 
                style={{ width: `${pm25Pct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#00e599] shadow-sm shadow-emerald-500/40 transition-all duration-500"
              />
            </div>
          </div>

          <div className="text-right shrink-0 min-w-[70px]">
            <span className="text-xs font-extrabold font-mono text-white">{pm25}</span>
            <span className="text-[10px] text-slate-400 ml-1">µg/m³</span>
          </div>
        </div>

        {/* Row 2: PM10 */}
        <div className="bg-forest-950/80 border border-forest-800/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3">
          <div className="w-16 shrink-0">
            <span className="text-xs font-bold text-white">PM10</span>
          </div>

          <div className="flex-1">
            <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden">
              <div 
                style={{ width: `${pm10Pct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-300 transition-all duration-500"
              />
            </div>
          </div>

          <div className="text-right shrink-0 min-w-[70px]">
            <span className="text-xs font-extrabold font-mono text-white">{pm10}</span>
            <span className="text-[10px] text-slate-400 ml-1">µg/m³</span>
          </div>
        </div>

        {/* Row 3: PM1.0 */}
        <div className="bg-forest-950/80 border border-forest-800/80 rounded-xl px-3 py-1.5 flex items-center justify-between gap-3">
          <div className="w-16 shrink-0">
            <span className="text-xs font-bold text-white">PM1.0</span>
          </div>

          <div className="flex-1">
            <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden">
              <div 
                style={{ width: `${pm1Pct}%` }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              />
            </div>
          </div>

          <div className="text-right shrink-0 min-w-[70px]">
            <span className="text-xs font-extrabold font-mono text-white">{pm10_}</span>
            <span className="text-[10px] text-slate-400 ml-1">µg/m³</span>
          </div>
        </div>
      </div>
    </div>
  );
}
