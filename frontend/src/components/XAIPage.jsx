import React, { useState, useEffect } from 'react';
import { Sparkles, Layers, Sliders, Info, HelpCircle, Shield } from 'lucide-react';
import TelemetrySimulator from './TelemetrySimulator';
import { predictAndExplain } from '../api';

export default function XAIPage({ globalImportance, currentUser, onOpenModal }) {
  // Independent Simulation State
  const [simTelemetry, setSimTelemetry] = useState({
    temperature: 28.4,
    humidity: 65.2,
    pm1_0: 12.8,
    pm2_5: 17.8,
    pm10: 29.3
  });

  const [simPrediction, setSimPrediction] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    handleRunSimulation(simTelemetry);
  }, [currentUser]);

  const handleRunSimulation = async (inputTelemetry) => {
    setSimLoading(true);
    try {
      const payload = {
        ...inputTelemetry,
        severity: currentUser?.severity || 'Mild',
        age: currentUser?.age || 22,
        sex: currentUser?.sex || 'male',
        pef_best: currentUser?.pef_best || 520
      };
      const result = await predictAndExplain(payload);
      setSimPrediction(result);
    } catch (err) {
      console.error('Failed to run simulation:', err);
    } finally {
      setSimLoading(false);
    }
  };

  const baseValue = simPrediction?.base_value ?? 0.20;

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              2-Stage Hierarchical ML + TreeSHAP Studio
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            XAI & SHAP Analytics
          </h2>
          <p className="text-emerald-100/75 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Configure custom environmental parameters to analyze real-time AI risk predictions alongside exact Game-Theoretic Shapley feature attributions.
          </p>
        </div>

        {/* Global Model Stats Badge */}
        <div className="flex items-center gap-3 bg-forest-950/80 border border-forest-800 p-3.5 rounded-2xl">
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Model Architecture</span>
            <span className="text-xs font-bold text-white">CatBoost + XGBoost (2-Stage)</span>
          </div>
          <div className="h-8 w-px bg-forest-800" />
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Base Expected Value</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{baseValue}</span>
          </div>
        </div>
      </div>

      {/* Global Feature Importance Cards */}
      {globalImportance && globalImportance.length > 0 && (
        <div className="aura-card p-5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Global Cohort Feature Importance (TreeSHAP Ranking)
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-forest-800 px-2 py-0.5 rounded-md">
              Dataset Mean |SHAP|
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {globalImportance.map((item, idx) => (
              <div key={item.feature} className="bg-forest-950/80 border border-forest-800/90 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white truncate">{item.name.split(' ')[0]}</span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>

                <div className="my-1.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-extrabold font-mono text-white">{item.importance_percentage}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Mean SHAP: {item.mean_shap}</span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-forest-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    style={{ width: `${item.importance_percentage}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#00e599]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive ESP32 Telemetry & XAI Simulator Section */}
      <div>
        <TelemetrySimulator 
          telemetry={simTelemetry}
          setTelemetry={setSimTelemetry}
          onRunInference={handleRunSimulation}
          predictionData={simPrediction}
          loading={simLoading}
        />
      </div>
    </div>
  );
}
