import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, User, Activity, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, ChevronLeft,
  Wind, KeyRound, RefreshCw, Send, Sparkles
} from 'lucide-react';
import { signupUser, loginUser, sendOtp, verifyOtp } from '../api';

export default function AuthPage({ onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP Verification, 3: Clinical Onboarding
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

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState('');

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

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
      const suggestedPEF = s === 'male' ? 520 : 430;
      return { ...prev, sex: s, pef_best: suggestedPEF };
    });
  };

  // -------------------------------------------------------------
  // Sign In Handler
  // -------------------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await loginUser({
        email: formData.email,
        password: formData.password
      });

      if (res.success && res.user) {
        setSuccessMsg(`Welcome back, ${res.user.full_name}! Launching dashboard...`);
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 1: Send OTP
  // -------------------------------------------------------------
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.full_name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendOtp(formData.email.trim(), formData.full_name.trim());
      if (res.success) {
        setSuccessMsg(`Verification code sent to ${formData.email}`);
        if (res.dev_otp) {
          setDevOtpHint(res.dev_otp);
        }
        setStep(2);
        setResendTimer(60);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 2: Verify OTP
  // -------------------------------------------------------------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanOtp = otpInput.trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOtp(formData.email.trim(), cleanOtp);
      if (res.success) {
        setIsOtpVerified(true);
        setSuccessMsg('Email verified successfully! Proceeding to clinical onboarding...');
        setTimeout(() => {
          setSuccessMsg('');
          setStep(3);
        }, 800);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || isLoading) return;
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await sendOtp(formData.email.trim(), formData.full_name.trim());
      if (res.success) {
        setSuccessMsg(`New verification code sent to ${formData.email}`);
        if (res.dev_otp) {
          setDevOtpHint(res.dev_otp);
        }
        setResendTimer(60);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 3: Complete Registration with Clinical Baseline
  // -------------------------------------------------------------
  const handleFinalSignup = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isOtpVerified) {
      setErrorMsg('Please complete email verification first.');
      setStep(2);
      return;
    }

    setIsLoading(true);
    try {
      const res = await signupUser(formData);
      if (res.success && res.user) {
        setSuccessMsg('Registration & clinical baseline saved! Entering dashboard...');
        setTimeout(() => {
          onAuthSuccess(res.user);
        }, 800);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#060f0c] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      
      {/* Background Ambient Glowing Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] bg-[#00e599]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[35%] right-[25%] w-[350px] h-[350px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid line pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00e59908_1px,transparent_1px),linear-gradient(to_bottom,#00e59908_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-xl bg-forest-900/90 border border-emerald-500/25 rounded-3xl p-7 sm:p-10 shadow-2xl shadow-emerald-950/80 backdrop-blur-xl animate-fadeIn">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3 shadow-sm shadow-emerald-500/20">
            <Wind className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>RespiGuard Portable IoT & XAI Platform</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {tab === 'login' 
              ? 'Welcome Back' 
              : step === 1 
              ? 'Create Patient Account' 
              : step === 2 
              ? 'Verify Email Address' 
              : 'Clinical Baseline Setup'}
          </h1>
          
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {tab === 'login' 
              ? 'Please sign in to connect your portable asthma monitor and view live AI analytics.'
              : step === 1 
              ? 'Enter your details to receive a 6-digit email verification code.'
              : step === 2 
              ? `We have dispatched a 6-digit OTP code to ${formData.email}.`
              : 'Our machine learning models use these baseline parameters to calculate your personalized risk.'}
          </p>
        </div>

        {/* Multi-step indicator for Sign Up */}
        {tab === 'signup' && (
          <div className="flex items-center justify-between mb-6 px-4">
            {[
              { num: 1, label: 'Account' },
              { num: 2, label: 'Verify OTP' },
              { num: 3, label: 'Clinical Profile' }
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === s.num
                      ? 'bg-emerald-500 text-forest-950 ring-4 ring-emerald-500/20 shadow-lg shadow-emerald-500/30'
                      : step > s.num
                      ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50'
                      : 'bg-forest-950 text-slate-500 border border-slate-800'
                  }`}>
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1 ${step >= s.num ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={`h-0.5 flex-1 mb-3 transition-all ${step > s.num ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-forest-950/90 p-1.5 rounded-2xl border border-emerald-500/20 mb-6">
          <button
            type="button"
            onClick={() => { 
              setTab('login'); 
              setErrorMsg(''); 
              setSuccessMsg(''); 
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-gradient-to-r from-emerald-500 to-mint-500 text-forest-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { 
              setTab('signup'); 
              setStep(1); 
              setErrorMsg(''); 
              setSuccessMsg(''); 
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-gradient-to-r from-emerald-500 to-mint-500 text-forest-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            New Patient Sign Up & Onboard
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-950/70 border border-red-500/40 rounded-2xl flex items-start gap-3 text-red-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-semibold">{errorMsg}</div>
          </div>
        )}

        {/* Success Alert Box */}
        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-950/70 border border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-200 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 1: SIGN IN FORM */}
        {/* ==================================================================== */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In & Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* TAB 2 - STEP 1: ACCOUNT CREDENTIALS */}
        {/* ==================================================================== */}
        {tab === 'signup' && step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="e.g. Aiman Ahmed"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">A 6-digit verification code will be sent to this email.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Create Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Verification Code (OTP)</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* TAB 2 - STEP 2: OTP VERIFICATION */}
        {/* ==================================================================== */}
        {tab === 'signup' && step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="p-4 bg-forest-950/80 border border-emerald-500/20 rounded-2xl text-center">
              <div className="w-12 h-12 mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400 mb-3">
                <KeyRound className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Enter 6-Digit Verification Code</h3>
              <p className="text-xs text-slate-400">
                Code sent to <span className="text-emerald-400 font-semibold">{formData.email}</span>
              </p>
              
              {devOtpHint && (
                <div className="mt-2 inline-block px-3 py-1 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300 font-mono">
                  🔑 Code: <b>{devOtpHint}</b>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 text-center">One-Time Password (OTP)</label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="• • • • • •"
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                className="w-full text-center tracking-[0.6em] text-2xl font-black py-3.5 bg-forest-950/90 border-2 border-emerald-500/30 focus:border-emerald-400 rounded-2xl text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 font-mono transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-xs px-1">
              <button
                type="button"
                onClick={() => { setStep(1); setErrorMsg(''); }}
                className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Change Email</span>
              </button>

              <button
                type="button"
                disabled={resendTimer > 0 || isLoading}
                onClick={handleResendOtp}
                className="text-emerald-400 hover:text-emerald-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading || otpInput.trim().length !== 6}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Email & Continue</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* TAB 2 - STEP 3: CLINICAL BASELINE QUESTIONNAIRE (ONBOARDING) */}
        {/* ==================================================================== */}
        {tab === 'signup' && step === 3 && (
          <form onSubmit={handleFinalSignup} className="space-y-4">
            
            {/* 1. Asthma Severity Selection Cards */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                1. Asthma Severity Level <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'Mild', label: 'Mild', color: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300', desc: 'Infrequent symptoms (<2x/wk)' },
                  { id: 'Moderate', label: 'Moderate', color: 'border-amber-500/50 bg-amber-950/40 text-amber-300', desc: 'Daily / regular symptoms' },
                  { id: 'Severe', label: 'Severe', color: 'border-rose-500/50 bg-rose-950/40 text-rose-300', desc: 'Frequent flare-ups / high risk' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSeveritySelect(s.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      formData.severity === s.id
                        ? `${s.color} ring-2 ring-emerald-400 font-bold shadow-lg`
                        : 'border-slate-800 bg-forest-950/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs block font-extrabold">{s.label}</span>
                    <span className="text-[10px] text-slate-400 block mt-1 leading-tight">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Age & Biological Sex */}
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Age (Years)</label>
                <input
                  type="number"
                  name="age"
                  min={5}
                  max={100}
                  required
                  value={formData.age}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Biological Sex</label>
                <div className="flex gap-2">
                  {['male', 'female'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleSexSelect(g)}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl border capitalize transition-all cursor-pointer ${
                        formData.sex === g
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400'
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
                <label className="text-xs font-bold text-slate-300">Personal Best PEF (L/min)</label>
                <span className="text-[10px] text-emerald-400 font-semibold">Target Lung Baseline</span>
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
                  className="w-full pl-10 pr-16 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">L/min</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Typical healthy baseline: ~520 L/min (Male, 20-30yo), ~430 L/min (Female).
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-3 bg-forest-800/80 hover:bg-forest-800 text-slate-300 text-xs font-bold rounded-xl border border-emerald-500/10 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Complete Onboarding & Enter Dashboard</span>
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
