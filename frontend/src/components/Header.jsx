import React from 'react';
import { LogOut, User, LogIn, Shield } from 'lucide-react';

export default function Header({ activeTab, currentUser, onOpenAuth, onSignOut }) {
  const titles = {
    dashboard: 'Dashboard',
    xai: 'XAI & SHAP Analytics',
    medications: 'Medications Management',
    messages: 'Clinical Messages'
  };

  const title = titles[activeTab] || 'Dashboard';

  const severityColors = {
    Mild: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Severe: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  };

  const currentSev = currentUser?.severity || 'Mild';

  return (
    <header className="flex items-center justify-between py-4 px-6 mb-6 border-b border-emerald-500/10 bg-forest-950/40 backdrop-blur-md sticky top-0 z-30">
      {/* Page Title & Node Status */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>ESP32 Node-01 Active</span>
        </div>
      </div>

      {/* Right User Profile & Auth Controls */}
      <div className="flex items-center gap-3">
        {currentUser ? (
          <div className="flex items-center gap-3 bg-forest-900/80 px-3.5 py-1.5 rounded-2xl border border-emerald-500/20 shadow-sm">
            {/* User Avatar / Initials */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-mint-400 flex items-center justify-center font-bold text-forest-950 text-xs shadow-md shadow-emerald-500/20">
              {currentUser.full_name?.charAt(0)?.toUpperCase() || 'P'}
            </div>

            {/* Profile Info */}
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white leading-none block">
                  {currentUser.full_name}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${severityColors[currentSev] || severityColors.Mild}`}>
                  {currentSev}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {currentUser.age}yo • {currentUser.sex?.toUpperCase()} • PEF {currentUser.pef_best} L/min
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 ml-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Onboard</span>
          </button>
        )}
      </div>
    </header>
  );
}
