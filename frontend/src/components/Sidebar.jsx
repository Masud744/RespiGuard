import React from 'react';
import { 
  LayoutGrid, 
  Pill, 
  MessageSquare, 
  Sparkles, 
  Activity 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'xai', label: 'XAI & SHAP Analytics', icon: Sparkles },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 4 },
  ];

  return (
    <aside className="w-64 bg-forest-900/95 border-r border-forest-800/80 p-5 flex flex-col justify-between min-h-screen shrink-0 backdrop-blur-xl">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-forest-950 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1">
              AuraHealth<span className="text-emerald-400">.io</span>
            </span>
          </div>
          <div className="w-5 h-5 rounded border border-forest-700/60 flex items-center justify-center text-slate-400 cursor-pointer hover:text-white transition">
            <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-current"></div>
          </div>
        </div>

        {/* Menu Section */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Menu</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-500 text-forest-950 font-semibold shadow-lg shadow-emerald-500/25 glow-pill'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-forest-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-forest-950' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-forest-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
