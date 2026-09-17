import React, { useState } from 'react';
import { 
  X, Mail, Lock, User, Activity, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, HeartPulse, ChevronLeft
} from 'lucide-react';
import { signupUser, loginUser } from '../api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState(1); // 1: Account Info, 2: Clinical Onboarding
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    severity: 'Mild',
    age: 22,
    sex: 'male',
    pef_best: 520
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorMsg('');
  };

  const handleSeveritySelect = (sev) => {
    setFormData((prev) => ({ ...prev, severity: sev }));
  };

  const handleSexSelect = (s) => {
    setFormData((prev) => {
      // Dynamic suggestion for PEF based on sex/age
      const suggestedPEF = s === 'male' ? 520 : 430;
      return { ...prev, sex: s, pef_best: suggestedPEF };
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await loginUser({
        email: formData.email,
        password: formData.password
      });

      if (res.success && res.user) {
        setSuccessMsg(`Welcome back, ${res.user.full_name}!`);
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.full_name) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await signupUser(formData);
      if (res.success && res.user) {
        setSuccessMsg('Account created & clinical profile saved successfully!');
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 800);
      }
    } catch (err) {
      // Display clean duplicate warning or validation error
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-forest-900/95 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/80 overflow-hidden text-slate-100">
        
        {/* Glow background accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-mint-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-forest-800/60 hover:bg-forest-800 rounded-full transition-all border border-emerald-500/10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3 shadow-sm shadow-emerald-500/20">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {tab === 'login' ? 'Sign In to RespiGuard' : step === 1 ? 'Create Patient Account' : 'Clinical Baseline Onboarding'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {tab === 'login' 
              ? 'Access your real-time portable asthma monitoring dashboard'
              : step === 1
              ? 'Step 1 of 2: Setup your account credentials'
              : 'Step 2 of 2: Configure your asthma sensitivity profile for ML'}
          </p>
        </div>

        {/* Tabs: Sign In / Sign Up */}
        <div className="flex bg-forest-950/80 p-1 rounded-2xl border border-emerald-500/20 mb-6">
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              tab === 'login'
                ? 'bg-emerald-500 text-forest-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setStep(1); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              tab === 'signup'
                ? 'bg-emerald-500 text-forest-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up & Onboard
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-start gap-2.5 text-red-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Success Alert Box */}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center gap-2 text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW A: SIGN IN FORM */}
        {/* ==================================================================== */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* VIEW B: SIGN UP & ONBOARDING (Step 1: Account) */}
        {/* ==================================================================== */}
        {tab === 'signup' && step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="John Doe"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Clinical Onboarding</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* VIEW C: CLINICAL ONBOARDING QUESTIONNAIRE (Step 2: ML Baseline) */}
        {/* ==================================================================== */}
        {tab === 'signup' && step === 2 && (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            
            {/* 1. Asthma Severity Selection Cards */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1. Asthma Severity Level <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Mild', label: 'Mild', color: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300', desc: 'Infrequent symptoms' },
                  { id: 'Moderate', label: 'Moderate', color: 'border-amber-500/40 bg-amber-950/30 text-amber-300', desc: 'Daily / regular' },
                  { id: 'Severe', label: 'Severe', color: 'border-rose-500/40 bg-rose-950/30 text-rose-300', desc: 'Frequent flare-ups' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSeveritySelect(s.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      formData.severity === s.id
                        ? `${s.color} ring-1 ring-emerald-400 font-bold shadow-md`
                        : 'border-slate-800 bg-forest-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs block font-bold">{s.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Age & Biological Sex */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Age (Years)</label>
                <input
                  type="number"
                  name="age"
                  min={5}
                  max={100}
                  required
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Biological Sex</label>
                <div className="flex gap-2">
                  {['male', 'female'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleSexSelect(g)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border capitalize transition-all ${
                        formData.sex === g
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-forest-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Personal Best Peak Expiratory Flow (PEF) */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Personal Best PEF (L/min)</label>
                <span className="text-[10px] text-emerald-400">Target baseline</span>
              </div>
              <div className="relative">
                <Activity className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  name="pef_best"
                  min={150}
                  max={800}
                  required
                  value={formData.pef_best}
                  onChange={handleChange}
                  className="w-full pl-10 pr-16 py-2.5 bg-forest-950/80 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">L/min</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Typical healthy baseline: ~520 L/min (Male, 20-30yo), ~430 L/min (Female).
              </p>
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 bg-forest-800/80 hover:bg-forest-800 text-slate-300 text-xs font-semibold rounded-xl border border-emerald-500/10 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Onboarding & Start Monitoring</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
