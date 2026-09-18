import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, Send, Mail, Trash2, ShieldCheck, Stethoscope, 
  Clock, AlertCircle, CheckCircle2, X, MessageSquare, ArrowRight,
  Sparkles, RefreshCw, Building, Tag, Check, ExternalLink,
  Users, Activity, ChevronRight, ChevronLeft, Award, Lock, FileText,
  MapPin, Search, CheckCheck
} from 'lucide-react';
import { 
  fetchDoctors, addDoctor, deleteDoctor, 
  sendMessageToDoctor, fetchMessages,
  fetchDoctorsDirectory, connectDoctor, fetchDoctorPatients 
} from '../api';

export default function MessagesPage({ currentUser }) {
  // Mode View: 'patient' or 'doctor'
  const [activeView, setActiveView] = useState(() => {
    return currentUser?.role === 'doctor' ? 'doctor' : 'patient';
  });

  // Patient states
  const [doctors, setDoctors] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [directoryDoctors, setDirectoryDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Doctor portal states
  const [doctorPatients, setDoctorPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isPairPatientModalOpen, setIsPairPatientModalOpen] = useState(false);
  const [pairPatientCode, setPairPatientCode] = useState('');

  // Modals & Directory Filters
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');

  // Inline Quick Chat message input & mobile responsiveness
  const [quickReplyText, setQuickReplyText] = useState('');
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);
  const [mobileChatActive, setMobileChatActive] = useState(false);
  const messagesEndRef = useRef(null);

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

  // Load Data for Patient & Doctor
  const loadData = async (showLoading = true) => {
    if (!currentUser?.id) return;
    if (showLoading) setIsLoading(true);
    try {
      const [docs, msgs, directory, docPats] = await Promise.all([
        fetchDoctors(currentUser.id),
        fetchMessages(currentUser.id, selectedDoctorId === 'all' ? null : selectedDoctorId),
        fetchDoctorsDirectory(),
        fetchDoctorPatients()
      ]);

      // Strictly filter out test/dummy accounts and deduplicate paired doctors
      const sanitizedDocs = (docs || []).filter((doc, idx, arr) => {
        const name = doc.doctor_name || doc.name || '';
        const em = (doc.doctor_email || doc.email || '').toLowerCase();
        if (name.includes('Chat Specialist') || em.includes('hospital.org') || em.includes('chat.')) {
          return false;
        }
        const firstIdx = arr.findIndex(d => 
          ((d.doctor_email || d.email || '').toLowerCase() === em && em !== '') ||
          (d.id === doc.id)
        );
        return firstIdx === idx;
      });

      // Filter out test/dummy doctors from the directory
      const sanitizedDirectory = (directory || []).filter((doc) => {
        const name = doc.name || doc.doctor_name || '';
        const em = (doc.email || doc.doctor_email || '').toLowerCase();
        if (name.includes('Chat Specialist') || em.includes('hospital.org') || em.includes('chat.')) {
          return false;
        }
        return true;
      });

      setDoctors(sanitizedDocs);
      setMessages(msgs || []);
      setDirectoryDoctors(sanitizedDirectory);
      setDoctorPatients(docPats || []);

      if (sanitizedDocs.length > 0 && !messageForm.doctor_id) {
        setMessageForm((prev) => ({ ...prev, doctor_id: sanitizedDocs[0].id }));
      }
      // Auto-select first doctor for isolated chat if none selected or currently selected is invalid
      if (sanitizedDocs.length > 0 && (!selectedDoctorId || selectedDoctorId === 'all' || !sanitizedDocs.some(d => d.id === selectedDoctorId))) {
        setSelectedDoctorId(sanitizedDocs[0].id);
      }
      if (docPats && docPats.length > 0 && !selectedPatient) {
        setSelectedPatient(docPats[0]);
      }
    } catch (err) {
      console.error('Error loading messaging data:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, [currentUser, selectedDoctorId, activeView]);

  // Live Auto-Refresh (every 4 seconds) to catch live chat replies automatically
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser, selectedDoctorId, activeView]);

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

  // 1-Click Connect Verified Doctor from Directory
  const handleConnectDirectoryDoctor = async (doc) => {
    setActionLoading(true);
    try {
      const payload = {
        doctor_name: doc.name,
        doctor_email: doc.email,
        specialty: doc.specialty,
        hospital: doc.hospital,
        bmdc_number: doc.bmdc_number
      };
      const res = await connectDoctor(payload);
      if (res.success) {
        setStatusAlert({
          type: 'success',
          text: `Connected with ${doc.name} (${doc.bmdc_number} Verified). You can now exchange direct clinical consultations!`
        });
        setIsDirectoryOpen(false);
        await loadData(true);
        if (res.doctor) {
          setMessageForm({ doctor_id: res.doctor.id, subject: '', message_body: '' });
          setIsComposeOpen(true);
        }
      }
    } catch (err) {
      setStatusAlert({ type: 'error', text: err.message || 'Failed to connect with doctor.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Add Custom Doctor Submission
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

  // Remove Doctor
  const handleDeleteDoctor = async (doctorId, doctorName) => {
    if (!window.confirm(`Are you sure you want to remove ${doctorName}?`)) return;
    try {
      await deleteDoctor(doctorId, currentUser.id);
      setStatusAlert({ type: 'success', text: `Removed ${doctorName} from your doctors.` });
      if (selectedDoctorId === doctorId) setSelectedDoctorId(null);
      loadData(true);
    } catch (err) {
      setStatusAlert({ type: 'error', text: 'Failed to remove doctor.' });
    }
  };

  // Send Message via Full Compose Modal
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

  // Send Quick Inline Reply (WhatsApp-style - auto targets selected doctor)
  const handleSendQuickReply = async (e) => {
    e.preventDefault();
    if (!quickReplyText.trim()) return;

    const targetDocId = selectedDoctorId;
    if (!targetDocId) {
      setStatusAlert({ type: 'error', text: 'Please select a doctor to send a message to.' });
      return;
    }

    const targetDoc = doctors.find(d => d.id === targetDocId);
    if (!targetDoc) return;

    setIsSendingQuickReply(true);
    try {
      const payload = {
        user_id: currentUser.id,
        doctor_id: targetDoc.id,
        patient_id_code: targetDoc.patient_id_code,
        subject: `Consultation - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        message_body: quickReplyText.trim()
      };

      const res = await sendMessageToDoctor(payload);
      if (res.success) {
        setQuickReplyText('');
        loadData(false);
      }
    } catch (err) {
      setStatusAlert({ type: 'error', text: err.message || 'Failed to send reply.' });
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  // Compute last message per doctor for WhatsApp sidebar preview
  const getLastMessageForDoctor = (docId) => {
    const docMsgs = messages.filter(m => {
      const msgDocId = m.patient_doctors?.id || m.doctor_id;
      return msgDocId === docId;
    });
    if (docMsgs.length === 0) return null;
    return docMsgs[docMsgs.length - 1];
  };

  // Messages filtered for selected doctor only (isolated thread)
  const filteredMessages = selectedDoctorId 
    ? messages.filter(m => {
        const msgDocId = m.patient_doctors?.id || m.doctor_id;
        return msgDocId === selectedDoctorId;
      })
    : [];

  // Active doctor object
  const activeDoctor = doctors.find(d => d.id === selectedDoctorId);

  // Auto-scroll to bottom of chat like WhatsApp
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages.length, selectedDoctorId, mobileChatActive]);

  // Doctor search filter
  const [doctorSearch, setDoctorSearch] = useState('');

  // Doctor Portal: Send reply to patient
  const handleDoctorSendAdvisory = async (patient, advisoryText) => {
    if (!advisoryText?.trim()) return;
    try {
      const payload = {
        user_id: patient.id || currentUser.id,
        doctor_id: doctors[0]?.id || 'doc-default',
        patient_id_code: patient.patient_id_code || 'PAT-MASUD',
        subject: 'Clinical Response & Pharmacotherapy Advisory',
        message_body: advisoryText.trim(),
        sender_type: 'doctor'
      };
      await sendMessageToDoctor(payload);
      setStatusAlert({ type: 'success', text: `Clinical advice delivered to ${patient.full_name || 'Patient'}!` });
      loadData(false);
    } catch (err) {
      setStatusAlert({ type: 'error', text: err.message || 'Failed to send clinical advice.' });
    }
  };

  const LOCATIONS = ['All Locations', 'Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna'];

  const filteredDirectory = directoryDoctors.filter((doc) => {
    const docLoc = (doc.location || doc.division || '').toLowerCase();
    const isAllLoc = selectedLocation === 'All' || selectedLocation === 'All Locations';
    const matchesLocation = isAllLoc || 
      docLoc === selectedLocation.toLowerCase() ||
      (doc.hospital || '').toLowerCase().includes(selectedLocation.toLowerCase());

    const q = directorySearch.toLowerCase().trim();
    const matchesSearch = !q ||
      (doc.name || '').toLowerCase().includes(q) ||
      (doc.doctor_name || '').toLowerCase().includes(q) ||
      (doc.specialty || '').toLowerCase().includes(q) ||
      (doc.hospital || '').toLowerCase().includes(q) ||
      (doc.bmdc_number || '').toLowerCase().includes(q) ||
      docLoc.includes(q);

    return matchesLocation && matchesSearch;
  });

  const isDoctorPaired = (doc) => {
    const em = (doc.email || doc.doctor_email || '').toLowerCase();
    return doctors.some(d => 
      ((d.doctor_email || d.email || '').toLowerCase() === em && em !== '') ||
      (d.id === doc.id)
    );
  };

  const activeDocForCompose = doctors.find((d) => d.id === messageForm.doctor_id);

  return (
    <div className="space-y-6 max-w-7xl animate-fadeIn">
      
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#175242] via-[#103e32] to-[#0d2a22] border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Consultations
          </h2>
          <p className="text-emerald-100/75 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            Direct clinical messaging and advisories with respiratory specialists
          </p>
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

      {/* PATIENT CONSULTATION VIEW */}
      <div className="space-y-6">
          {/* Clean Action Bar for Patient */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 bg-forest-900/60 p-3 rounded-2xl border border-emerald-500/20">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-forest-800/80 hover:bg-forest-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDirectoryOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-forest-800/90 hover:bg-forest-700 border border-emerald-500/30 text-xs font-bold text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>Specialists Directory</span>
            </button>
          </div>

          {/* Main WhatsApp-Style Fixed-Height Section: Conversations Sidebar + Isolated Chat */}
          <div className="flex flex-col lg:flex-row rounded-3xl overflow-hidden border border-emerald-500/25 bg-forest-900/80 h-[620px] max-h-[calc(100vh-190px)] shadow-2xl">
            
            {/* LEFT: WhatsApp-Style Conversations Sidebar */}
            <div className={`w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-forest-800 flex flex-col h-full bg-forest-900/95 shrink-0 ${mobileChatActive ? 'hidden lg:flex' : 'flex'}`}>
              {/* Header & Search */}
              <div className="p-3 border-b border-forest-800 flex items-center justify-between gap-2 shrink-0">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Consultations ({doctors.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsDirectoryOpen(true)}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Award className="w-3 h-3" />
                  <span>+ Directory</span>
                </button>
              </div>

              <div className="p-2.5 border-b border-forest-800/60 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search doctor or specialty..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-full bg-forest-950 border border-emerald-500/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Top Banner: Currently Active Specialist */}
              {activeDoctor && (
                <div className="p-3 bg-emerald-950/40 border-b border-emerald-500/20 shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-extrabold flex items-center gap-1 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>In Active Consultation</span>
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-forest-950 font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                      {activeDoctor.doctor_name?.replace('Dr. ', '')?.charAt(0) || 'D'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <h4 className="text-xs font-extrabold text-white truncate">{activeDoctor.doctor_name}</h4>
                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      </div>
                      <p className="text-[10px] text-emerald-300/90 truncate">{activeDoctor.specialty}</p>
                      <p className="text-[9px] text-slate-400 truncate">{activeDoctor.hospital || 'Dhaka Medical College'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversations List */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {doctors.length === 0 ? (
                  <div className="p-6 text-center flex flex-col items-center justify-center h-full">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
                      <Award className="w-6 h-6" />
                    </div>
                    <h4 className="text-xs font-bold text-white">No Connected Doctors</h4>
                    <p className="text-[11px] text-slate-400 mt-1 mb-4 max-w-xs leading-relaxed">
                      Connect with a BMDC-verified specialist from the directory.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDirectoryOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-forest-950 rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Browse Directory</span>
                    </button>
                  </div>
                ) : (
                  (() => {
                    const displayDoctors = doctors
                      .filter((d, idx, arr) => {
                        const name = d.doctor_name || d.name || '';
                        const em = (d.doctor_email || d.email || '').toLowerCase();
                        if (name.includes('Chat Specialist') || em.includes('hospital.org') || em.includes('chat.')) return false;
                        const firstIdx = arr.findIndex(x => 
                          ((x.doctor_email || x.email || '').toLowerCase() === em && em !== '') ||
                          (x.id === d.id)
                        );
                        return firstIdx === idx;
                      })
                      .filter(d => 
                        !doctorSearch || 
                        (d.doctor_name || '').toLowerCase().includes(doctorSearch.toLowerCase()) || 
                        (d.specialty || '').toLowerCase().includes(doctorSearch.toLowerCase()) ||
                        (d.hospital || '').toLowerCase().includes(doctorSearch.toLowerCase())
                      );

                    if (displayDoctors.length === 0) {
                      return (
                        <div className="p-6 text-center text-slate-500 text-xs">
                          <p>No conversations found</p>
                          <p className="text-[10px] text-slate-600 mt-1">Try another search keyword</p>
                        </div>
                      );
                    }

                    return displayDoctors.map((doc) => {
                      const isSelected = selectedDoctorId === doc.id;
                      const lastMsg = getLastMessageForDoctor(doc.id);
                      const lastMsgSnippet = lastMsg?.message_body?.substring(0, 45) || 'No messages yet';
                      const lastMsgTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            setSelectedDoctorId(doc.id);
                            setMobileChatActive(true);
                          }}
                          className={`px-3.5 py-3 border-b border-forest-800/60 transition-all cursor-pointer flex items-start gap-2.5 ${
                            isSelected ? 'bg-emerald-950/60 border-l-2 border-l-emerald-400' : 'hover:bg-forest-800/40'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-forest-950 font-bold text-xs flex items-center justify-center shadow-md shrink-0">
                            {doc.doctor_name?.replace('Dr. ', '')?.charAt(0) || 'D'}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">{doc.doctor_name}</h4>
                                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              </div>
                              <span className="text-[9px] font-mono text-slate-500 shrink-0">{lastMsgTime}</span>
                            </div>
                            <span className="text-[10px] text-emerald-300/80 block truncate">{doc.specialty}</span>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {lastMsg?.sender_type === 'patient' ? 'Me: ' : ''}{lastMsgSnippet}{lastMsg?.message_body?.length > 45 ? '...' : ''}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* RIGHT: Isolated 1-on-1 Chat Pane */}
            <div className={`flex-1 min-w-0 flex flex-col h-full bg-forest-950/60 ${!mobileChatActive ? 'hidden lg:flex' : 'flex'}`}>
              {activeDoctor ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-forest-800 bg-forest-900/90 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {/* Mobile Back Button */}
                      <button
                        type="button"
                        onClick={() => setMobileChatActive(false)}
                        className="lg:hidden p-1.5 -ml-1 text-emerald-400 hover:text-white rounded-xl hover:bg-forest-800 transition flex items-center gap-0.5 cursor-pointer"
                        title="Back to conversations"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-xs font-bold">Chats</span>
                      </button>

                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-forest-950 font-bold text-xs flex items-center justify-center shadow-md shrink-0">
                        {activeDoctor.doctor_name?.replace('Dr. ', '')?.charAt(0) || 'D'}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white">{activeDoctor.doctor_name}</h4>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{activeDoctor.specialty}</span>
                          <span>•</span>
                          <span>{activeDoctor.hospital || 'Dhaka Medical College Hospital'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                        <Lock className="w-2.5 h-2.5" />
                        <span>AES-256 Encrypted</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteDoctor(activeDoctor.id, activeDoctor.doctor_name); }}
                        title="Remove Doctor"
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Messages Stream (Fixed-Height & Internal Scrolling) */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar scroll-smooth">
                    {filteredMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                          <Mail className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-white">No Messages Yet</h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                          Start your private consultation with {activeDoctor.doctor_name} below.
                        </p>
                      </div>
                    ) : (
                      filteredMessages.map((msg) => {
                        const isMe = (currentUser?.role === 'doctor') 
                          ? (msg.sender_type === 'doctor') 
                          : (msg.sender_type === 'patient');
                        const formattedTime = new Date(msg.created_at).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        });

                        return (
                          <div
                            key={msg.id}
                            className={`max-w-[85%] sm:max-w-[75%] ${isMe ? 'ml-auto' : 'mr-auto'}`}
                          >
                            <div className={`p-3.5 rounded-2xl text-xs shadow-md ${isMe
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs'
                              : 'bg-forest-800/90 border border-forest-700/80 text-slate-100 rounded-tl-xs'
                            }`}>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.message_body}</p>
                            </div>
                            <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="font-semibold text-slate-300">
                                {isMe ? 'Me' : (activeDoctor.doctor_name || 'Doctor')}
                              </span>
                              <span className="font-mono text-[9px] text-slate-500">{formattedTime}</span>
                              {isMe && (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {/* Auto-scroll anchor */}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* WhatsApp-Style Bottom Input (Pinned at Bottom) */}
                  <form onSubmit={handleSendQuickReply} className="p-3 border-t border-forest-800 flex items-center gap-2 bg-forest-900/90 backdrop-blur-md shrink-0">
                    <input
                      type="text"
                      placeholder={`Message ${activeDoctor.doctor_name}... (Press Enter to send)`}
                      value={quickReplyText}
                      onChange={(e) => setQuickReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendQuickReply(e);
                        }
                      }}
                      className="flex-1 bg-forest-950 border border-emerald-500/25 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSendingQuickReply || !quickReplyText.trim()}
                      className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-forest-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer transition"
                    >
                      {isSendingQuickReply ? (
                        <span className="w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Select a Conversation</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Choose a doctor from the sidebar to view your private consultation thread.
                  </p>
                </div>
              )}
            </div>

          </div>
      </div>


      {/* ==================================================================== */}
      {/* MODAL: VERIFIED DOCTORS DIRECTORY (1-CLICK CONNECT) */}
      {/* ==================================================================== */}
      {isDirectoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-forest-900/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsDirectoryOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-forest-800/60 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Verified Specialists Directory</h3>
                <p className="text-xs text-slate-400">Bangladesh Medical & Dental Council (BMDC) Accredited Pulmonologists</p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by doctor name, hospital, specialty, or location..."
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-forest-950/90 border border-emerald-500/25 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>

            {/* Location Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 custom-scrollbar">
              {LOCATIONS.map((loc) => {
                const isSelected = selectedLocation === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setSelectedLocation(loc)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-forest-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'bg-forest-950/80 text-slate-300 hover:text-white hover:bg-forest-800 border border-emerald-500/20'
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>

            {/* Doctors List */}
            <div className="space-y-3.5 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredDirectory.length === 0 ? (
                <div className="p-8 text-center bg-forest-950/60 rounded-2xl border border-emerald-500/15">
                  <Award className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-bold">No Specialists Found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try searching with a different keyword or select "All Locations".</p>
                </div>
              ) : (
                filteredDirectory.map((doc) => {
                  const alreadyPaired = isDoctorPaired(doc);
                  return (
                    <div 
                      key={doc.id}
                      className="p-4 sm:p-5 rounded-2xl bg-forest-950/80 border border-emerald-500/20 hover:border-emerald-500/40 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{doc.name || doc.doctor_name}</h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            {doc.bmdc_number || doc.bmdc_reg_no || 'BMDC-A-74129'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-forest-900 border border-emerald-500/20 text-emerald-400 flex items-center gap-1 font-semibold">
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            {doc.location || doc.division || 'Dhaka'}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-300">{doc.specialty}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{doc.hospital}</span>
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span>Experience: <strong className="text-white">{doc.experience || '12+ Years'}</strong></span>
                          <span>Rating: <strong className="text-amber-300">★ {doc.rating || '4.9'}</strong></span>
                        </div>
                      </div>

                      {alreadyPaired ? (
                        <button
                          type="button"
                          onClick={() => {
                            const paired = doctors.find(d => 
                              ((d.doctor_email || d.email || '').toLowerCase() === (doc.email || doc.doctor_email || '').toLowerCase()) ||
                              (d.id === doc.id)
                            );
                            if (paired) setSelectedDoctorId(paired.id);
                            setIsDirectoryOpen(false);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Open Chat</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleConnectDirectoryDoctor(doc)}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00e599] text-forest-950 font-bold text-xs shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-emerald-300 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          <Check className="w-4 h-4" />
                          <span>Connect & Consult</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL: COMPOSE FULL CONSULTATION MESSAGE */}
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
                <p className="text-xs text-slate-400">Direct clinical consultation dispatch</p>
              </div>
            </div>

            <form onSubmit={handleSendMessageSubmit} className="space-y-3.5">
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

              {activeDocForCompose && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Automatic Header:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      [Patient ID: {activeDocForCompose.patient_id_code}]
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">Included at top</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Higher PM2.5 spike & increased nocturnal coughing"
                  value={messageForm.subject}
                  onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

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
                className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-500 to-[#00e599] text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Message to Doctor</span>
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
