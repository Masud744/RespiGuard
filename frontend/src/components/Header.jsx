import React from 'react';
import { LogOut, User, LogIn, Shield, Menu, Edit3 } from 'lucide-react';

export default function Header({ 
  activeTab, 
  currentUser, 
  onOpenAuth, 
  onSignOut, 
  onOpenProfile, 
  onToggleSidebar,
  isEsp32Connected = false
}) {
  const titles = {
    dashboard: 'Dashboard',
    map: 'Air Quality Map',
    xai: 'Clinical Risk AI',
    medications: 'Medications',
    messages: 'Consultations'
  };

  const title = titles[activeTab] || 'Dashboard';

  const severityColors = {
    Mild: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Moderate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Severe: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
  };

  const currentSev = currentUser?.severity || 'Mild';

  return (
    <header className="flex items-center justify-between py-3.5 px-4 sm:px-6 mb-6 border-b border-emerald-500/10 bg-forest-950/60 backdrop-blur-md sticky top-0 z-30">
      {/* Page Title & Mobile Menu Button */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
          className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white bg-forest-900/80 border border-emerald-500/20 hover:bg-forest-800 transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h1>
            {isEsp32Connected ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ESP32 Node Active</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>ESP32 Node Inactive</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right User Profile & Auth Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {currentUser ? (
          <div className="flex items-center gap-2 sm:gap-3 bg-forest-900/90 px-2.5 sm:px-3.5 py-1.5 rounded-2xl border border-emerald-500/25 shadow-sm">
            {/* Clickable Profile Card / Avatar */}
            <button
              type="button"
              onClick={onOpenProfile}
              title="Click to view and edit profile details"
              className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
            >
              {/* User Avatar / Initials */}
              <div className="relative">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-mint-400 flex items-center justify-center font-extrabold text-forest-950 text-xs shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  {currentUser.full_name?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-forest-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Edit3 className="w-2.5 h-2.5" />
                </div>
              </div>

              {/* Profile Info (hidden on very small screens) */}
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors leading-none block">
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
            </button>

            <div className="h-6 w-px bg-forest-800 hidden sm:block" />

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-all border border-transparent hover:border-rose-500/20 cursor-pointer"
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
