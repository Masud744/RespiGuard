import React, { useState } from 'react';
import { 
  Stethoscope, Send, CheckCircle2, AlertCircle, 
  Clock, HeartPulse, ShieldCheck, ArrowRight, User, Mail, Tag
} from 'lucide-react';
import { simulateDoctorReply } from '../api';

export default function DoctorReplyPortal() {
  const params = new URLSearchParams(window.location.search);
  const doctorId = params.get('doc_id') || '';
  const userId = params.get('uid') || '';
  const patientIdCode = params.get('pid') || 'PAT-001';
  const patientName = params.get('pname') || 'Patient';
  const doctorNameParam = params.get('dname') || 'Doctor';
  const originalSubject = params.get('subj') || 'Health Advisory';
  const originalMsg = params.get('msg') || 'Patient submitted a respiratory inquiry.';

  const [doctorName, setDoctorName] = useState(doctorNameParam);
  const [replySubject, setReplySubject] = useState(`Re: [Patient ID: ${patientIdCode}] ${originalSubject}`);
  const [replyBody, setReplyBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) {
      setErrorMsg('Please write your clinical advice or instructions.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        user_id: userId,
        doctor_id: doctorId,
        patient_id_code: patientIdCode,
        subject: replySubject,
        message_body: replyBody
      };

      const res = await simulateDoctorReply(payload);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setErrorMsg(res.error || 'Failed to submit advice.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit advice to patient.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060f0c] text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#00e599]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl bg-forest-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl animate-fadeIn">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
            <span>RespiGuard Clinical Response Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Send Medical Advice to Patient
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            Your response will be delivered directly to the patient's mobile monitoring dashboard in real-time.
          </p>
        </div>

        {/* Success Screen */}
        {isSuccess ? (
          <div className="p-8 rounded-3xl bg-forest-950/90 border border-emerald-500/40 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Advice Delivered Successfully!</h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed mb-6">
              Your clinical guidance has been securely transmitted to <strong>{patientName}</strong> (Patient ID: <span className="font-mono text-emerald-400 font-bold">{patientIdCode}</span>). The patient's dashboard now reflects this update.
            </p>
            <div className="p-4 rounded-2xl bg-forest-900/80 border border-emerald-500/20 text-left text-xs space-y-1.5">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Submitted Advice:</span>
              <p className="text-slate-200 whitespace-pre-wrap font-medium">{replyBody}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Patient Context Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-forest-950/80 border border-emerald-500/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Patient: {patientName}</span>
                  <span className="text-[10px] font-mono font-extrabold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                    ID: {patientIdCode}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Live Consultation Link
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Patient's Inquiry:</span>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed italic bg-forest-900/50 p-3 rounded-xl border border-slate-800">
                  "{originalMsg}"
                </p>
              </div>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-500/40 rounded-xl flex items-center gap-2 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Doctor Reply Inputs */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Doctor Name / Title</label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                required
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Clinical Advice & Inhaler Adjustment Instructions <span className="text-emerald-400">*</span>
              </label>
              <textarea
                required
                rows={5}
                placeholder="e.g. Hello Shihab, I reviewed your telemetry spike. Please take 2 puffs of your Salbutamol inhaler immediately and keep indoor windows closed until PM2.5 drops below 20..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Advice to Patient Dashboard</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
