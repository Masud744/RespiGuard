import React from 'react';
import { Wind, Info } from 'lucide-react';

export default function AirQualityRadial({ telemetry, predictionData }) {
  // Current values
  const pm25 = telemetry?.pm2_5 ?? 17.8;
  const pm10 = telemetry?.pm10 ?? 29.3;
  const humidity = telemetry?.humidity ?? 65.2;
  const temp = telemetry?.temperature ?? 28.4;

  // Normalized percentages for the rings (0-100)
  const pm25Pct = Math.min(100, Math.round((pm25 / 50) * 100));
  const pm10Pct = Math.min(100, Math.round((pm10 / 100) * 100));
  const humPct = Math.min(100, Math.round((humidity / 100) * 100));

  // Calculated overall Air Quality index (0-500 scale or index points)
  const aqiValue = Math.round(pm25 * 3.8 + pm10 * 0.8 + 24);

  // SVG parameters for concentric rings
  const size = 200;
  const center = size / 2;

  const rings = [
    {
      radius: 80,
      strokeWidth: 8,
      pct: pm25Pct,
      color: '#00e599',
      trackColor: 'rgba(0, 229, 153, 0.12)',
      label: 'PM2.5',
      val: `${pm25} µg/m³`
    },
    {
      radius: 66,
      strokeWidth: 8,
      pct: pm10Pct,
      color: '#14b8a6',
      trackColor: 'rgba(20, 184, 166, 0.12)',
      label: 'PM10',
      val: `${pm10} µg/m³`
    },
    {
      radius: 52,
      strokeWidth: 8,
      pct: humPct,
      color: '#059669',
      trackColor: 'rgba(5, 150, 105, 0.12)',
      label: 'Humidity',
      val: `${humidity}%`
    }
  ];

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[290px] relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Today's Air Quality</h3>
        <span className="text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          DHT22 + PMS
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
                {/* Active Progress */}
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

        {/* Center Data Display (matches 1422 Calories layout) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold text-white tracking-tight leading-none">
            {aqiValue}
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-1">AQI Index</span>
          <span className="text-[9px] text-emerald-400 font-semibold mt-0.5">
            {predictionData?.prediction === 'Green' ? 'Good Range' : predictionData?.prediction === 'Yellow' ? 'Moderate Risk' : 'Unhealthy'}
          </span>
        </div>
      </div>

      {/* Legend matching reference: ● Protein ● Carbs ● Fat */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00e599]"></span>
          <span className="text-slate-400 text-[11px]">PM2.5</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
          <span className="text-slate-400 text-[11px]">PM10</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
          <span className="text-slate-400 text-[11px]">Humidity</span>
        </div>
      </div>
    </div>
  );
}
