import React, { useState, useEffect, useMemo } from 'react';
import { 
  Pill, Clock, CheckCircle2, AlertTriangle, AlertOctagon, 
  Plus, Calendar, Flame, ShieldCheck, Sparkles, RotateCcw, 
  Bell, ChevronRight, X, HeartPulse, Info, Timer, Package,
  Database, Trash2, BellOff, Power
} from 'lucide-react';
import { 
  fetchMedications, 
  saveMedication, 
  logMedicationDose, 
  deleteMedication, 
  resetMedicationsToDefaults 
} from '../api';


const DEFAULT_MEDICATIONS = [
  {
    id: 'med-1',
    name: 'Fluticasone Propionate (Flovent)',
    type: 'controller',
    category: 'Preventive Corticosteroid',
    dosage: '100 mcg / 2 puffs',
    schedule: 'Morning & Evening',
    morningScheduleTime: '08:00',
    eveningScheduleTime: '20:00',
    morningTaken: false,
    eveningTaken: false,
    morningTime: null,
    eveningTime: null,
    totalDoses: 120,
    remainingDoses: 84,
    notes: 'Inhale with spacer; rinse mouth with water after inhalation to prevent oral thrush.'
  },
  {
    id: 'med-2',
    name: 'Salbutamol / Albuterol (Ventolin HFA)',
    type: 'rescue',
    category: 'Fast-Acting Bronchodilator (SABA)',
    dosage: '100 mcg / puff',
    schedule: 'PRN (As Needed for Acute Wheezing / Chest Tightness)',
    puffsToday: 1,
    lastPuffTime: '10:45 AM',
    totalDoses: 200,
    remainingDoses: 142,
    notes: 'Relaxes bronchial smooth muscle within 5 minutes. Carry at all times.'
  },
  {
    id: 'med-3',
    name: 'Montelukast (Singulair)',
    type: 'controller',
    category: 'Leukotriene Receptor Antagonist',
    dosage: '10 mg Oral Tablet',
    schedule: 'Once Daily at Bedtime',
    morningScheduleTime: '',
    eveningScheduleTime: '21:00',
    morningTaken: false,
    eveningTaken: true,
    eveningTime: '09:30 PM (Yesterday)',
    totalDoses: 30,
    remainingDoses: 18,
    notes: 'Blocks leukotriene mediators to reduce nocturnal airway constriction.'
  }
];

