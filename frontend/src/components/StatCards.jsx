import React from 'react';
import { Stethoscope, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatCards({ stats }) {
  const medicalTeamCount = stats?.metrics?.medical_team_size || 246;
  const patientCount = stats?.metrics?.active_patients || 1256;

  return (
    <div className="flex flex-col gap-4">
      {/* Stat Card 1: Medical Team */}
      <div className="aura-card p-4.5 flex flex-col justify-between h-[82px] min-w-[210px] relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 rounded-lg bg-forest-800/80 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Stethoscope className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <ArrowUpRight className="w-3 h-3" />
            <span>+1.01% this week</span>
          </div>
        </div>

        <div className="mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white tracking-tight">{medicalTeamCount}</span>
            <span className="text-xs font-medium text-slate-400">Medical Team</span>
          </div>
        </div>
      </div>

      {/* Stat Card 2: Patients */}
      <div className="aura-card p-4.5 flex flex-col justify-between h-[82px] min-w-[210px] relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 rounded-lg bg-forest-800/80 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400/80">
            <ArrowDownRight className="w-3 h-3" />
            <span>-0.91% this week</span>
          </div>
        </div>

        <div className="mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white tracking-tight">{patientCount.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-400">Patients</span>
          </div>
        </div>
      </div>
    </div>
  );
}
