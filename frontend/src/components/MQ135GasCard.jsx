import React from 'react';
import { Gauge } from 'lucide-react';

export default function MQ135GasCard({ telemetry }) {
  const mq135 = telemetry?.mq135 ?? 412;

  const isClean = mq135 < 500;
  const isModerate = mq135 >= 500 && mq135 <= 750;
  const isUnsafe = mq135 > 750;

  const gasPct = Math.min(100, Math.max(0, Math.round(((mq135 - 200) / 800) * 100)));
  const purityScore = Math.max(0, Math.min(100, Math.round(100 - ((mq135 - 350) / 6.5))));

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[235px] relative overflow-hidden group">
      {/* Background ambient lighting */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with clear bottom margin */}
      <div className="flex items-center justify-between z-10 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-forest-800/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">Gas & Air Purity</h3>
        </div>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
          isClean ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
          isModerate ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' :
          'bg-rose-500/15 border-rose-500/30 text-rose-300'
        }`}>
          {isClean ? 'Fresh Air' : isModerate ? 'Moderate Gas' : 'Hazardous Gas'}
        </span>
      </div>

      {/* Main Gas Value Block */}
      <div className="bg-forest-950/80 border border-forest-800/90 rounded-2xl p-3.5 z-10 flex-1 flex flex-col justify-center">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block">Total Gas Concentration</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-extrabold font-mono text-white tracking-tight">{mq135}</span>
              <span className="text-xs font-bold text-slate-400">ppm</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-semibold block">Purity Index</span>
            <span className="text-base font-extrabold font-mono text-emerald-400">{purityScore}/100</span>
          </div>
        </div>

        {/* 3-Tier Multi-Segment Meter */}
        <div className="mt-2 mb-1">
          <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden flex">
            <div 
              style={{ width: `${gasPct}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isClean ? 'bg-gradient-to-r from-emerald-500 to-[#00e599] shadow-sm shadow-emerald-500/50' :
                isModerate ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-sm shadow-amber-500/50' :
                'bg-gradient-to-r from-rose-500 to-rose-400 shadow-sm shadow-rose-500/50'
              }`}
            />
          </div>
        </div>

        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span className={isClean ? 'text-emerald-400 font-bold' : ''}>Clean &lt;500</span>
          <span className={isModerate ? 'text-amber-400 font-bold' : ''}>Moderate 500-750</span>
          <span className={isUnsafe ? 'text-rose-400 font-bold' : ''}>Unsafe &gt;750</span>
        </div>
      </div>
    </div>
  );
}
