import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

export default function WaveTrendChart({ liveTelemetry }) {
  // Wave data matching the Blood Pressure chart shape in reference
  const bpData = [
    { day: 'S', value: 105, label: '105/70' },
    { day: 'M', value: 112, label: '112/75' },
    { day: 'T', value: 110, label: '110/72' },
    { day: 'W', value: 125, label: '125/82' },
    { day: 'T', value: 118, label: '118/78' },
    { day: 'F', value: 155, label: '155/95' },
    { day: 'S', value: 135, label: '135/85' },
  ];

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[230px] relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Blood Pressure</h3>
        <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          Pulse/mmHg
        </span>
      </div>

      {/* Recharts Area Waveform Chart */}
      <div className="w-full h-[140px] mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={bpData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e599" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#00e599" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <XAxis 
              dataKey="day" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
            />
            <YAxis 
              domain={[90, 170]} 
              ticks={[100, 120, 140, 160]}
              tickFormatter={(v) => `${v}/${v-30}`}
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 9 }} 
            />

            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-forest-900 border border-emerald-500/30 rounded-lg px-2 py-1 text-[11px] shadow-lg text-emerald-400 font-semibold">
                      {payload[0].payload.label} mmHg
                    </div>
                  );
                }
                return null;
              }} 
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#00e599"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#waveGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
