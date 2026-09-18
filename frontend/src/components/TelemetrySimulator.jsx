import React from 'react';
import { 
  Sliders, ShieldCheck, AlertTriangle, AlertOctagon, 
  Play, Sparkles, Stethoscope, ArrowUpRight, ArrowDownRight, CheckCircle2 
} from 'lucide-react';

export default function TelemetrySimulator({ telemetry, setTelemetry, onRunInference, predictionData, loading }) {
  const presets = [
    {
      name: 'Safe Air (Green)',
      values: { temperature: 24.2, humidity: 55.0, pm1_0: 7.2, pm2_5: 10.5, pm10: 18.0 },
      color: 'hover:border-emerald-500 text-emerald-300'
    },
    {
      name: 'Moderate Dust & Humid (Yellow)',
      values: { temperature: 28.5, humidity: 72.0, pm1_0: 15.4, pm2_5: 24.8, pm10: 48.0 },
      color: 'hover:border-amber-500 text-amber-300'
    },
    {
      name: 'Hazardous Spike (Red)',
      values: { temperature: 32.0, humidity: 82.5, pm1_0: 32.0, pm2_5: 58.0, pm10: 95.0 },
      color: 'hover:border-rose-500 text-rose-300'
    }
  ];

  const handleSliderChange = (field, val) => {
    const updated = { ...telemetry, [field]: parseFloat(val) };
    setTelemetry(updated);
  };

  const applyPreset = (vals) => {
    setTelemetry(vals);
    onRunInference(vals);
  };

  const sliders = [
    { key: 'pm2_5', label: 'PM2.5 (Fine Particulates)', min: 1, max: 100, step: 0.5, unit: 'µg/m³', desc: 'Primary asthma trigger' },
    { key: 'pm10', label: 'PM10 (Coarse Dust)', min: 1, max: 150, step: 1, unit: 'µg/m³', desc: 'Inhalable particulate matter' },
    { key: 'pm1_0', label: 'PM1.0 (Ultrafine Aerosol)', min: 0.5, max: 60, step: 0.5, unit: 'µg/m³', desc: 'Laser sub-fraction channel' },
    { key: 'humidity', label: 'Relative Humidity', min: 15, max: 98, step: 0.5, unit: '%', desc: 'Ambient moisture level' },
    { key: 'temperature', label: 'Ambient Temperature', min: 10, max: 45, step: 0.2, unit: '°C', desc: 'Thermal climate condition' },
  ];

  const currentPred = predictionData?.prediction || 'Green';
  const probs = predictionData?.probabilities || { Green: 90, Yellow: 8, Red: 2 };
  const impacts = predictionData?.feature_impacts || [];

  const riskConfig = {
    Green: {
      title: 'Safe Zone (Low Risk)',
      subtitle: 'Optimal respiratory conditions',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
      cardBg: 'from-emerald-950/40 via-forest-900/60 to-forest-950/80 border-emerald-500/30',
      icon: ShieldCheck
    },
    Yellow: {
      title: 'Moderate Caution Zone',
      subtitle: 'Elevated airborne sensitivity',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
      cardBg: 'from-amber-950/40 via-forest-900/60 to-forest-950/80 border-amber-500/30',
      icon: AlertTriangle
    },
    Red: {
      title: 'High Risk Alert (Emergency)',
      subtitle: 'Severe trigger spike detected',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
      cardBg: 'from-rose-950/40 via-forest-900/60 to-forest-950/80 border-rose-500/30',
      icon: AlertOctagon
    }
  };

  const currentCfg = riskConfig[currentPred] || riskConfig.Green;
  const RiskIcon = currentCfg.icon;

  return (
    <div className="aura-card p-6 border border-emerald-500/25">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Telemetry & Risk Simulator
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Adjust environmental parameters to simulate real-time asthma risk and feature impact
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2">
          {presets.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p.values)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold bg-forest-900/90 border border-forest-700/80 transition-all cursor-pointer ${p.color}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders Grid (5 Parameters + Action Button) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {sliders.map((s) => {
          const val = telemetry[s.key] ?? s.min;
          return (
            <div key={s.key} className="bg-forest-950/80 border border-emerald-500/15 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-200">{s.label}</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    {val} {s.unit}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{s.desc}</p>
              </div>

              <div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  onChange={(e) => handleSliderChange(s.key, e.target.value)}
                  className="w-full h-1.5 bg-forest-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  <span>{s.min} {s.unit}</span>
                  <span>{s.max} {s.unit}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Simulate Action Button Card */}
        <div className="bg-gradient-to-br from-[#12382e] to-forest-950 border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-md">
          <div>
            <span className="text-xs font-bold text-emerald-300 block mb-1">Trigger ML Inference</span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Run the 2-Stage Hierarchical ML engine on these simulated readings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRunInference(telemetry)}
            disabled={loading}
            className="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00e599] hover:from-emerald-400 hover:to-[#10b981] text-forest-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{loading ? 'Evaluating Model...' : 'Simulate & Calculate Risk'}</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SIMPLIFIED & CLEAN PREDICTED OUTPUT SECTION */}
      {/* ==================================================================== */}
      {predictionData && (
        <div className="pt-2 border-t border-emerald-500/15 animate-fadeIn">
          
          {/* 1. Main Outcome Banner */}
          <div className={`p-5 rounded-3xl border bg-gradient-to-r ${currentCfg.cardBg} shadow-lg mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
            {/* Left: Big Risk Indicator */}
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-md ${currentCfg.badgeBg}`}>
                <RiskIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Prediction:</span>
                  <h4 className={`text-xl font-extrabold tracking-tight ${currentCfg.color}`}>
                    {currentCfg.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{currentCfg.subtitle}</p>
              </div>
            </div>

            {/* Right: Clean Probability Segment */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-forest-950/80 px-4 py-2.5 rounded-2xl border border-emerald-500/20">
              <div className="text-left sm:text-right pr-2 sm:border-r border-slate-700">
                <span className="text-[10px] text-slate-400 block font-medium">Confidence Score</span>
                <span className="text-sm font-extrabold font-mono text-white">{predictionData.confidence}%</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Safe: {probs.Green}%
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Caution: {probs.Yellow}%
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Danger: {probs.Red}%
                </span>
              </div>
            </div>
          </div>

          {/* 2. Streamlined Two-Column Grid: Clinical Insights + Key Feature Drivers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Column 1: AI Clinical Assessment & Structured Action Recommendations (6 Cols) */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-forest-950/70 border border-emerald-500/15 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Clinical Assessment</span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    AI Assessment
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {predictionData.explanation}
                </p>
              </div>

              {/* Actionable Clinical Recommendations */}
              <div className="space-y-2 pt-2 border-t border-emerald-500/15">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                  Recommended Action:
                </span>
                {predictionData.clinical_recommendations && predictionData.clinical_recommendations.length > 0 ? (
                  <div className="space-y-1.5">
                    {predictionData.clinical_recommendations.map((rec, rIdx) => (
                      <div key={rIdx} className="flex items-start gap-2 bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20 text-xs text-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{rec}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20 text-xs text-emerald-200 font-medium">
                    <Stethoscope className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{predictionData.recommendation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Key Environmental Drivers (6 Cols) */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-forest-950/70 border border-emerald-500/15">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Key Environmental Drivers
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium">
                    Feature Impact Ranking
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">Risk Influence</span>
              </div>

              <div className="space-y-2">
                {impacts.map((feat) => {
                  const isRiskIncreasing = feat.shap_value > 0;
                  const cleanFeatName =
                    feat.feature === 'pm2_5' || feat.name?.includes('2.5') ? 'PM2.5' :
                    feat.feature === 'pm10' || feat.name?.includes('10') ? 'PM10' :
                    feat.feature === 'pm1_0' || feat.name?.includes('1.0') ? 'PM1.0' :
                    feat.feature === 'temperature' || feat.name?.toLowerCase().includes('temperature') ? 'Temperature' :
                    feat.feature === 'humidity' || feat.name?.toLowerCase().includes('humidity') ? 'Humidity' :
                    feat.name?.split(' ')[0] || feat.feature;

                  return (
                    <div key={feat.feature} className="flex items-center justify-between p-2 rounded-xl bg-forest-900/60 border border-emerald-500/10 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{cleanFeatName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({feat.value} {feat.unit})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isRiskIncreasing
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isRiskIncreasing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isRiskIncreasing ? 'Raises Risk' : 'Protective'}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-200 w-12 text-right">
                          {feat.contribution_pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
