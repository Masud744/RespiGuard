import React, { useState, useEffect } from 'react';
import { 
  Mail, Lock, User, Activity, AlertCircle, 
  CheckCircle2, ArrowRight, ShieldCheck, ChevronLeft,
  Wind, KeyRound, RefreshCw, Send, Sparkles,
  Eye, EyeOff, Check, X, Stethoscope, Copy, Building2, GraduationCap
} from 'lucide-react';
import { signupUser, loginUser, sendOtp, verifyOtp } from '../api';

export default function AuthPage({ onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('patient'); // 'patient' | 'doctor'
  const [step, setStep] = useState(1); // 1: Credentials, 2: OTP Verification, 3: Onboarding/Credentials
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [registeredUser, setRegisteredUser] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'patient',
    severity: 'Mild',
    age: 22,
    sex: 'male',
    pef_best: 520,
    patient_id_code: '',
    // Doctor Credentials
    bmdc_number: '',
    hospital: '',
    specialty: 'Pulmonology & Critical Care',
    degrees: 'MBBS, FCPS (Pulmonology)',
    phone: ''
  });

  // Password Confirmation & Visibility State
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  // Dynamic Password Validation Criteria (Enforced by backend validation)
  const pwdCriteria = {
    hasMinLength: (formData.password || '').length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password || ''),
    hasNumber: /[0-9]/.test(formData.password || '')
  };

  const criteriaPassedCount = Object.values(pwdCriteria).filter(Boolean).length;
  const isPasswordValid = criteriaPassedCount === 3;
  const isConfirmMatching = confirmPassword.length > 0 && confirmPassword === formData.password;
  const hasConfirmMismatch = confirmPassword.length > 0 && confirmPassword !== formData.password;

  const getStrengthLabel = () => {
    if (!formData.password) return { label: '', color: 'bg-slate-700', text: 'text-slate-500', width: 'w-0' };
    if (criteriaPassedCount === 1) return { label: 'Weak', color: 'bg-rose-500', text: 'text-rose-400', width: 'w-1/3' };
    if (criteriaPassedCount === 2) return { label: 'Moderate', color: 'bg-amber-500', text: 'text-amber-400', width: 'w-2/3' };
    return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-400', width: 'w-full' };
  };

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
        const userObj = { ...res.user, access_token: res.access_token };
        if (res.access_token) {
          localStorage.setItem('respiguard_token', res.access_token);
        }
        setSuccessMsg(`Welcome back, ${res.user.full_name}! Launching dashboard...`);
        setTimeout(() => {
          onAuthSuccess(userObj);
        }, 600);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Step 1: Send OTP (Strict Credential Validation)
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
    if (!pwdCriteria.hasMinLength) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (!pwdCriteria.hasUppercase) {
      setErrorMsg('Password must contain at least one uppercase letter (A-Z).');
      return;
    }
    if (!pwdCriteria.hasNumber) {
      setErrorMsg('Password must contain at least one digit (0-9).');
      return;
    }
    if (!confirmPassword) {
      setErrorMsg('Please confirm your password.');
      return;
    }
    if (formData.password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please ensure both passwords are identical.');
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

  const [copiedId, setCopiedId] = useState(false);

  // -------------------------------------------------------------
  // Signup Step 3: Complete Registration with Clinical Baseline or Doctor Credentials
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

    if (role === 'doctor' && !formData.bmdc_number.trim()) {
      setErrorMsg('Please provide your BMDC Registration Number (e.g. BMDC-A-74129).');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        role: role
      };
      const res = await signupUser(payload);
      if (res.success && res.user) {
        const userObj = { ...res.user, access_token: res.access_token };
        if (res.access_token) {
          localStorage.setItem('respiguard_token', res.access_token);
        }
        setRegisteredUser(userObj);
        setSuccessMsg(role === 'doctor' 
          ? 'Doctor clinical credentials verified & registered!' 
          : `Registration successful! Assigned Patient ID: ${res.user.patient_id_code || 'PAT-2201031'}`);
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
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-3 shadow-sm shadow-emerald-500/20">
            <Wind className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>RespiGuard.ai</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {registeredUser
              ? 'Registration Complete'
              : tab === 'login' 
              ? 'Welcome Back' 
              : step === 1 
              ? (role === 'doctor' ? 'Doctor Registration' : 'Patient Registration')
              : step === 2 
              ? 'Verify Email Address' 
              : (role === 'doctor' ? 'Medical Practitioner Credentials' : 'Clinical Baseline Setup')}
          </h1>
          
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {registeredUser
              ? 'Your account has been created and verified successfully.'
              : tab === 'login' 
              ? 'Access your real-time respiratory analytics & telemetry.'
              : step === 1 
              ? (role === 'doctor' ? 'Enter your clinical information to register as an accredited specialist.' : 'Enter your details to create a patient profile with real-time AI monitoring.')
              : step === 2 
              ? `We dispatched a 6-digit verification code to ${formData.email}.`
              : (role === 'doctor' ? 'Provide your medical licensure and clinical hospital credentials.' : 'Our clinical AI models use these baseline vitals to compute your personalized risk.')}
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up (hidden if registration success card is shown) */}
        {!registeredUser && (
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
              New Registration
            </button>
          </div>
        )}

        {/* Role Selector Pills for Sign Up */}
        {!registeredUser && tab === 'signup' && (
          <div className="mb-6 p-1 bg-forest-950/70 border border-emerald-500/20 rounded-2xl flex gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRole('patient');
                setFormData(prev => ({ ...prev, role: 'patient' }));
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                role === 'patient'
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign Up as Patient</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('doctor');
                setFormData(prev => ({ ...prev, role: 'doctor' }));
                setErrorMsg('');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                role === 'doctor'
                  ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Sign Up as Doctor</span>
            </button>
          </div>
        )}

        {/* Multi-step indicator for Sign Up */}
        {!registeredUser && tab === 'signup' && (
          <div className="flex items-center justify-between mb-6 px-4">
            {[
              { num: 1, label: 'Account' },
              { num: 2, label: 'Verify OTP' },
              { num: 3, label: role === 'doctor' ? 'Credentials' : 'Clinical Profile' }
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
                  type={showLoginPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-3 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                  tabIndex={-1}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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

            {/* Create Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Create Password</label>
                {formData.password && (
                  <span className={`text-[10px] font-bold ${getStrengthLabel().text}`}>
                    Strength: {getStrengthLabel().label}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  placeholder="At least 8 chars, 1 uppercase, 1 digit"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setIsPasswordFocused(true)}
                  className={`w-full pl-10 pr-10 py-3 bg-forest-950/90 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    formData.password && !isPasswordValid
                      ? 'border-amber-500/50 focus:border-amber-400'
                      : formData.password && isPasswordValid
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : 'border-emerald-500/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter Bar */}
              {formData.password && (
                <div className="mt-2 w-full bg-forest-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${getStrengthLabel().color} ${getStrengthLabel().width}`}
                  />
                </div>
              )}

              {/* Real-time Dynamic Password Criteria Checklist */}
              {(isPasswordFocused || formData.password) && (
                <div className="mt-2.5 p-3 rounded-xl bg-forest-950/90 border border-emerald-500/20 space-y-1.5 animate-fadeIn">
                  <p className="text-[11px] font-semibold text-slate-300 mb-1">Password Requirements:</p>
                  <div className="grid grid-cols-1 gap-1 text-[11px]">
                    <div className={`flex items-center gap-2 transition-colors ${pwdCriteria.hasMinLength ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {pwdCriteria.hasMinLength ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 ml-1 mr-1" />
                      )}
                      <span>At least 8 characters long ({formData.password.length}/8)</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors ${pwdCriteria.hasUppercase ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {pwdCriteria.hasUppercase ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 ml-1 mr-1" />
                      )}
                      <span>At least one uppercase letter (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors ${pwdCriteria.hasNumber ? 'text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {pwdCriteria.hasNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0 ml-1 mr-1" />
                      )}
                      <span>At least one number (0-9)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  className={`w-full pl-10 pr-10 py-3 bg-forest-950/90 border rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all ${
                    isConfirmMatching
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : hasConfirmMismatch
                      ? 'border-rose-500/60 focus:border-rose-400'
                      : 'border-emerald-500/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Real-time Match Indicator */}
              {isConfirmMatching && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1.5 font-medium animate-fadeIn">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Passwords match</span>
                </div>
              )}
              {hasConfirmMismatch && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-400 mt-1.5 font-medium animate-fadeIn">
                  <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>Passwords do not match</span>
                </div>
              )}
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
        {/* ==================================================================== */}
        {/* REGISTRATION COMPLETE CELEBRATION CARD WITH UNIQUE PATIENT ID */}
        {/* ==================================================================== */}
        {registeredUser && (
          <div className="space-y-6 text-center animate-fadeIn py-2">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
              {role === 'doctor' ? <Stethoscope className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{role === 'doctor' ? 'Accredited Medical Practitioner' : 'Patient Registration Complete'}</span>
              </div>
              <h2 className="text-2xl font-black text-white">Welcome, {registeredUser.full_name}!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {role === 'doctor'
                  ? 'Your doctor account is verified. You can now monitor linked patients, examine real-time AHI risk telemetry, and dispatch clinical advisories.'
                  : 'Your personalized profile is active and synced with real-time IoT air quality telemetry.'}
              </p>
            </div>

            {role === 'patient' && (
              <div className="p-4 bg-forest-950/90 border-2 border-emerald-500/40 rounded-2xl text-left space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-emerald-400">Your Assigned Patient ID</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">Doctor Linking Code</span>
                </div>
                <div className="flex items-center justify-between gap-3 bg-forest-900/90 p-3 rounded-xl border border-emerald-500/30">
                  <span className="font-mono text-xl font-black text-emerald-300 tracking-wider">
                    {registeredUser.patient_id_code || 'PAT-2201031'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(registeredUser.patient_id_code || 'PAT-2201031');
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 transition-all cursor-pointer"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Share this unique Patient ID with your pulmonologist or hospital care team so they can pair your telemetry stream and monitor your Asthma Hazard Index (AHI).
                </p>
              </div>
            )}

            {role === 'doctor' && (
              <div className="p-4 bg-forest-950/90 border-2 border-emerald-500/40 rounded-2xl text-left space-y-2">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider text-[11px] text-emerald-400">
                  Verified Practitioner Profile
                </div>
                <div className="bg-forest-900/90 p-3 rounded-xl border border-emerald-500/30 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">BMDC Reg No:</span>
                    <span className="font-mono font-bold text-emerald-300">{registeredUser.bmdc_number || formData.bmdc_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Specialty:</span>
                    <span className="font-semibold text-white">{registeredUser.specialty || formData.specialty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hospital:</span>
                    <span className="font-semibold text-white">{registeredUser.hospital || formData.hospital}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => onAuthSuccess(registeredUser)}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{role === 'doctor' ? 'Launch Doctor Clinical Dashboard' : 'Open Patient IoT Dashboard'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2 - STEP 3: CLINICAL BASELINE OR DOCTOR CREDENTIALS */}
        {/* ==================================================================== */}
        {!registeredUser && tab === 'signup' && step === 3 && (
          <form onSubmit={handleFinalSignup} className="space-y-4">
            
            {/* ---------------- PATIENT FORM ---------------- */}
            {role === 'patient' && (
              <>
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
                      min={18}
                      max={120}
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
              </>
            )}

            {/* ---------------- DOCTOR FORM ---------------- */}
            {role === 'doctor' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    BMDC Registration Number <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      name="bmdc_number"
                      required
                      placeholder="e.g. BMDC-A-74129"
                      value={formData.bmdc_number}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Bangladesh Medical & Dental Council practitioner license number.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Hospital / Institution Affiliation <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      name="hospital"
                      required
                      placeholder="e.g. Dhaka Medical College Hospital"
                      value={formData.hospital}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Specialty</label>
                    <input
                      type="text"
                      name="specialty"
                      required
                      placeholder="e.g. Pulmonology"
                      value={formData.specialty}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Degrees & Credentials</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        name="degrees"
                        required
                        placeholder="MBBS, FCPS"
                        value={formData.degrees}
                        onChange={handleChange}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Contact Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. +880 1711-234567"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-forest-950/90 border border-emerald-500/20 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
              </>
            )}

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
                    <span>{role === 'doctor' ? 'Complete Doctor Registration' : 'Complete Onboarding & Get Patient ID'}</span>
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
