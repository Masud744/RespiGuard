import React from 'react';
import { Thermometer, Droplets } from 'lucide-react';

export default function TempHumidityRadialCard({ telemetry }) {
  const temp = telemetry?.temperature ?? 28.4;
  const humidity = telemetry?.humidity ?? 65.2;

  // Normalized percentages for rings
  const tempPct = Math.min(100, Math.max(0, Math.round((temp / 50) * 100)));
  const humPct = Math.min(100, Math.max(0, Math.round((humidity / 100) * 100)));

  const size = 180;
  const center = size / 2;

  const rings = [
    {
      radius: 70,
      strokeWidth: 8,
      pct: tempPct,
      color: '#00e599',
      trackColor: 'rgba(0, 229, 153, 0.12)',
      label: 'Temp',
      val: `${temp}°C`
    },
    {
      radius: 54,
      strokeWidth: 8,
      pct: humPct,
      color: '#14b8a6',
      trackColor: 'rgba(20, 184, 166, 0.12)',
      label: 'Humidity',
      val: `${humidity}%`
    }
  ];

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[280px] relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-forest-800/80 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Thermometer className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Temp & Humidity</h3>
        </div>
        <span className="text-[10px] text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
          DHT22 Sensor
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
            {temp}°C
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1">
            {humidity}% RH
          </span>
          <span className="text-[9px] text-emerald-400 font-semibold mt-0.5">
            {humidity >= 40 && humidity <= 70 ? 'Comfort Zone' : 'Airway Trigger Risk'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00e599]"></span>
          <span className="text-slate-400 text-[11px]">Temperature ({temp}°C)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
          <span className="text-slate-400 text-[11px]">Humidity ({humidity}%)</span>
        </div>
      </div>
    </div>
  );
}
