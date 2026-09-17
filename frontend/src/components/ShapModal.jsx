import React from 'react';
import { X, Sparkles, TrendingUp, TrendingDown, Info, ShieldAlert } from 'lucide-react';

export default function ShapModal({ isOpen, onClose, predictionData, globalImportance }) {
  if (!isOpen || !predictionData) return null;

  const impacts = predictionData.feature_impacts || [];
  const baseValue = predictionData.base_value ?? 0.24;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="aura-card bg-forest-900 border border-emerald-500/30 max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-forest-800 border border-forest-700 flex items-center justify-center text-slate-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">XAI / TreeSHAP Model Attribution</h3>
            <p className="text-xs text-slate-400">Exact Shapley values explaining individual sensor contributions</p>
          </div>
        </div>

        {/* Prediction Summary Header */}
        <div className="p-4 rounded-2xl bg-forest-950 border border-forest-800 flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <span className="text-xs text-slate-400">Output Decision:</span>
            <div className="text-base font-extrabold text-white flex items-center gap-2">
              <span className={
                predictionData.prediction === 'Green' ? 'text-emerald-400' :
                predictionData.prediction === 'Yellow' ? 'text-amber-400' :
                'text-rose-400'
              }>
                {predictionData.prediction} Zone
              </span>
              <span className="text-xs font-normal text-slate-400">
                ({predictionData.confidence}% confidence)
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Expected Base Value $E[f(x)]$:</span>
            <div className="text-sm font-bold text-slate-200">{baseValue}</div>
          </div>
        </div>

        {/* Feature Impact Waterfall Breakdown */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Local Feature Contributions
          </h4>
          <div className="space-y-3">
            {impacts.map((feat) => {
              const isPositive = feat.shap_value > 0;
              return (
                <div key={feat.feature} className="p-3 bg-forest-950/60 border border-forest-800/80 rounded-xl">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-white">{feat.name}</span>
                    <span className="font-mono text-slate-300">
                      Reading: <strong className="text-emerald-400">{feat.value} {feat.unit}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <div className="flex items-center gap-1.5">
                      {isPositive ? (
                        <span className="text-rose-400 flex items-center gap-1 font-semibold">
                          <TrendingUp className="w-3.5 h-3.5" /> Increases Asthma Risk
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <TrendingDown className="w-3.5 h-3.5" /> Decreases Risk (Protective)
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-slate-300">
                      SHAP: <strong className={isPositive ? 'text-rose-400' : 'text-emerald-400'}>
                        {isPositive ? `+${feat.shap_value.toFixed(4)}` : feat.shap_value.toFixed(4)}
                      </strong> ({feat.contribution_pct}%)
                    </span>
                  </div>

                  {/* Visual Impact Progress Bar */}
                  <div className="w-full h-2 bg-forest-800 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${Math.min(100, feat.contribution_pct)}%` }}
                      className={`h-full rounded-full ${
                        isPositive ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Model Feature Ranking */}
        {globalImportance && globalImportance.length > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-forest-950/70 border border-forest-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-2">
              Global Model Feature Importance (Across Entire Cohort):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {globalImportance.map((g) => (
                <div key={g.feature} className="p-2 rounded-lg bg-forest-900 border border-forest-800 text-[11px]">
                  <p className="text-slate-400 truncate">{g.name}</p>
                  <p className="font-bold text-emerald-400 mt-0.5">{g.importance_percentage}% (SHAP {g.mean_shap})</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Narrative Footer */}
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
          <p className="font-semibold text-emerald-300 mb-1">Clinical Interpretation:</p>
          <p className="text-slate-300 leading-relaxed">{predictionData.explanation}</p>
        </div>
      </div>
    </div>
  );
}
