import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Send, Mail, Trash2, ShieldCheck, Stethoscope, 
  Clock, AlertCircle, CheckCircle2, X, MessageSquare, ArrowRight,
  Sparkles, RefreshCw, Building, Tag, Check, ExternalLink
} from 'lucide-react';
import { 
  fetchDoctors, addDoctor, deleteDoctor, 
  sendMessageToDoctor, fetchMessages 
} from '../api';

export default function MessagesPage({ currentUser }) {
  const [doctors, setDoctors] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Modals
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Form States
  const [doctorForm, setDoctorForm] = useState({
    doctor_name: '',
    doctor_email: '',
    patient_id_code: '',
    specialty: 'Pulmonologist',
    hospital: 'Respiratory Care Clinic'
  });

  const [messageForm, setMessageForm] = useState({
    doctor_id: '',
    subject: '',
    message_body: ''
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [statusAlert, setStatusAlert] = useState(null); // { type: 'success' | 'error', text: '' }

  // Load Doctors and Messages
  const loadData = async (showLoading = true) => {
    if (!currentUser?.id) return;
    if (showLoading) setIsLoading(true);
    try {
      const [docs, msgs] = await Promise.all([
        fetchDoctors(currentUser.id),
        fetchMessages(currentUser.id, selectedDoctorId === 'all' ? null : selectedDoctorId)
      ]);
      setDoctors(docs);
      setMessages(msgs);

      if (docs.length > 0 && !messageForm.doctor_id) {
        setMessageForm((prev) => ({ ...prev, doctor_id: docs[0].id }));
      }
    } catch (err) {
      console.error('Error loading messaging data:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, [currentUser, selectedDoctorId]);

  // Live Auto-Refresh (every 4.5 seconds) to catch incoming doctor replies automatically
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 4500);
    return () => clearInterval(interval);
  }, [currentUser, selectedDoctorId]);

  // Manual Sync Button
  const handleManualSync = async () => {
    setIsSyncing(true);
    await loadData(false);
    setTimeout(() => setIsSyncing(false), 600);
  };

  // Handle Copy Patient ID
  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 1. Add Doctor Submission
  const handleAddDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!doctorForm.doctor_name || !doctorForm.doctor_email || !doctorForm.patient_id_code) {
      setStatusAlert({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        user_id: currentUser.id,
        ...doctorForm
      };
      const res = await addDoctor(payload);
      if (res.success) {
        setStatusAlert({ type: 'success', text: `Doctor ${doctorForm.doctor_name} added successfully!` });
        setIsAddDoctorOpen(false);
        setDoctorForm({
          doctor_name: '',
          doctor_email: '',
          patient_id_code: '',
          specialty: 'Pulmonologist',
          hospital: 'Respiratory Care Clinic'
        });
        loadData(true);
      }
    } catch (err) {
      setStatusAlert({ type: 'error', text: err.message || 'Failed to add doctor.' });
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Remove Doctor
  const handleDeleteDoctor = async (doctorId, doctorName) => {
    if (!window.confirm(`Are you sure you want to remove ${doctorName}?`)) return;
    try {
      await deleteDoctor(doctorId, currentUser.id);
      setStatusAlert({ type: 'success', text: `Removed ${doctorName} from your doctors.` });
      loadData(true);
    } catch (err) {
      setStatusAlert({ type: 'error', text: 'Failed to remove doctor.' });
    }
  };

  // 3. Send Message to Doctor
  const handleSendMessageSubmit = async (e) => {
    e.preventDefault();
    if (!messageForm.doctor_id || !messageForm.subject || !messageForm.message_body) {
      setStatusAlert({ type: 'error', text: 'Please fill in all message fields.' });
      return;
    }

    const selectedDoc = doctors.find((d) => d.id === messageForm.doctor_id);
    if (!selectedDoc) return;

    setActionLoading(true);
    try {
      const payload = {
        user_id: currentUser.id,
        doctor_id: messageForm.doctor_id,
        patient_id_code: selectedDoc.patient_id_code,
        subject: messageForm.subject,
        message_body: messageForm.message_body
      };

      const res = await sendMessageToDoctor(payload);
      if (res.success) {
        setStatusAlert({ 
          type: 'success', 
          text: `Message dispatched to ${selectedDoc.doctor_name} (${selectedDoc.doctor_email}) with Patient ID [${selectedDoc.patient_id_code}]!` 
        });
        setIsComposeOpen(false);
        setMessageForm({ doctor_id: doctors[0]?.id || '', subject: '', message_body: '' });
        loadData(true);
      }
    } catch (err) {
      setStatusAlert({ type: 'error', text: err.message || 'Failed to send message.' });
    } finally {
      setActionLoading(false);
    }
  };

  const activeDocForCompose = doctors.find((d) => d.id === messageForm.doctor_id);

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      
      {/* Top Banner & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              Doctor Email & Advisory Channel
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Messages & Consultations
          </h2>
          <p className="text-emerald-100/75 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Communicate directly with your pulmonologists. Outgoing emails include your unique Patient ID, and incoming doctor replies automatically appear in this inbox.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualSync}
            title="Check for new doctor replies"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-forest-950/80 hover:bg-forest-900 text-slate-300 hover:text-white border border-emerald-500/20 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Checking...' : 'Check Replies'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setIsAddDoctorOpen(true); setStatusAlert(null); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-forest-900/90 hover:bg-forest-900 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Doctor's Info</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (doctors.length === 0) {
                setStatusAlert({ type: 'error', text: 'Please add a doctor before composing a message.' });
                setIsAddDoctorOpen(true);
                return;
              }
              setIsComposeOpen(true);
              setStatusAlert(null);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Message Doctor</span>
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusAlert && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-medium animate-fadeIn ${
          statusAlert.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' 
            : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusAlert.text}</span>
          </div>
          <button 
            onClick={() => setStatusAlert(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ==================================================================== */}
        {/* LEFT COLUMN: REGISTERED DOCTORS DIRECTORY (5 cols) */}
        {/* ==================================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">My Registered Doctors</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {doctors.length} Doctor{doctors.length !== 1 ? 's' : ''}
            </span>
          </div>

          {doctors.length === 0 ? (
            <div className="p-7 rounded-3xl bg-forest-900/40 border border-emerald-500/15 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-white">No Doctors Registered Yet</h4>
              <p className="text-[11px] text-slate-400 mt-1 mb-4 max-w-xs leading-relaxed">
                Add your doctor's name, email, and designated Patient ID so you can send them direct email updates.
              </p>
              <button
                type="button"
                onClick={() => setIsAddDoctorOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Doctor's Info</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.map((doc) => (
                <div 
                  key={doc.id}
                  className="p-4 rounded-2xl bg-forest-900/70 border border-emerald-500/20 hover:border-emerald-500/40 transition-all shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-mint-400 text-forest-950 font-bold text-xs flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                        {doc.doctor_name?.replace('Dr. ', '')?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">{doc.doctor_name}</h4>
                        <span className="text-[10px] text-emerald-300 font-medium block">{doc.specialty}</span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{doc.doctor_email}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteDoctor(doc.id, doc.doctor_name)}
                      title="Remove Doctor"
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition opacity-60 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Doctor-Assigned Patient ID Badge */}
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Assigned Patient ID:</span>
                      <span className="text-[11px] font-mono font-extrabold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                        {doc.patient_id_code}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(doc.patient_id_code)}
                      className="text-[10px] text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedCode === doc.patient_id_code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Tag className="w-3 h-3" />
                          <span>Copy ID</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Direct Action Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setMessageForm({ doctor_id: doc.id, subject: '', message_body: '' });
                      setIsComposeOpen(true);
                    }}
                    className="w-full mt-3 py-1.5 rounded-xl bg-forest-950 hover:bg-forest-800 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Message {doc.doctor_name}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* RIGHT COLUMN: CONVERSATION THREADS & INBOX (7 cols) */}
        {/* ==================================================================== */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Communication Thread</h3>
            </div>

            {/* Filter by Doctor */}
            {doctors.length > 0 && (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-3 py-1 bg-forest-900 border border-emerald-500/20 rounded-xl text-[11px] text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                <option value="all">All Doctors ({messages.length})</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.doctor_name}</option>
                ))}
              </select>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="p-10 rounded-3xl bg-forest-900/40 border border-emerald-500/15 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Mail className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-white">No Messages in Thread</h4>
              <p className="text-[11px] text-slate-400 mt-1 mb-4 max-w-sm leading-relaxed">
                When you message your doctor, your email will be delivered with your Patient ID at the top. Any doctor replies from Gmail will appear here automatically.
              </p>
              {doctors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-mint-500 text-forest-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send First Message</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {messages.map((msg) => {
                const isPatient = msg.sender_type === 'patient';
                const docName = msg.patient_doctors?.doctor_name || 'Doctor';
                const formattedTime = new Date(msg.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={msg.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isPatient
                        ? 'bg-forest-950/80 border-emerald-500/20 ml-0 md:ml-6'
                        : 'bg-emerald-950/30 border-emerald-500/35 mr-0 md:mr-6 shadow-md shadow-emerald-950/50'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md border ${
                          isPatient 
                            ? 'bg-forest-800 text-slate-300 border-slate-700' 
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isPatient ? 'You (Sent)' : `${docName} (Doctor Reply)`}
                        </span>

                        {/* Patient ID Tag */}
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          ID: {msg.patient_id_code}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formattedTime}
                      </span>
                    </div>

                    {/* Subject */}
                    <h5 className="text-xs font-bold text-white mb-1">
                      {msg.subject}
                    </h5>

                    {/* Body */}
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-normal">
                      {msg.message_body}
                    </p>

                    {/* Footer Status */}
                    <div className="mt-3 pt-2 border-t border-emerald-500/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        {isPatient ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Delivered to {docName}'s Email Inbox</span>
                          </>
                        ) : (
                          <>
                            <Stethoscope className="w-3 h-3 text-emerald-400" />
                            <span>Verified Doctor Response (Received via Email)</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: ADD DOCTOR'S INFO */}
      {/* ==================================================================== */}
      {isAddDoctorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-forest-900/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100">
            <button
              onClick={() => setIsAddDoctorOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-forest-800/60 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Add Doctor's Info</h3>
                <p className="text-xs text-slate-400">Connect with your pulmonologist</p>
              </div>
            </div>

            <form onSubmit={handleAddDoctorSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Doctor's Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={doctorForm.doctor_name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, doctor_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Doctor's Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="doctor@hospital.org"
                  value={doctorForm.doctor_email}
                  onChange={(e) => setDoctorForm({ ...doctorForm, doctor_email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300">Doctor-Assigned "Patient ID" *</label>
                  <span className="text-[10px] text-emerald-400">Unique identifier</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAT-7829 or RESP-104"
                  value={doctorForm.patient_id_code}
                  onChange={(e) => setDoctorForm({ ...doctorForm, patient_id_code: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This ID will be automatically written at the top of every email sent to this doctor.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Specialty</label>
                  <input
                    type="text"
                    placeholder="Pulmonologist"
                    value={doctorForm.specialty}
                    onChange={(e) => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
                    className="w-full px-3 py-2 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Hospital / Clinic</label>
                  <input
                    type="text"
                    placeholder="General Hospital"
                    value={doctorForm.hospital}
                    onChange={(e) => setDoctorForm({ ...doctorForm, hospital: e.target.value })}
                    className="w-full px-3 py-2 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-3 py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Doctor Info'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: MESSAGE DOCTOR (COMPOSE EMAIL) */}
      {/* ==================================================================== */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-forest-900/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100">
            <button
              onClick={() => setIsComposeOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-forest-800/60 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Message Your Doctor</h3>
                <p className="text-xs text-slate-400">Direct medical email dispatch</p>
              </div>
            </div>

            <form onSubmit={handleSendMessageSubmit} className="space-y-3.5">
              {/* Select Doctor */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Select Doctor *</label>
                <select
                  value={messageForm.doctor_id}
                  onChange={(e) => setMessageForm({ ...messageForm, doctor_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.doctor_name} ({d.doctor_email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient ID Banner Preview */}
              {activeDocForCompose && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Automatic Email Header:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      [Patient ID: {activeDocForCompose.patient_id_code}]
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">Included at top of email</span>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Higher PM2.5 reading & increased night coughing"
                  value={messageForm.subject}
                  onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Message Body *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your current symptoms, sensor spike triggers, or medication questions..."
                  value={messageForm.message_body}
                  onChange={(e) => setMessageForm({ ...messageForm, message_body: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Real Email to Doctor</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
