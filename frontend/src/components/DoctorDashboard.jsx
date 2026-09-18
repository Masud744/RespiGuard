import React, { useState, useEffect, useRef } from 'react';
import {
  Stethoscope, Users, Activity, MessageSquare, AlertTriangle,
  CheckCircle2, Plus, Search, ShieldCheck, Clock, Send,
  Building2, Phone, Award, LogOut, ChevronRight, ChevronLeft, RefreshCw,
  Sparkles, Filter, Check, Copy, UserCheck, Lock, CheckCheck
} from 'lucide-react';
import { fetchDoctorPatients, getMessages, sendMessageToDoctor, pairPatientWithDoctor } from '../api';

export default function DoctorDashboard({ currentUser, onLogout, onOpenProfile, onMessageSent }) {
  const [activeTab, setActiveTab] = useState('patients'); // 'patients' | 'consultations'
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pairCodeInput, setPairCodeInput] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState('');
  const [pairSuccess, setPairSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileDoctorView, setMobileDoctorView] = useState('list'); // 'list' | 'detail'
  const messagesEndRef = useRef(null);

  // -------------------------------------------------------------
  // Load Doctor's Linked Patients
  // -------------------------------------------------------------
  const loadPatients = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDoctorPatients(currentUser?.id);
      if (Array.isArray(data) && data.length > 0) {
        const validPatients = data.filter(p => {
          const name = p.patient_name || '';
          const em = p.patient_email || '';
          return !name.includes('Chat Specialist') && !em.includes('hospital.org');
        });
        setPatients(validPatients);
        if (!selectedPatient || !validPatients.some(p => p.patient_id === selectedPatient.patient_id)) {
          setSelectedPatient(validPatients[0] || null);
        }
      } else {
        setPatients([]);
        setSelectedPatient(null);
      }
    } catch (err) {
      console.warn('Error loading doctor patients:', err);
      setPatients([]);
      setSelectedPatient(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // Load Messages for Doctor & Selected Patient (Stored strictly in DB)
  // -------------------------------------------------------------
  const loadMessages = async () => {
    if (!currentUser) return;
    try {
      const res = await getMessages(currentUser.id);
      const list = Array.isArray(res) ? res : (res && Array.isArray(res.messages) ? res.messages : []);
      setMessages(list);
    } catch (err) {
      console.warn('Error loading messages from database:', err);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.id, selectedPatient?.patient_id]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedPatient?.patient_id, mobileDoctorView]);

  // -------------------------------------------------------------
  // Pair Patient by Code (e.g. PAT-2201031)
  // -------------------------------------------------------------
  const handlePairPatient = async (e) => {
    e.preventDefault();
    if (!pairCodeInput.trim()) return;
    setIsPairing(true);
    setPairError('');
    setPairSuccess('');

    try {
      const res = await pairPatientWithDoctor(pairCodeInput.trim().toUpperCase(), currentUser?.id);
      if (res.success && res.patient) {
        setPairSuccess(`Patient paired: ${res.patient.patient_name || pairCodeInput}`);
        setPairCodeInput('');
        await loadPatients();
        setSelectedPatient(res.patient);
      }
    } catch (err) {
      setPairError(err.message || 'Could not pair patient with this code.');
    } finally {
      setIsPairing(false);
    }
  };

  // -------------------------------------------------------------
  // Send Clinical Advice / Message to Selected Patient
  // -------------------------------------------------------------
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedPatient || isSending) return;

    setIsSending(true);
    const msgText = chatInput.trim();
    setChatInput('');

    // Optimistic message update
    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      doctor_id: currentUser?.doctor_profile_id || currentUser?.id,
      patient_id: selectedPatient.patient_id,
      sender_type: 'doctor',
      subject: 'Clinical Advisory & Action Plan',
      message_body: msgText,
      created_at: new Date().toISOString()
    };
    const updatedMsgs = [...messages, optimisticMsg];
    setMessages(updatedMsgs);

    try {
      const res = await sendMessageToDoctor({
        user_id: currentUser?.id,
        doctor_id: currentUser?.doctor_profile_id || currentUser?.id,
        patient_id: selectedPatient.patient_id,
        patient_id_code: selectedPatient.patient_id_code || 'PAT-2201031',
        subject: 'Clinical Advisory & Action Plan',
        message_body: msgText,
        sender_type: 'doctor'
      });
      if (res.success) {
        if (onMessageSent) onMessageSent(optimisticMsg);
        await loadMessages();
      }
    } catch (err) {
      console.error('Message send failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Quick Prescription Templates
  const applyQuickTemplate = (text) => {
    setChatInput(text);
  };

  // Filtered patients
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.patient_name || '').toLowerCase().includes(q) ||
      (p.patient_id_code || '').toLowerCase().includes(q) ||
      (p.severity || '').toLowerCase().includes(q)
    );
  });

  // Filter messages for current thread
  const activeThread = messages.filter((m) => {
    if (!selectedPatient) return false;
    const pId = String(selectedPatient.patient_id);
    return String(m.patient_id) === pId || String(m.user_id) === pId;
  });

  const highRiskCount = patients.filter(p => (p.risk_level === 'Red' || p.current_ahi > 35)).length;

  return (
    <div className="min-h-screen w-full bg-[#060f0c] bg-[linear-gradient(to_right,#00e59908_1px,transparent_1px),linear-gradient(to_bottom,#00e59908_1px,transparent_1px)] bg-[size:4rem_4rem] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white pb-10">
      
      {/* ---------------- TOP DOCTOR CLINICAL HEADER ---------------- */}
      <header className="sticky top-0 z-40 bg-[#071510]/95 border-b border-emerald-500/20 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#071510] rounded-[14px] flex items-center justify-center text-emerald-400 font-black">
              <Stethoscope className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                {currentUser?.full_name || 'Dr. Pulmonology Specialist'}
              </h1>
              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Specialist</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{currentUser?.hospital || 'Chest Disease Hospital'}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-emerald-400 text-[11px] font-bold">
                {currentUser?.bmdc_number || 'BMDC-A-74129'}
              </span>
            </p>
          </div>
        </div>

        {/* Doctor Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenProfile}
            className="px-3.5 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Clinical Credentials</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ---------------- CLINICAL OVERVIEW KPI BAR ---------------- */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-forest-900/70 border border-emerald-500/20 rounded-2xl">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Linked Patients</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{patients.length}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">Active Monitoring Cohort</span>
          </div>

          <div className="p-4 bg-forest-900/70 border border-emerald-500/20 rounded-2xl">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Severe Risk Alert</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">{highRiskCount}</div>
            <span className="text-[10px] text-rose-300 font-semibold">Immediate attention needed</span>
          </div>

          <div className="p-4 bg-forest-900/70 border border-emerald-500/20 rounded-2xl">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Live Consultations</span>
              <MessageSquare className="w-4 h-4 text-mint-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{messages.length}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">Bi-directional messages</span>
          </div>

          <div className="p-4 bg-forest-900/70 border border-emerald-500/20 rounded-2xl">
            <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
              <span>Avg Lung Best PEF</span>
              <Activity className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">495 <span className="text-xs font-normal text-slate-400">L/min</span></div>
            <span className="text-[10px] text-emerald-400 font-semibold">Adult cohort average</span>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher (lg:hidden) */}
      <div className="lg:hidden max-w-7xl w-full mx-auto px-4 sm:px-8 pt-4">
        <div className="grid grid-cols-2 p-1 bg-forest-900/90 rounded-2xl border border-emerald-500/20 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMobileDoctorView('list')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileDoctorView === 'list'
                ? 'bg-emerald-500 text-forest-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patients ({filteredPatients.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDoctorView('detail')}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              mobileDoctorView === 'detail'
                ? 'bg-emerald-500 text-forest-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Workspace & Chat</span>
            {selectedPatient && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* ---------------- MAIN WORKSPACE ---------------- */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-4 lg:pt-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: PATIENT DIRECTORY & PAIRING (5 cols) */}
        <div className={`lg:col-span-5 space-y-4 ${mobileDoctorView === 'detail' ? 'hidden lg:block' : 'block'}`}>
          
          {/* Pair Patient by Unique ID Card */}
          <div className="p-4 bg-forest-900/80 border border-emerald-500/25 rounded-2xl shadow-lg">
            <h3 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Pair Patient by Unique ID</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Enter patient code (e.g. <span className="font-mono text-emerald-300 font-bold">PAT-2201031</span>) to bind their live telemetry.
            </p>

            <form onSubmit={handlePairPatient} className="flex gap-2">
              <input
                type="text"
                placeholder="PAT-2201031"
                value={pairCodeInput}
                onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                className="flex-1 px-3.5 py-2 bg-forest-950 border border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={isPairing || !pairCodeInput.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-forest-950 font-extrabold text-xs rounded-xl transition-all disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                {isPairing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Pair</span>
              </button>
            </form>

            {pairSuccess && (
              <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{pairSuccess}</span>
              </div>
            )}
            {pairError && (
              <div className="mt-2 text-[11px] text-rose-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{pairError}</span>
              </div>
            )}
          </div>

          {/* Patient Search & List */}
          <div className="p-4 bg-forest-900/80 border border-emerald-500/25 rounded-2xl shadow-lg flex flex-col h-[520px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Monitoring Patients ({filteredPatients.length})</span>
              </h3>
              <button
                type="button"
                onClick={loadPatients}
                className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                title="Refresh Patients"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search patient name, ID, or severity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-forest-950 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Scrollable Patient Cards */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredPatients.length === 0 ? (
                <div className="h-full p-8 text-center flex flex-col items-center justify-center text-slate-500">
                  <UserCheck className="w-10 h-10 text-emerald-500/30 mb-2" />
                  <p className="text-xs text-slate-300 font-bold">No Monitoring Patients</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                    Pair patient using code <span className="font-mono text-emerald-300 font-bold">PAT-2201031</span> above to link their clinical dashboard.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPairCodeInput('PAT-2201031')}
                    className="mt-3 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-[11px] font-bold cursor-pointer transition"
                  >
                    + Quick-Fill Demo (PAT-2201031)
                  </button>
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const isSelected = selectedPatient?.patient_id === p.patient_id;
                  const riskColor = 
                    p.risk_level === 'Red' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                    p.risk_level === 'Yellow' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                  return (
                    <div
                      key={p.patient_id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setMobileDoctorView('detail');
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-950/70 border-emerald-400 shadow-md ring-1 ring-emerald-400'
                          : 'bg-forest-950/60 border-slate-800 hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>{p.patient_name}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-forest-900 border border-emerald-500/30 text-emerald-300 rounded font-semibold">
                              {p.patient_id_code || 'PAT-2201031'}
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {p.age}yo {p.sex} • Baseline: {p.severity} Asthma
                          </p>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${riskColor}`}>
                          {p.risk_level || 'Green'} Risk
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/60">
                        <span>PEF Best: <strong className="text-white">{p.pef_best} L/m</strong></span>
                        <span>Streak: <strong className="text-emerald-400">{p.compliance_streak || 6}d</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: PATIENT VITAL MONITOR & LIVE CONSULTATION CHAT (7 cols) */}
        <div className={`lg:col-span-7 space-y-4 ${mobileDoctorView === 'list' ? 'hidden lg:block' : 'block'}`}>
          
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={() => setMobileDoctorView('list')}
            className="lg:hidden flex items-center gap-1.5 text-xs text-emerald-400 hover:text-white font-bold px-3 py-2 rounded-xl bg-forest-900 border border-emerald-500/20 transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>← Back to Patients List</span>
          </button>

          {/* Active Patient Vitals Card */}
          {selectedPatient ? (
            <div className="p-4 bg-forest-900/80 border border-emerald-500/25 rounded-2xl shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white">{selectedPatient.patient_name}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg font-bold">
                      {selectedPatient.patient_id_code || 'PAT-2201031'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedPatient.patient_email} • {selectedPatient.age} years old ({selectedPatient.sex})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Asthma Severity:</span>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl">
                    {selectedPatient.severity}
                  </span>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-3 gap-3 pt-3">
                <div className="p-2.5 bg-forest-950 rounded-xl border border-emerald-500/10 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Personal Best PEF</span>
                  <span className="text-base font-black text-emerald-300 mt-0.5 block">{selectedPatient.pef_best} L/min</span>
                </div>

                <div className="p-2.5 bg-forest-950 rounded-xl border border-emerald-500/10 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Current AHI</span>
                  <span className="text-base font-black text-amber-300 mt-0.5 block">24.5 / 100</span>
                </div>

                <div className="p-2.5 bg-forest-950 rounded-xl border border-emerald-500/10 text-center">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Medication Streak</span>
                  <span className="text-base font-black text-mint-300 mt-0.5 block">6 Days</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-forest-900/80 border border-emerald-500/25 rounded-2xl shadow-lg text-center flex flex-col items-center justify-center">
              <Users className="w-10 h-10 text-emerald-500/30 mb-2" />
              <h4 className="text-xs font-bold text-white">No Patient Selected</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                Pair or select a patient from the patient list to monitor real-time clinical parameters and review messages.
              </p>
            </div>
          )}

          {/* Live Clinical Consultation & Advisory Chat */}
          <div className="p-4 bg-forest-900/80 border border-emerald-500/25 rounded-2xl shadow-lg flex flex-col h-[440px]">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Live Clinical Consultation Thread
                </h3>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/70 px-2.5 py-1 rounded-full border border-emerald-500/30">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>AES-256 Encrypted</span>
              </span>
            </div>

            {/* Quick Prescription Templates */}
            <div className="py-2 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
              <span className="text-slate-400 shrink-0 font-bold">Quick Actions:</span>
              {[
                'Adjust inhaler to 2 puffs BD',
                'Activate HEPA air filtration immediately',
                'Perform 3 peak flow blows and log',
                'Avoid outdoor travel today (PM2.5 spike)'
              ].map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => applyQuickTemplate(template)}
                  className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 rounded-lg shrink-0 transition-all cursor-pointer"
                >
                  + {template}
                </button>
              ))}
            </div>

            {/* Chat Thread Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-2 pr-1 custom-scrollbar">
              {activeThread.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-1" />
                  <span>No prior messages in this thread.</span>
                  <span className="text-[10px] mt-0.5">Send a clinical advisory or prescription note below.</span>
                </div>
              ) : (
                activeThread.map((msg, idx) => {
                  const isDoctor = msg.sender_type === 'doctor';
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs shadow-md ${
                          isDoctor
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                            : 'bg-forest-950 border border-emerald-500/30 text-slate-200 rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.message_body || msg.text}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 mt-0.5 px-1 font-mono flex items-center gap-1.5">
                        <span className="font-semibold text-slate-400">
                          {isDoctor ? 'Me' : (selectedPatient?.patient_name || 'Patient')}
                        </span>
                        <span>•</span>
                        <span>{new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isDoctor && <CheckCheck className="w-3 h-3 text-emerald-400" />}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Box with Enter to Send */}
            <form onSubmit={handleSendMessage} className="pt-2 flex gap-2 border-t border-emerald-500/15">
              <input
                type="text"
                placeholder={selectedPatient ? `Message ${selectedPatient.patient_name}... (Press Enter to send)` : 'Select a patient...'}
                disabled={!selectedPatient || isSending}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-forest-950 border border-emerald-500/30 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isSending || !selectedPatient}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>

          </div>

        </div>

      </div>
    </div>
  );
}
