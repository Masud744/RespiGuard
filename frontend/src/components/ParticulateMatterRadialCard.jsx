import React from 'react';
import { Wind } from 'lucide-react';

export default function ParticulateMatterRadialCard({ telemetry }) {
  const pm25 = telemetry?.pm2_5 ?? 17.8;
  const pm10 = telemetry?.pm10 ?? 29.3;
  const pm10_ = telemetry?.pm1_0 ?? 12.8;

  // Normalized percentages for rings (0-100)
  const pm25Pct = Math.min(100, Math.max(0, Math.round((pm25 / 50) * 100)));
  const pm10Pct = Math.min(100, Math.max(0, Math.round((pm10 / 100) * 100)));
  const pm10_Pct = Math.min(100, Math.max(0, Math.round((pm10_ / 35) * 100)));

  const size = 180;
  const center = size / 2;

  const rings = [
    {
      radius: 72,
      strokeWidth: 7,
      pct: pm25Pct,
      color: '#00e599',
      trackColor: 'rgba(0, 229, 153, 0.12)',
      label: 'PM2.5',
      val: `${pm25} µg/m³`
    },
    {
      radius: 58,
      strokeWidth: 7,
      pct: pm10Pct,
      color: '#14b8a6',
      trackColor: 'rgba(20, 184, 166, 0.12)',
      label: 'PM10',
      val: `${pm10} µg/m³`
    },
    {
      radius: 44,
      strokeWidth: 7,
      pct: pm10_Pct,
      color: '#059669',
      trackColor: 'rgba(5, 150, 105, 0.12)',
      label: 'PM1.0',
      val: `${pm10_} µg/m³`
    }
  ];

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[280px] relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-forest-800/80 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wind className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Particulate Matter</h3>
        </div>
        <span className="text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
          PMS5003 Laser
        </span>
      </div>

      {/* Concentric Gauge Center */}
      <div className="relative flex items-center justify-center my-1">
        <svg width={size} height={size} className="transform -rotate-90">
          {rings.map((ring, idx) => {
            const circumference = 2 * Math.PI * ring.radius;
            const strokeDashoffset = circumference - (ring.pct / 100) * circumference;

            return (
              <g key={idx}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  stroke={ring.trackColor}
                  strokeWidth={ring.strokeWidth}
                  fill="transparent"
                />
                {/* Active Ring */}
                <circle
                  cx={center}
                  cy={center}
                  r={ring.radius}
                  stroke={ring.color}
                  strokeWidth={ring.strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </g>
            );
          })}
        </svg>

        {/* Center Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold text-white tracking-tight leading-none">
            {pm25}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1">
            PM2.5 (µg/m³)
          </span>
          <span className="text-[9px] text-emerald-400 font-semibold mt-0.5">
            {pm25 <= 25 ? 'Clean Particle Level' : pm25 <= 35 ? 'Moderate Aerosol' : 'High Exacerbation Hazard'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00e599]"></span>
          <span className="text-slate-400 text-[11px]">PM2.5: {pm25}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
          <span className="text-slate-400 text-[11px]">PM10: {pm10}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
          <span className="text-slate-400 text-[11px]">PM1.0: {pm10_}</span>
        </div>
      </div>
    </div>
  );
}
