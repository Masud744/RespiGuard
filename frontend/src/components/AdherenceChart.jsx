import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ChevronDown } from 'lucide-react';

export default function AdherenceChart({ historyData, timeframe, setTimeframe }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const data = historyData || [
    { day: 'Sat', medication_intake: 45, range_compliance: 68 },
    { day: 'Sun', medication_intake: 38, range_compliance: 55 },
    { day: 'Mon', medication_intake: 60, range_compliance: 72 },
    { day: 'Tue', medication_intake: 75, range_compliance: 80 },
    { day: 'Wed', medication_intake: 58, range_compliance: 74 },
    { day: 'Thu', medication_intake: 82, range_compliance: 85 },
    { day: 'Fri', medication_intake: 68, range_compliance: 78 },
  ];

  // Custom tooltip to replicate the glowing 60% Medicine Intake pill
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-forest-900/95 border border-emerald-500/30 rounded-xl p-2.5 shadow-xl backdrop-blur-md text-xs">
          <p className="font-semibold text-white mb-1">{label}</p>
          <div className="flex items-center gap-2 text-emerald-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-[#00e599]"></span>
            <span>{payload[0].value}% Medicine Intake</span>
          </div>
          {payload[1] && (
            <div className="flex items-center gap-2 text-teal-400 font-bold mt-1">
              <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
              <span>{payload[1].value}% Range Compliance</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="aura-card p-5 flex flex-col justify-between h-[290px] relative">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Adherence Overview</h3>
          <div className="flex items-center gap-4 text-xs mt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00e599]"></span>
              <span className="text-slate-400 text-[11px]">Medication Intake</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
              <span className="text-slate-400 text-[11px]">Range Compliance</span>
            </div>
          </div>
        </div>

        {/* Timeframe Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-forest-800/80 border border-forest-700/60 text-xs text-slate-300 hover:text-white transition"
          >
            <span className="capitalize">{timeframe || 'Weekly'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-28 bg-forest-900 border border-forest-700 rounded-xl shadow-xl z-20 py-1 text-xs">
              {['Live', 'Daily', 'Weekly', 'Monthly'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setTimeframe(opt.toLowerCase());
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-forest-800 text-slate-300 hover:text-white transition"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="medGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e599" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="#00e599" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 75, 61, 0.2)" vertical={false} />
            
            <XAxis 
              dataKey="day" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
            />
            <YAxis 
              domain={[0, 100]} 
              ticks={[0, 20, 40, 60, 80, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 10 }} 
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="medication_intake"
              stroke="#00e599"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#medGradient)"
            />
            <Area
              type="monotone"
              dataKey="range_compliance"
              stroke="#14b8a6"
              strokeWidth={1.8}
              strokeDasharray="4 2"
              fillOpacity={1}
              fill="url(#compGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
