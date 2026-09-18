import React, { useState, useEffect } from 'react';
import { 
  X, User, ShieldCheck, Mail, Activity, Heart, 
  Calendar, Check, AlertCircle, Save, Sparkles, Stethoscope,
  Building2, GraduationCap, Phone, Clock, Copy
} from 'lucide-react';
import { updateProfile } from '../api';

export default function ProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }) {
  if (!isOpen || !currentUser) return null;

  const isDoctor = currentUser.role === 'doctor';

  const [formData, setFormData] = useState({
    full_name: currentUser.full_name || '',
    age: currentUser.age || 22,
    sex: currentUser.sex || 'male',
    severity: currentUser.severity || 'Mild',
    pef_best: currentUser.pef_best || 520,
    hospital: currentUser.hospital || 'Respiratory Care Hospital',
    specialty: currentUser.specialty || 'Pulmonology & Critical Care',
    degrees: currentUser.degrees || 'MBBS, FCPS (Pulmonology)',
    phone: currentUser.phone || '',
    consultation_hours: currentUser.consultation_hours || 'Sun - Thu (5:00 PM - 9:00 PM)'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Sync state if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFormData({
        full_name: currentUser.full_name || '',
        age: currentUser.age || 22,
        sex: currentUser.sex || 'male',
        severity: currentUser.severity || 'Mild',
        pef_best: currentUser.pef_best || 520,
        hospital: currentUser.hospital || 'Respiratory Care Hospital',
        specialty: currentUser.specialty || 'Pulmonology & Critical Care',
        degrees: currentUser.degrees || 'MBBS, FCPS (Pulmonology)',
        phone: currentUser.phone || '',
        consultation_hours: currentUser.consultation_hours || 'Sun - Thu (5:00 PM - 9:00 PM)'
      });
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [currentUser, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let payload = { full_name: formData.full_name.trim() };

      if (isDoctor) {
        payload = {
          ...payload,
          hospital: formData.hospital.trim(),
          specialty: formData.specialty.trim(),
          degrees: formData.degrees.trim(),
          phone: formData.phone.trim(),
          consultation_hours: formData.consultation_hours.trim()
        };
      } else {
        const parsedAge = parseInt(formData.age, 10);
        const parsedPef = parseFloat(formData.pef_best);

        if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
          setErrorMsg('Age must be between 18 and 120 years.');
          setIsLoading(false);
          return;
        }

        if (isNaN(parsedPef) || parsedPef < 50 || parsedPef > 900) {
          setErrorMsg('Peak Expiratory Flow (PEF) must be between 50 and 900 L/min.');
          setIsLoading(false);
          return;
        }

        payload = {
          ...payload,
          age: parsedAge,
          sex: formData.sex.toLowerCase(),
          severity: formData.severity,
          pef_best: parsedPef
        };
      }

      const res = await updateProfile(payload);

      if (res.success && res.user) {
        setSuccessMsg('Profile updated successfully!');
        if (onProfileUpdated) {
          onProfileUpdated(res.user);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        throw new Error(res.message || 'Failed to update profile');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Severity color indicator
  const severityBadgeColors = {
    Mild: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    Moderate: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    Severe: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-lg bg-forest-900/95 border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-950/60 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-500/20 bg-forest-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-mint-400 flex items-center justify-center font-extrabold text-forest-950 text-base shadow-md shadow-emerald-500/20">
              {currentUser.full_name?.charAt(0)?.toUpperCase() || (isDoctor ? 'D' : 'P')}
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>{isDoctor ? 'Doctor Clinical Credentials' : 'Patient Profile & Baseline'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  {isDoctor ? 'Verified MD' : 'Verified Patient'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-forest-800/80 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Account Overview Metadata */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-forest-950/60 border border-emerald-500/15 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider">
                {isDoctor ? 'BMDC Registration' : 'Patient ID Code'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-emerald-300 font-black">
                  {isDoctor ? (currentUser.bmdc_number || 'BMDC-A-74129') : (currentUser.patient_id_code || 'PAT-2201031')}
                </span>
                {!isDoctor && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentUser.patient_id_code || 'PAT-2201031');
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Copy Patient ID"
                  >
                    {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block font-medium uppercase tracking-wider">Platform Status</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Active & Database Synced
              </span>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              {isDoctor ? <Stethoscope className="w-3.5 h-3.5 text-emerald-400" /> : <Activity className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isDoctor ? 'Practitioner Credentials' : 'Clinical Baseline Parameters'}</span>
            </h4>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="e.g. Dr. Sabrina Rahman"
                className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>

            {/* ---------------- DOCTOR SPECIFIC FIELDS ---------------- */}
            {isDoctor && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Hospital / Affiliation</label>
                  <input
                    type="text"
                    required
                    value={formData.hospital}
                    onChange={(e) => handleChange('hospital', e.target.value)}
                    placeholder="e.g. Dhaka Medical College Hospital"
                    className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Specialty</label>
                    <input
                      type="text"
                      required
                      value={formData.specialty}
                      onChange={(e) => handleChange('specialty', e.target.value)}
                      placeholder="e.g. Pulmonology"
                      className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Degrees</label>
                    <input
                      type="text"
                      required
                      value={formData.degrees}
                      onChange={(e) => handleChange('degrees', e.target.value)}
                      placeholder="MBBS, FCPS"
                      className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+880 1711-223344"
                    className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Consultation Hours</label>
                  <input
                    type="text"
                    value={formData.consultation_hours}
                    onChange={(e) => handleChange('consultation_hours', e.target.value)}
                    placeholder="Sun - Thu (5:00 PM - 9:00 PM)"
                    className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </>
            )}

            {/* ---------------- PATIENT SPECIFIC FIELDS ---------------- */}
            {!isDoctor && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Age (Years, &ge; 18)
                    </label>
                    <input
                      type="number"
                      min="18"
                      max="120"
                      required
                      value={formData.age}
                      onChange={(e) => handleChange('age', e.target.value)}
                      className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Biological Sex</label>
                    <select
                      value={formData.sex}
                      onChange={(e) => handleChange('sex', e.target.value)}
                      className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Asthma Severity Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Mild', 'Moderate', 'Severe'].map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => handleChange('severity', sev)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          formData.severity === sev
                            ? `${severityBadgeColors[sev]} ring-1 ring-emerald-400 shadow-sm`
                            : 'border-slate-800 bg-forest-950/50 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Personal Best PEF (L/min)</label>
                    <span className="text-[10px] text-emerald-400">Target Lung Capacity</span>
                  </div>
                  <input
                    type="number"
                    min="50"
                    max="900"
                    required
                    value={formData.pef_best}
                    onChange={(e) => handleChange('pef_best', e.target.value)}
                    className="w-full bg-forest-950/90 border border-emerald-500/25 rounded-2xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-forest-800/80 hover:bg-forest-800 text-slate-300 font-bold text-xs rounded-xl border border-emerald-500/10 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-mint-500 hover:from-emerald-400 hover:to-mint-400 text-forest-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-forest-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
