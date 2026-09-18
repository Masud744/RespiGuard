import React, { useState } from 'react';
import { 
  Sparkles, Layers, ShieldCheck, AlertTriangle, AlertOctagon,
  Stethoscope, ArrowUpRight, ArrowDownRight, CheckCircle2,
  Wind, Droplets, Thermometer, Activity, Info
} from 'lucide-react';

export default function XAIPage({ globalImportance, currentUser, realtimeTelemetry, realtimePredictionData }) {

  // Live prediction data from the real 2-Stage ML model
  const predictionData = realtimePredictionData;
  const currentPred = predictionData?.prediction || 'Green';
  const probs = predictionData?.probabilities || { Green: 90, Yellow: 8, Red: 2 };
  const impacts = predictionData?.feature_impacts || [];
  const baseValue = predictionData?.base_value ?? 0.20;

  const provenance = predictionData?.provenance || {
    xai_engine: 'Model-Derived TreeSHAP (shap.TreeExplainer)',
    model_type: 'RandomForestClassifier (100 Trees)',
    model_path: 'models/random_forest_asthma.joblib',
    is_model_derived: true,
    attribution_method: 'shap.TreeExplainer (Exact Tree Traversal on RF)'
  };

  // Live sensor readings
  const livePM25 = realtimeTelemetry?.pm2_5 ?? '--';
  const livePM10 = realtimeTelemetry?.pm10 ?? '--';
  const livePM1 = realtimeTelemetry?.pm1_0 ?? '--';
  const liveTemp = realtimeTelemetry?.temperature ?? '--';
  const liveHumidity = realtimeTelemetry?.humidity ?? '--';

  const riskConfig = {
    Green: {
      title: 'Safe Zone (Low Risk)',
      subtitle: 'Optimal respiratory conditions detected',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300',
      cardBg: 'from-emerald-950/40 via-forest-900/60 to-forest-950/80 border-emerald-500/30',
      icon: ShieldCheck
    },
    Yellow: {
      title: 'Moderate Caution Zone',
      subtitle: 'Elevated airborne sensitivity detected',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-500/20 border-amber-400/40 text-amber-300',
      cardBg: 'from-amber-950/40 via-forest-900/60 to-forest-950/80 border-amber-500/30',
      icon: AlertTriangle
    },
    Red: {
      title: 'High Risk Alert',
      subtitle: 'Severe trigger spike detected',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-500/20 border-rose-400/40 text-rose-300',
      cardBg: 'from-rose-950/40 via-forest-900/60 to-forest-950/80 border-rose-500/30',
      icon: AlertOctagon
    }
  };

  const currentCfg = riskConfig[currentPred] || riskConfig.Green;
  const RiskIcon = currentCfg.icon;

  // Feature icon mapping
  const featureIcons = {
    pm2_5: Wind, pm10: Wind, pm1_0: Wind,
    temperature: Thermometer, humidity: Droplets
  };

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">

      {/* ====================================================================== */}
      {/* PAGE HEADER */}
      {/* ====================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-300">Live ML Inference</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Clinical Risk AI
          </h2>
          <p className="text-emerald-100/75 text-xs sm:text-sm mt-0.5 max-w-xl leading-relaxed">
            Real-time TreeSHAP feature attribution from live ESP32 biometric telemetry
          </p>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* LIVE SENSOR READINGS STRIP */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'PM2.5', value: livePM25, unit: 'µg/m³', icon: Wind, color: 'text-emerald-400' },
          { label: 'PM10', value: livePM10, unit: 'µg/m³', icon: Wind, color: 'text-teal-400' },
          { label: 'PM1.0', value: livePM1, unit: 'µg/m³', icon: Wind, color: 'text-cyan-400' },
          { label: 'Temperature', value: liveTemp, unit: '°C', icon: Thermometer, color: 'text-amber-400' },
          { label: 'Humidity', value: liveHumidity, unit: '%', icon: Droplets, color: 'text-teal-300' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-3 rounded-2xl bg-forest-950/80 border border-emerald-500/15 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-forest-900/80 border border-forest-800">
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">{s.label}</span>
                <span className="text-sm font-extrabold font-mono text-white">{s.value}</span>
                <span className="text-[9px] text-slate-500 ml-1">{s.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ====================================================================== */}
      {/* MAIN ML PREDICTION OUTCOME BANNER */}
      {/* ====================================================================== */}
      {predictionData && (
        <div className={`p-5 rounded-3xl border bg-gradient-to-r ${currentCfg.cardBg} shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
          {/* Left: Big Risk Indicator */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-md ${currentCfg.badgeBg}`}>
              <RiskIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Live Prediction:</span>
                <h4 className={`text-xl font-extrabold tracking-tight ${currentCfg.color}`}>
                  {currentCfg.title}
                </h4>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{currentCfg.subtitle}</p>
            </div>
          </div>

          {/* Right: Probability Distribution */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-forest-950/80 px-4 py-2.5 rounded-2xl border border-emerald-500/20">
            <div className="text-left sm:text-right pr-2 sm:border-r border-slate-700">
              <span className="text-[10px] text-slate-400 block font-medium">Confidence</span>
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
      )}

      {/* ====================================================================== */}
      {/* TWO COLUMN: CLINICAL ASSESSMENT + FEATURE IMPACT RANKING */}
      {/* ====================================================================== */}
      {predictionData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Column 1: AI Clinical Assessment (6 Cols) */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-forest-950/70 border border-emerald-500/15 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>AI Clinical Assessment</span>
                </div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Live Analysis
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {predictionData.explanation}
              </p>
            </div>

            {/* Clinical Recommendations */}
            <div className="space-y-2 pt-2 border-t border-emerald-500/15">
              <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
                Clinical Guidance:
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

          {/* Column 2: Feature Impact Ranking (7 Cols) */}
          <div className="lg:col-span-7 p-5 rounded-2xl bg-forest-950/70 border border-emerald-500/15">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <span className="text-sm font-bold text-white block tracking-tight">
                  Feature Impact Attribution
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">
                  TreeSHAP per-feature contribution to current prediction
                </span>
              </div>
              <span className="text-[10px] text-slate-400 bg-forest-800 px-2 py-0.5 rounded-md font-mono">
                Base: {(baseValue * 100).toFixed(1)}%
              </span>
            </div>

            <div className="space-y-2.5">
              {impacts.map((feat) => {
                const isRiskIncreasing = feat.shap_value > 0;
                const FeatureIcon = featureIcons[feat.feature] || Activity;
                const cleanFeatName =
                  feat.feature === 'pm2_5' || feat.name?.includes('2.5') ? 'PM2.5 (Fine Particulates)' :
                  feat.feature === 'pm10' || feat.name?.includes('10') ? 'PM10 (Coarse Dust)' :
                  feat.feature === 'pm1_0' || feat.name?.includes('1.0') ? 'PM1.0 (Ultrafine)' :
                  feat.feature === 'temperature' || feat.name?.toLowerCase().includes('temperature') ? 'Temperature' :
                  feat.feature === 'humidity' || feat.name?.toLowerCase().includes('humidity') ? 'Humidity' :
                  feat.name?.split(' ')[0] || feat.feature;

                const barWidth = Math.min(Math.abs(feat.contribution_pct || 0), 100);

                return (
                  <div key={feat.feature} className="p-3 rounded-xl bg-forest-900/60 border border-emerald-500/10">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <FeatureIcon className={`w-4 h-4 ${isRiskIncreasing ? 'text-rose-400' : 'text-emerald-400'}`} />
                        <div>
                          <span className="text-xs font-bold text-white">{cleanFeatName}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-2">
                            {feat.value} {feat.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isRiskIncreasing
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isRiskIncreasing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {isRiskIncreasing ? 'Risk Factor' : 'Protective'}
                        </span>
                        <span className="font-mono text-sm font-extrabold text-white w-14 text-right">
                          {feat.contribution_pct}%
                        </span>
                      </div>
                    </div>

                    {/* Visual Attribution Bar */}
                    <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${barWidth}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          isRiskIncreasing
                            ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                            : 'bg-gradient-to-r from-emerald-500 to-[#00e599]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* GLOBAL FEATURE IMPORTANCE (Population SHAP Weights) */}
      {/* ====================================================================== */}
      {globalImportance && globalImportance.length > 0 && (
        <div className="aura-card p-5 border border-emerald-500/25">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Global Feature Importance
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-forest-800 px-2 py-0.5 rounded-md">
              Population SHAP Weights
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {globalImportance.map((item, idx) => {
              const cleanName = 
                item.feature === 'pm2_5' || item.name?.includes('2.5') ? 'PM2.5' :
                item.feature === 'pm10' || item.name?.includes('10') ? 'PM10' :
                item.feature === 'pm1_0' || item.name?.includes('1.0') ? 'PM1.0' :
                item.feature === 'temperature' || item.name?.toLowerCase().includes('temperature') ? 'Temperature' :
                item.feature === 'humidity' || item.name?.toLowerCase().includes('humidity') ? 'Humidity' :
                item.name?.split(' ')[0] || item.feature;

              return (
                <div key={item.feature} className="bg-forest-950/80 border border-forest-800/90 rounded-2xl p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white truncate">{cleanName}</span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="my-1.5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold font-mono text-white">{item.importance_percentage}%</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Weight: {item.mean_shap}</span>
                  </div>

                  <div className="w-full bg-forest-800 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      style={{ width: `${item.importance_percentage}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#00e599]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
