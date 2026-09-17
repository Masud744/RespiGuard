import React from 'react';
import { Thermometer, Droplets } from 'lucide-react';

export default function TempHumidityCard({ telemetry }) {
  const temp = telemetry?.temperature ?? 28.4;
  const humidity = telemetry?.humidity ?? 65.2;

  const isTempSafe = temp >= 18 && temp <= 30;
  const isHumSafe = humidity >= 40 && humidity <= 70;
  const isOverallSafe = isTempSafe && isHumSafe;

  const tempPct = Math.min(100, Math.max(0, Math.round((temp / 50) * 100)));
  const humPct = Math.min(100, Math.max(0, Math.round((humidity / 100) * 100)));

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[235px] relative overflow-hidden group">
      {/* Background soft glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header with clear bottom margin */}
      <div className="flex items-center justify-between z-10 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-forest-800/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Thermometer className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">Ambient Climate</h3>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
          isOverallSafe 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
        }`}>
          {isOverallSafe ? 'Comfort Zone' : 'Trigger Alert'}
        </span>
      </div>

      {/* Dual Metric Split: Temperature & Humidity */}
      <div className="grid grid-cols-2 gap-3.5 z-10 flex-1 items-center">
        {/* Temperature Block */}
        <div className="bg-forest-950/80 border border-forest-800/90 rounded-2xl p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" /> Temperature
            </span>
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight">{temp}</span>
            <span className="text-xs font-bold text-slate-400">°C</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-forest-800 h-1.5 rounded-full overflow-hidden mt-1 mb-1">
            <div 
              style={{ width: `${tempPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0°C</span>
            <span className="text-slate-400 font-medium">Safe 18-30°</span>
            <span>50°C</span>
          </div>
        </div>

        {/* Humidity Block */}
        <div className="bg-forest-950/80 border border-forest-800/90 rounded-2xl p-3 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-400" /> Humidity
            </span>
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-2xl font-extrabold font-mono text-white tracking-tight">{humidity}</span>
            <span className="text-xs font-bold text-slate-400">% RH</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-forest-800 h-1.5 rounded-full overflow-hidden mt-1 mb-1">
            <div 
              style={{ width: `${humPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-300 transition-all duration-500"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0%</span>
            <span className="text-slate-400 font-medium">Safe 40-70%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
