import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function ShapFeatureImportance({ globalImportance, predictionData, onOpenModal }) {
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' | 'shap'

  // Default bars matching the exact Week 1-5 values in reference image
  const weeklyTrends = [
    { label: 'Week 1', heightPct: 78, val: '0.82', sub: 'High risk' },
    { label: 'Week 2', heightPct: 56, val: '0.58', sub: 'Mod risk' },
    { label: 'Week 3', heightPct: 35, val: '0.36', sub: 'Normal' },
    { label: 'Week 4', heightPct: 22, val: '0.24', sub: 'Optimal' },
    { label: 'Week 5', heightPct: 15, val: '0.16', sub: 'Optimal' },
  ];

  // SHAP Feature values
  const shapBars = (predictionData?.feature_impacts || []).slice(0, 5).map((f, idx) => ({
    label: f.feature === 'pm2_5' ? 'PM2.5' : f.feature === 'humidity' ? 'Humid' : f.feature === 'pm10' ? 'PM10' : f.feature === 'temperature' ? 'Temp' : 'PM1.0',
    heightPct: Math.min(100, Math.max(10, Math.round(f.contribution_pct * 1.8))),
    val: `${f.shap_value > 0 ? '+' : ''}${f.shap_value.toFixed(2)}`,
    sub: `${f.contribution_pct}%`
  }));

  const activeBars = viewMode === 'shap' && shapBars.length > 0 ? shapBars : weeklyTrends;

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[230px] relative">
      {/* Header with Title & Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            {viewMode === 'shap' ? 'Feature Drivers (SHAP)' : 'Weekly Risk Trends'}
          </h3>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'weekly' ? 'shap' : 'weekly')}
          className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition"
        >
          <Sparkles className="w-2.5 h-2.5" />
          <span>{viewMode === 'shap' ? 'Weekly Trends' : 'Feature Drivers'}</span>
        </button>
      </div>

      {/* Vertical Bar Chart Container */}
      <div className="flex items-end justify-between h-[130px] px-2 pt-2">
        {/* Y Axis labels matching reference: 1, 0.8, 0.4, 0 */}
        <div className="flex flex-col justify-between h-full text-[10px] text-slate-500 pr-2 select-none">
          <span>1</span>
          <span>0.8</span>
          <span>0.4</span>
          <span>0</span>
        </div>

        {/* 5 Vertical Pill Bars matching reference */}
        <div className="flex items-end justify-around flex-1 h-full pl-2">
          {activeBars.map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onOpenModal}>
              {/* Capsule container */}
              <div className="w-3.5 sm:w-4 h-[100px] bg-forest-800/80 rounded-full flex flex-col justify-end p-0.5 overflow-hidden border border-forest-700/40 relative">
                {/* Glowing fill */}
                <div
                  style={{ height: `${bar.heightPct}%` }}
                  className="w-full rounded-full bg-gradient-to-t from-emerald-500 via-[#00e599] to-emerald-300 transition-all duration-700 ease-out group-hover:brightness-125 shadow-sm shadow-emerald-500/50"
                />
              </div>

              {/* X-Axis Label (Week 1 .. Week 5) */}
              <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 group-hover:text-emerald-300 transition">
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
