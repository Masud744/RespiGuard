import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Sparkles, Wind, CheckCircle2 } from 'lucide-react';

export default function EnvironmentalConditionCard({ predictionData, onOpenShap }) {
  const currentRisk = predictionData?.prediction || 'Green';
  const confidence = predictionData?.confidence || 94.2;

  const conditionConfig = {
    Green: {
      status: 'Safe',
      subtitle: 'Optimal Respiratory Comfort (PEFR >= 80%)',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
      glow: 'shadow-emerald-500/20 border-emerald-500/30',
      icon: ShieldCheck,
      desc: 'Ambient air and particulate levels are within clean thresholds.',
      score: 92,
      zone: 'Green Zone (Low Risk)'
    },
    Yellow: {
      status: 'Moderate',
      subtitle: 'Elevated Airway Sensitivity (50% <= PEFR < 80%)',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
      glow: 'shadow-amber-500/20 border-amber-500/30',
      icon: AlertTriangle,
      desc: 'Sub-optimal humidity or particulates detected. Caution advised.',
      score: 64,
      zone: 'Yellow Zone (Moderate Caution)'
    },
    Red: {
      status: 'High Danger',
      subtitle: 'Hazardous Exacerbation Risk (PEFR < 50%)',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
      glow: 'shadow-rose-500/20 border-rose-500/30',
      icon: AlertOctagon,
      desc: 'Severe PM2.5/PM10 air pollution spike. High risk detected.',
      score: 28,
      zone: 'Red Zone (Emergency Alert)'
    }
  };

  const config = conditionConfig[currentRisk] || conditionConfig.Green;
  const Icon = config.icon;

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-full min-h-[175px] relative overflow-hidden group">
      {/* Background soft ambient glow */}
      <div className={`absolute -top-8 -right-8 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20 ${
        currentRisk === 'Green' ? 'bg-emerald-400' :
        currentRisk === 'Yellow' ? 'bg-amber-400' : 'bg-rose-400'
      }`} />

      {/* Header */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-forest-800/90 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">AI Asthma Risk Prediction</h3>
            <span className="text-[10px] font-mono text-emerald-400">ML Model Inference</span>
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
          {confidence}% Conf
        </span>
      </div>

      {/* Main Status Display */}
      <div className="my-2 z-10">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl sm:text-3xl font-black tracking-tight ${config.color}`}>
            {currentRisk} Zone
          </span>
          <span className="text-xs font-semibold text-slate-400">({config.status})</span>
        </div>
        <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
          {config.subtitle}
        </p>
      </div>

      {/* 3-State Visual Indicator Bar (Good / Moderate / Bad) */}
      <div className="z-10 pt-1">
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${
            currentRisk === 'Green' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/80' : 'bg-forest-800 opacity-60'
          }`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${
            currentRisk === 'Yellow' ? 'bg-amber-400 shadow-sm shadow-amber-400/80' : 'bg-forest-800 opacity-60'
          }`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${
            currentRisk === 'Red' ? 'bg-rose-400 shadow-sm shadow-rose-400/80' : 'bg-forest-800 opacity-60'
          }`} />
        </div>
        <div className="flex justify-between text-[10px] font-medium text-slate-500">
          <span className={currentRisk === 'Green' ? 'text-emerald-400 font-bold' : ''}>Green (Safe)</span>
          <span className={currentRisk === 'Yellow' ? 'text-amber-400 font-bold' : ''}>Yellow (Caution)</span>
          <span className={currentRisk === 'Red' ? 'text-rose-400 font-bold' : ''}>Red (Danger)</span>
        </div>

        {/* Explain Risk with TreeSHAP button */}
        {onOpenShap && (
          <button
            type="button"
            onClick={onOpenShap}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-forest-800/90 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Explain Risk Factors (TreeSHAP)</span>
          </button>
        )}
      </div>
    </div>
  );
}
