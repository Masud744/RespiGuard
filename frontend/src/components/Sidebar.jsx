import React from 'react';
import { 
  LayoutGrid, 
  Pill, 
  MessageSquare, 
  Sparkles, 
  Activity,
  MapPin,
  X
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, onCloseMobile, isEsp32Connected = false }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'map', label: 'Air Quality Map', icon: MapPin },
    { id: 'xai', label: 'Clinical Risk AI', icon: Sparkles },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'messages', label: 'Consultations', icon: MessageSquare, badge: 4 },
  ];

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand / Logo */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-300 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="w-5 h-5 text-forest-950 stroke-[2.5]" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1">
              RespiGuard<span className="text-emerald-400">.ai</span>
            </span>
          </div>

          {/* Close button for mobile drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-forest-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Menu Section */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Clinical Portal</p>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
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

      {/* Footer System Status */}
      <div className={`p-3 rounded-2xl bg-forest-950/80 border text-xs transition-colors ${
        isEsp32Connected ? 'border-emerald-500/20' : 'border-rose-500/20'
      }`}>
        <div className={`flex items-center gap-2 font-mono font-bold mb-0.5 ${
          isEsp32Connected ? 'text-emerald-400' : 'text-rose-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            isEsp32Connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
          }`} />
          <span>esp32_node1</span>
        </div>
        <p className="text-[11px] text-slate-400">
          {isEsp32Connected ? 'Live Telemetry & ML Active' : 'Node Disconnected / Standby'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-forest-900/95 border-r border-forest-800/80 p-5 flex-col justify-between min-h-screen shrink-0 backdrop-blur-xl">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer & Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div 
            onClick={onCloseMobile} 
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <div className="relative w-64 max-w-[80vw] h-full bg-forest-900/98 border-r border-emerald-500/25 p-5 shadow-2xl z-10 flex flex-col justify-between">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
