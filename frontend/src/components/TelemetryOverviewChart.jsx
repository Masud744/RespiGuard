import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { ChevronDown, Activity, Sparkles, Filter } from 'lucide-react';

export default function TelemetryOverviewChart({ historyData, timeframe, setTimeframe, liveTelemetry }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState({
    pm2_5: true,
    pm10: true,
    pm1_0: true,
    temperature: true,
    humidity: true,
  });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Process data or create rich multi-parameter fallback
  const rawData = historyData && historyData.length > 0 ? historyData : [
    { day: 'Sat', time: '10:00', temperature: 26.5, humidity: 62.0, pm1_0: 11.2, pm2_5: 16.4, pm10: 28.0, mq135: 410, risk_label: 'Green' },
    { day: 'Sun', time: '12:00', temperature: 27.8, humidity: 68.5, pm1_0: 14.5, pm2_5: 21.0, pm10: 34.5, mq135: 435, risk_label: 'Yellow' },
    { day: 'Mon', time: '14:00', temperature: 28.4, humidity: 65.2, pm1_0: 12.8, pm2_5: 17.8, pm10: 29.3, mq135: 412, risk_label: 'Green' },
    { day: 'Tue', time: '16:00', temperature: 29.2, humidity: 74.0, pm1_0: 18.2, pm2_5: 27.5, pm10: 42.0, mq135: 480, risk_label: 'Yellow' },
    { day: 'Wed', time: '18:00', temperature: 25.4, humidity: 58.0, pm1_0: 9.8,  pm2_5: 14.2, pm10: 24.0, mq135: 395, risk_label: 'Green' },
    { day: 'Thu', time: '20:00', temperature: 31.0, humidity: 82.0, pm1_0: 24.5, pm2_5: 38.4, pm10: 64.0, mq135: 590, risk_label: 'Red' },
    { day: 'Fri', time: '22:00', temperature: 27.0, humidity: 63.0, pm1_0: 12.0, pm2_5: 18.0, pm10: 30.0, mq135: 420, risk_label: 'Green' },
  ];

  // Parameters configuration with luxury colors matching reference style
  const parameters = [
    { key: 'pm2_5', label: 'PM2.5 (Fine)', color: '#00e599', unit: 'µg/m³', gradient: 'pm25Grad' },
    { key: 'pm10', label: 'PM10 (Coarse)', color: '#14b8a6', unit: 'µg/m³', gradient: 'pm10Grad' },
    { key: 'pm1_0', label: 'PM1.0 (Ultrafine)', color: '#6ee7b7', unit: 'µg/m³', gradient: 'pm1Grad' },
    { key: 'humidity', label: 'Humidity', color: '#38bdf8', unit: '%', gradient: 'humGrad' },
    { key: 'temperature', label: 'Temperature', color: '#f59e0b', unit: '°C', gradient: 'tempGrad' },
  ];

  // Custom multi-parameter floating tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload || {};
      return (
        <div className="bg-forest-900/95 border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs min-w-[220px]">
          <div className="flex items-center justify-between border-b border-forest-800 pb-2 mb-2">
            <span className="font-bold text-white">{label} ({dataPoint.time || 'Live'})</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              dataPoint.risk_label === 'Red' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
              dataPoint.risk_label === 'Yellow' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
              'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {dataPoint.risk_label || 'Safe'} Risk
            </span>
          </div>

          <div className="space-y-1.5 font-medium">
            {payload.map((entry) => (
              <div key={entry.dataKey} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-300 text-[11px] capitalize">{entry.name}:</span>
                </div>
                <span className="font-bold font-mono text-white text-[11px]">
                  {entry.value} {entry.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="aura-card p-6 flex flex-col justify-between w-full h-[360px] relative">
      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-sm shadow-emerald-500/30">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Real-Time Environmental & Telemetry Overview
              </h3>
              <p className="text-xs text-slate-400">
                Continuous 5-parameter sensor trends (DHT22 + PMS5003 Laser Suite)
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls: Interactive Series Toggles & Timeframe Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Parameter Visibility Toggle Pills */}
          <div className="flex items-center gap-1.5 bg-forest-950/80 p-1 rounded-xl border border-forest-800">
            {parameters.map((p) => {
              const isVisible = visibleSeries[p.key];
              return (
                <button
                  key={p.key}
                  onClick={() => toggleSeries(p.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isVisible
                      ? 'bg-forest-800 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300 opacity-60'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isVisible ? p.color : '#475569' }}
                  />
                  <span>{p.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Timeframe Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forest-800 border border-forest-700 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              <span className="capitalize">{timeframe || 'Weekly'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-32 bg-forest-900 border border-forest-700 rounded-xl shadow-2xl z-30 py-1 text-xs">
                {['Live (Real-Time)', 'Hourly', 'Daily', 'Weekly'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setTimeframe(opt.toLowerCase().split(' ')[0]);
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-forest-800 text-slate-300 hover:text-white transition font-medium"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="w-full h-[250px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rawData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="pm25Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00e599" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#00e599" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="pm10Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="pm1Grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6ee7b7" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#6ee7b7" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
              </linearGradient>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 75, 61, 0.25)" vertical={false} />

            <XAxis 
              dataKey="day" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
            />
            <YAxis 
              domain={[0, 100]} 
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} 
            />

            <Tooltip content={<CustomTooltip />} />

            {visibleSeries.pm2_5 && (
              <Area
                type="monotone"
                dataKey="pm2_5"
                name="PM2.5"
                unit="µg/m³"
                stroke="#00e599"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#pm25Grad)"
              />
            )}

            {visibleSeries.pm10 && (
              <Area
                type="monotone"
                dataKey="pm10"
                name="PM10"
                unit="µg/m³"
                stroke="#14b8a6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pm10Grad)"
              />
            )}

            {visibleSeries.pm1_0 && (
              <Area
                type="monotone"
                dataKey="pm1_0"
                name="PM1.0"
                unit="µg/m³"
                stroke="#6ee7b7"
                strokeWidth={1.8}
                strokeDasharray="4 2"
                fillOpacity={1}
                fill="url(#pm1Grad)"
              />
            )}

            {visibleSeries.humidity && (
              <Area
                type="monotone"
                dataKey="humidity"
                name="Humidity"
                unit="%"
                stroke="#38bdf8"
                strokeWidth={1.8}
                fillOpacity={1}
                fill="url(#humGrad)"
              />
            )}

            {visibleSeries.temperature && (
              <Area
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                unit="°C"
                stroke="#f59e0b"
                strokeWidth={1.8}
                strokeDasharray="3 3"
                fillOpacity={1}
                fill="url(#tempGrad)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