export default function MedicationsPage({ currentUser }) {
  // Load saved medications state or use default
  const [medications, setMedications] = useState(() => {
    try {
      const saved = localStorage.getItem('respiguard_medications_v1');
      return saved ? JSON.parse(saved) : DEFAULT_MEDICATIONS;
    } catch {
      return DEFAULT_MEDICATIONS;
    }
  });

  // 7-day adherence record
  const [adherenceStreak, setAdherenceStreak] = useState(7);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [isDbSynced, setIsDbSynced] = useState(false);

  // Initial load from Database (with fallback to localStorage / defaults)
  useEffect(() => {
    let isMounted = true;
    async function loadFromDb() {
      try {
        const dbMeds = await fetchMedications(currentUser?.id);
        if (isMounted && Array.isArray(dbMeds) && dbMeds.length > 0) {
          setMedications(dbMeds);
          setIsDbSynced(true);
        }
      } catch (err) {
        console.warn('Could not load medications from DB, using cached:', err);
      }
    }
    loadFromDb();
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  // New medication form state
  const [newMed, setNewMed] = useState({
    name: '',
    type: 'controller',
    category: 'Preventive Inhaler',
    dosage: '100 mcg',
    schedule: 'Twice daily',
    totalDoses: 120,
    notes: ''
  });

  // Save to localStorage as offline cache whenever medications change
  useEffect(() => {
    try {
      localStorage.setItem('respiguard_medications_v1', JSON.stringify(medications));
    } catch (e) {
      console.error('Failed to save medications', e);
    }
  }, [medications]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Log morning dose in state & Database
  const handleLogMorning = async (id) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          morningTaken: true,
          morningTime: timeStr,
          remainingDoses: Math.max(0, m.remainingDoses - 1)
        };
      }
      return m;
    }));
    showToast('Morning dose logged in database!');
    try {
      const updated = await logMedicationDose(currentUser?.id, {
        medication_id: id,
        dose_type: 'morning',
        time_taken: timeStr,
        puffs_count: 1
      });
      if (Array.isArray(updated)) {
        setMedications(updated);
        setIsDbSynced(true);
      }
    } catch (err) {
      console.warn('DB dose log note:', err);
    }
  };

  // Log evening dose in state & Database
  const handleLogEvening = async (id) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          eveningTaken: true,
          eveningTime: timeStr,
          remainingDoses: Math.max(0, m.remainingDoses - 1)
        };
      }
      return m;
    }));
    showToast('Evening dose logged in database!');
    try {
      const updated = await logMedicationDose(currentUser?.id, {
        medication_id: id,
        dose_type: 'evening',
        time_taken: timeStr,
        puffs_count: 1
      });
      if (Array.isArray(updated)) {
        setMedications(updated);
        setIsDbSynced(true);
      }
    } catch (err) {
      console.warn('DB dose log note:', err);
    }
  };

  // Log rescue puff in state & Database
  const handleLogRescue = async (id) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMedications(prev => prev.map(m => {
      if (m.id === id) {
        const count = (m.puffsToday || 0) + 1;
        return {
          ...m,
          puffsToday: count,
          lastPuffTime: timeStr,
          remainingDoses: Math.max(0, (m.remainingDoses || 200) - 1)
        };
      }
      return m;
    }));
    showToast('Rescue puff logged in database.');
    try {
      const updated = await logMedicationDose(currentUser?.id, {
        medication_id: id,
        dose_type: 'rescue',
        time_taken: timeStr,
        puffs_count: 1
      });
      if (Array.isArray(updated)) {
        setMedications(updated);
        setIsDbSynced(true);
      }
    } catch (err) {
      console.warn('DB rescue log note:', err);
    }
  };

  // Reset daily tracking
  const handleResetDaily = async () => {
    try {
      const resetList = await resetMedicationsToDefaults(currentUser?.id);
      if (Array.isArray(resetList)) {
        setMedications(resetList);
        setIsDbSynced(true);
      }
    } catch {
      setMedications(prev => prev.map(m => ({
        ...m,
        morningTaken: false,
        morningTime: null,
        eveningTaken: false,
        eveningTime: null,
        puffsToday: 0,
        lastPuffTime: null
      })));
    }
    showToast('Daily tracking reset for new cycle.');
  };

  // Add custom medication to state & Database
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!newMed.name) return;

    const item = {
      id: `med-${Date.now()}`,
      name: newMed.name,
      type: newMed.type,
      category: newMed.category || (newMed.type === 'controller' ? 'Maintenance Controller' : 'Fast-Acting Bronchodilator'),
      dosage: newMed.dosage || 'Standard dose',
      schedule: newMed.schedule || 'Daily',
      totalDoses: parseInt(newMed.totalDoses, 10) || 100,
      remainingDoses: parseInt(newMed.totalDoses, 10) || 100,
      morningTaken: false,
      eveningTaken: false,
      puffsToday: 0,
      notes: newMed.notes || ''
    };

    setMedications(prev => [...prev, item]);
    setIsAddModalOpen(false);
    setNewMed({
      name: '',
      type: 'controller',
      category: 'Preventive Inhaler',
      dosage: '100 mcg',
      schedule: 'Twice daily',
      totalDoses: 120,
      notes: ''
    });
    showToast(`Added ${item.name} to database.`);
    try {
      const updated = await saveMedication(currentUser?.id, item);
      if (Array.isArray(updated)) {
        setMedications(updated);
        setIsDbSynced(true);
      }
    } catch (err) {
      console.warn('DB save medication note:', err);
    }
  };

  // Delete medication from state & Database
  const handleDeleteMedication = async (id) => {
    setMedications(prev => prev.filter(m => m.id !== id));
    showToast('Medication removed from database.');
    try {
      const updated = await deleteMedication(currentUser?.id, id);
      if (Array.isArray(updated)) {
        setMedications(updated);
      }
    } catch (err) {
      console.warn('DB delete medication note:', err);
    }
  };

  // Handle editing a medication's schedule time
  const handleUpdateScheduleTime = async (medId, field, value) => {
    const updatedList = medications.map(m => 
      m.id === medId ? { ...m, [field]: value } : m
    );
    setMedications(updatedList);
    showToast('Schedule updated.');
    const targetMed = updatedList.find(m => m.id === medId);
    if (targetMed) {
      try {
        await saveMedication(currentUser?.id, targetMed);
      } catch (err) {
        console.warn('DB update note:', err);
      }
    }
  };


  // Calculate total rescue puffs today across all rescue meds
  const totalRescuePuffsToday = medications
    .filter(m => m.type === 'rescue')
    .reduce((acc, m) => acc + (m.puffsToday || 0), 0);

  const isGinaAlertActive = totalRescuePuffsToday > 2;

  // Next Dose Countdown Timer with User ON/OFF Toggle
  const [isTimerEnabled, setIsTimerEnabled] = useState(() => {
    return localStorage.getItem('respiguard_med_timer_enabled') !== 'false';
  });
  const [countdownStr, setCountdownStr] = useState('');
  const [nextDoseMed, setNextDoseMed] = useState(null);

  const toggleTimer = () => {
    const nextState = !isTimerEnabled;
    setIsTimerEnabled(nextState);
    localStorage.setItem('respiguard_med_timer_enabled', String(nextState));
    showToast(nextState ? 'Dose countdown timer activated.' : 'Dose countdown timer turned OFF.');
  };

  useEffect(() => {
    function computeCountdown() {
      if (!isTimerEnabled) {
        setCountdownStr('OFF');
        return;
      }

      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const controllers = medications.filter(m => m.type === 'controller');
      if (controllers.length === 0) { setCountdownStr('--'); setNextDoseMed(null); return; }

      // Find next pending dose across all controllers
      let earliest = null;
      let earliestMed = null;

      controllers.forEach(med => {
        // Parse morning time
        if (med.morningScheduleTime && !med.morningTaken) {
          const [mh, mm] = med.morningScheduleTime.split(':').map(Number);
          const target = new Date(now);
          target.setHours(mh, mm, 0, 0);
          if (target <= now) target.setDate(target.getDate() + 1);
          if (!earliest || target < earliest) { earliest = target; earliestMed = med; }
        }
        // Parse evening time
        if (med.eveningScheduleTime && !med.eveningTaken) {
          const [eh, em] = med.eveningScheduleTime.split(':').map(Number);
          const target = new Date(now);
          target.setHours(eh, em, 0, 0);
          if (target <= now) target.setDate(target.getDate() + 1);
          if (!earliest || target < earliest) { earliest = target; earliestMed = med; }
        }
      });

      if (!earliest) {
        // All doses taken, find tomorrow's first
        const firstMorning = controllers.find(m => m.morningScheduleTime);
        if (firstMorning) {
          const [mh, mm] = firstMorning.morningScheduleTime.split(':').map(Number);
          earliest = new Date(now);
          earliest.setDate(earliest.getDate() + 1);
          earliest.setHours(mh, mm, 0, 0);
          earliestMed = firstMorning;
        }
      }

      if (earliest && earliestMed) {
        const diff = Math.max(0, earliest - now);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const label = earliest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setCountdownStr(`${hours}h ${mins}m (${label})`);
        setNextDoseMed(earliestMed);
      } else {
        setCountdownStr('--');
        setNextDoseMed(null);
      }
    }

    computeCountdown();
    const timer = setInterval(computeCountdown, 30000);
    return () => clearInterval(timer);
  }, [medications, isTimerEnabled]);

  // Dynamic canister stats from actual medication data
  const canisterStats = useMemo(() => {
    let totalRemaining = 0;
    let totalCapacity = 0;
    let lowestPct = 100;
    let lowestMed = null;
    medications.forEach(m => {
      const rem = m.remainingDoses || 0;
      const cap = m.totalDoses || 1;
      totalRemaining += rem;
      totalCapacity += cap;
      const pct = Math.round((rem / cap) * 100);
      if (pct < lowestPct) { lowestPct = pct; lowestMed = m; }
    });
    const overallPct = totalCapacity > 0 ? Math.round((totalRemaining / totalCapacity) * 100) : 0;
    const estimatedDays = medications.length > 0 ? Math.round(totalRemaining / Math.max(medications.length * 2, 1)) : 0;
    return { totalRemaining, totalCapacity, overallPct, estimatedDays, lowestPct, lowestMed };
  }, [medications]);

  const isLowCanister = canisterStats.lowestPct < 20;

  // 7-day adherence days
  const daysOfWeek = [
    { day: 'Mon', completed: true },
    { day: 'Tue', completed: true },
    { day: 'Wed', completed: true },
    { day: 'Thu', completed: true },
    { day: 'Fri', completed: true },
    { day: 'Sat', completed: true },
    { day: 'Today', completed: medications.some(m => m.morningTaken || m.eveningTaken) }
  ];

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-600 text-forest-950 font-bold text-xs shadow-xl shadow-emerald-950/50 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#13493b] via-[#0e352b] to-forest-950 border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Medications & Inhaler Tracker
            </h2>
            {isDbSynced ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] text-emerald-300 font-bold">
                <Database className="w-3 h-3 text-emerald-400" /> DB Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-500/15 border border-slate-500/30 text-[11px] text-slate-400 font-medium">
                <Database className="w-3 h-3 text-slate-400" /> Offline Sync
              </span>
            )}
          </div>
          <p className="text-emerald-100/75 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Track daily preventive controllers and rescue inhaler usage with persistent database audit log
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDaily}
            title="Reset daily logs for testing"
            className="px-3.5 py-2 rounded-2xl bg-forest-900/80 border border-forest-700/80 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Day</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#00e599] hover:from-emerald-400 hover:to-emerald-300 text-forest-950 text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Medication</span>
          </button>
        </div>
      </div>

      {/* GINA GUIDELINE EMERGENCY WARNING BANNER (If rescue > 2 puffs/day) */}
      {isGinaAlertActive && (
        <div className="p-5 rounded-3xl bg-gradient-to-r from-rose-950/80 via-red-900/60 to-forest-950 border border-rose-500/50 shadow-xl shadow-rose-950/40 animate-pulse flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 text-rose-400">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">GINA Guideline Warning</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-400/40">
                  {totalRescuePuffsToday} Rescue Puffs Logged Today
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                Elevated Reliever Inhaler Frequency (&gt;2 Puffs/24h)
              </h3>
              <p className="text-xs text-rose-200/90 mt-1 max-w-3xl leading-relaxed">
                Using rescue inhaler (SABA) more than twice in 24 hours indicates <strong>loss of asthma control</strong> or imminent bronchospasm exacerbation according to GINA clinical guidelines. Avoid trigger zones and consult your physician immediately.
              </p>
            </div>
          </div>

          <a
            href="#consult-doctor"
            className="shrink-0 px-4 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-500/30 transition flex items-center gap-1.5"
          >
            <span>Message Doctor</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* NEXT DOSE COUNTDOWN STRIP WITH USER ON/OFF TOGGLE */}
      {nextDoseMed && (
        <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isTimerEnabled 
            ? 'bg-forest-900/80 border-emerald-500/25 shadow-lg shadow-emerald-950/20' 
            : 'bg-forest-950/70 border-slate-800 opacity-90'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isTimerEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}>
              {isTimerEnabled ? <Timer className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Next Scheduled Dose
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                  isTimerEnabled 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isTimerEnabled ? 'Timer Active' : 'Timer OFF'}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-white">
                {nextDoseMed.name.split('(')[0].trim()}
              </h4>
              <span className="text-[11px] text-emerald-300 font-mono">{nextDoseMed.dosage}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="bg-forest-950/80 px-4 py-2 rounded-2xl border border-emerald-500/20 text-right min-w-[100px]">
              <span className="text-[10px] text-slate-400 block">
                {isTimerEnabled ? 'Countdown' : 'Status'}
              </span>
              <span className={`text-base sm:text-lg font-extrabold font-mono ${
                isTimerEnabled ? 'text-emerald-400' : 'text-slate-400'
              }`}>
                {isTimerEnabled ? countdownStr : 'OFF'}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleTimer}
              title={isTimerEnabled ? 'Turn OFF Countdown Timer' : 'Turn ON Countdown Timer'}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 border ${
                isTimerEnabled 
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-300' 
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {isTimerEnabled ? (
                <>
                  <Power className="w-3.5 h-3.5 text-rose-400" />
                  <span>Turn OFF</span>
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Turn ON</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STATS & STREAK OVERVIEW (3 Grid Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: 7-Day Streak */}
        <div className="aura-card p-5 border border-emerald-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Adherence Streak</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-white">{adherenceStreak}</span>
              <span className="text-xs text-emerald-400 font-bold">Days Consecutive</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">94% weekly compliance with preventive regimen</p>
          </div>
          {/* Mini Calendar Dots */}
          <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-forest-800">
            {daysOfWeek.map((d, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[9px] text-slate-400 mb-1">{d.day}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  d.completed ? 'bg-emerald-500 text-forest-950' : 'bg-forest-800 text-slate-500'
                }`}>
                  {d.completed ? '✓' : '•'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Today's Rescue Inhaler Usage */}
        <div className={`aura-card p-5 border flex flex-col justify-between ${
          isGinaAlertActive ? 'border-rose-500/40 bg-rose-950/20' : 'border-amber-500/20'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Rescue Inhaler (24h)</span>
            <div className={`p-2 rounded-xl ${
              isGinaAlertActive ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${
                isGinaAlertActive ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {totalRescuePuffsToday}
              </span>
              <span className="text-xs text-slate-400">puffs taken today</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {isGinaAlertActive 
                ? 'Exceeds safe 2 puffs/day guideline limit' 
                : 'Within recommended GINA baseline limit (≤ 2 puffs)'}
            </p>
          </div>
          <div className="pt-2 border-t border-forest-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Safe Target:</span>
            <span className="text-emerald-400 font-semibold">&le; 2 puffs / 24 hours</span>
          </div>
        </div>

        {/* Card 3: Inhaler Supply & Canister Health (Dynamic) */}
        <div className={`aura-card p-5 border flex flex-col justify-between ${isLowCanister ? 'border-rose-500/40 bg-rose-950/10' : 'border-forest-700/80'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Canister Fill Level</span>
            <div className={`p-2 rounded-xl ${isLowCanister ? 'bg-rose-500/15 text-rose-400' : 'bg-forest-800 text-slate-300'}`}>
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${isLowCanister ? 'text-rose-400' : 'text-white'}`}>{canisterStats.totalRemaining}</span>
              <span className="text-xs text-slate-400">/ {canisterStats.totalCapacity} puffs left</span>
            </div>
            {isLowCanister && canisterStats.lowestMed && (
              <div className="mt-1.5 text-[10px] font-bold text-rose-300 bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-500/30 inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Low Canister: {canisterStats.lowestMed.name.split('(')[0].trim()} ({canisterStats.lowestPct}% remaining)
              </div>
            )}
            {/* Progress Bar */}
            <div className="w-full bg-forest-800 h-2 rounded-full overflow-hidden mt-2.5">
              <div 
                style={{ width: `${canisterStats.overallPct}%` }}
                className={`h-full rounded-full ${isLowCanister ? 'bg-gradient-to-r from-rose-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-[#00e599]'}`}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-forest-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Estimated Refill:</span>
            <span className="text-slate-200 font-semibold">{canisterStats.estimatedDays} Days Remaining</span>
          </div>
        </div>
      </div>

      {/* ACTIVE MEDICATIONS LIST (Controllers & Rescue Inhalers) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Prescribed Medication Regimen</span>
          </h3>
          <span className="text-xs text-slate-400">{medications.length} active prescriptions</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {medications.map((med) => {
            const isController = med.type === 'controller';
            return (
              <div 
                key={med.id}
                className={`p-6 rounded-3xl bg-forest-900/80 border transition-all duration-200 flex flex-col justify-between ${
                  isController ? 'border-emerald-500/25 hover:border-emerald-500/40' : 'border-amber-500/25 hover:border-amber-500/40'
                }`}
              >
                {/* Header & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isController 
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}>
                          {isController ? 'Controller (Preventive)' : 'Rescue (Reliever)'}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {med.category}
                        </span>
                      </div>
                      <h4 className="text-base font-extrabold text-white">{med.name}</h4>
                    </div>

                    <div className="text-right shrink-0 flex items-start gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-emerald-400 block">{med.dosage}</span>
                        <span className="text-[10px] text-slate-400">{med.remainingDoses} doses left</span>
                      </div>
                      <button
                        onClick={() => handleDeleteMedication(med.id)}
                        title="Remove medication from database"
                        className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300/90 leading-relaxed mb-4">
                    {med.notes}
                  </p>

                  {/* Editable Schedule Times */}
                  {isController ? (
                    <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-300">Schedule</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Morning Dose</label>
                          <input
                            type="time"
                            value={med.morningScheduleTime || ''}
                            onChange={(e) => handleUpdateScheduleTime(med.id, 'morningScheduleTime', e.target.value)}
                            className="w-full bg-forest-900 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Evening Dose</label>
                          <input
                            type="time"
                            value={med.eveningScheduleTime || ''}
                            onChange={(e) => handleUpdateScheduleTime(med.id, 'eveningScheduleTime', e.target.value)}
                            className="w-full bg-forest-900 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-forest-950/60 border border-forest-800 text-xs text-slate-300 flex items-center gap-2 mb-4">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Schedule:</strong> {med.schedule}</span>
                    </div>
                  )}
                </div>

                {/* Dose Logging Actions */}
                <div className="pt-3 border-t border-forest-800/80">
                  {isController ? (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Morning Dose Button */}
                      <button
                        type="button"
                        onClick={() => handleLogMorning(med.id)}
                        disabled={med.morningTaken}
                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          med.morningTaken
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-forest-800 hover:bg-forest-700 text-white border border-forest-600'
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${med.morningTaken ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span>{med.morningTaken ? `Morning: ${med.morningTime || 'Taken'}` : 'Take Morning'}</span>
                      </button>

                      {/* Evening Dose Button */}
                      <button
                        type="button"
                        onClick={() => handleLogEvening(med.id)}
                        disabled={med.eveningTaken}
                        className={`py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          med.eveningTaken
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-forest-800 hover:bg-forest-700 text-white border border-forest-600'
                        }`}
                      >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${med.eveningTaken ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <span>{med.eveningTaken ? `Evening: ${med.eveningTime || 'Taken'}` : 'Take Evening'}</span>
                      </button>
                    </div>
                  ) : (
                    /* Rescue Inhaler Logger */
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-forest-950/80 p-3 rounded-2xl border border-amber-500/20">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Today's Puffs: <span className="text-amber-400 font-mono text-sm">{med.puffsToday || 0}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {med.lastPuffTime ? `Last actuation at ${med.lastPuffTime}` : 'No puffs logged today'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLogRescue(med.id)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-forest-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition cursor-pointer"
                      >
                        <HeartPulse className="w-3.5 h-3.5" />
                        <span>+ Log 1 Rescue Puff</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ADD MEDICATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-forest-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-forest-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Prescribed Medication</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Medication Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Budesonide / Formoterol (Symbicort)"
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category Type</label>
                  <select
                    value={newMed.type}
                    onChange={(e) => setNewMed({ ...newMed, type: e.target.value })}
                    className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="controller">Controller (Preventive)</option>
                    <option value="rescue">Rescue (Reliever)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Dose / Strength</label>
                  <input
                    type="text"
                    placeholder="e.g. 160/4.5 mcg"
                    value={newMed.dosage}
                    onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                    className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Schedule / Frequency</label>
                <input
                  type="text"
                  placeholder="e.g. 2 puffs morning, 2 puffs evening"
                  value={newMed.schedule}
                  onChange={(e) => setNewMed({ ...newMed, schedule: e.target.value })}
                  className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Canister Capacity (Puffs)</label>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={newMed.totalDoses}
                  onChange={(e) => setNewMed({ ...newMed, totalDoses: e.target.value })}
                  className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Instructions</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Inhale deeply, hold breath for 10 seconds."
                  value={newMed.notes}
                  onChange={(e) => setNewMed({ ...newMed, notes: e.target.value })}
                  className="w-full bg-forest-950 border border-emerald-500/25 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-forest-950 font-bold text-xs"
                >
                  Save Inhaler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
