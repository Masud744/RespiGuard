import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import EnvironmentalConditionCard from './components/EnvironmentalConditionCard';
import TempHumidityCard from './components/TempHumidityCard';
import ParticulateMatterCard from './components/ParticulateMatterCard';
import MQ135GasCard from './components/MQ135GasCard';
import TelemetryOverviewChart from './components/TelemetryOverviewChart';
import XAIPage from './components/XAIPage';
import ShapModal from './components/ShapModal';
import AuthPage from './components/AuthPage';
import MessagesPage from './components/MessagesPage';
import DoctorReplyPortal from './components/DoctorReplyPortal';
import { Pill, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { 
  fetchHealth, 
  fetchStats, 
  fetchGlobalImportance, 
  fetchHistory, 
  fetchAlerts, 
  fetchLatestTelemetry,
  predictAndExplain 
} from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeframe, setTimeframe] = useState('weekly');
  
  // Auth state (Strict Authentication Gate)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('respiguard_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Real-time telemetry state for live sensors (DHT22 + PMS5003 + MQ135)
  const [realtimeTelemetry, setRealtimeTelemetry] = useState({
    temperature: 25.4,
    humidity: 58.2,
    pm1_0: 9.2,
    pm2_5: 12.8,
    pm10: 22.4,
    mq135: 408.0
  });

  // Dedicated real-time 2-Stage ML prediction for Dashboard
  const [realtimePredictionData, setRealtimePredictionData] = useState(null);

  const [globalImportance, setGlobalImportance] = useState([]);
  const [stats, setStats] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isShapModalOpen, setIsShapModalOpen] = useState(false);

  // Handle Auth Success
  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('respiguard_user', JSON.stringify(userData));
  };

  // Handle Sign Out -> redirects immediately to AuthPage
  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('respiguard_user');
  };

  // 1. Initial dashboard data load when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    async function initDashboard() {
      const health = await fetchHealth();
      setIsBackendConnected(health.status !== 'mock_fallback');

      const payload = {
        ...realtimeTelemetry,
        severity: currentUser.severity || 'Mild',
        age: currentUser.age || 22,
        sex: currentUser.sex || 'male',
        pef_best: currentUser.pef_best || 520
      };

      const [statsRes, impRes, histRes, alertsRes, realPred] = await Promise.all([
        fetchStats(),
        fetchGlobalImportance(),
        fetchHistory(timeframe),
        fetchAlerts(),
        predictAndExplain(payload)
      ]);

      setStats(statsRes);
      setGlobalImportance(impRes?.importance || []);
      setHistoryData(histRes?.data || []);
      setAlerts(alertsRes || []);
      setRealtimePredictionData(realPred);
    }
    initDashboard();
  }, [timeframe, currentUser]);

  // 2. Real-Time Telemetry Polling (Every 3 seconds)
  // Syncs with python sensor_simulator.py / live ESP32 hardware and runs 2-stage ML model
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      const latest = await fetchLatestTelemetry();
      if (latest && latest.telemetry) {
        setRealtimeTelemetry(latest.telemetry);
        
        // Compute 2-stage ML prediction tailored to active logged-in user profile
        const payload = {
          ...latest.telemetry,
          severity: currentUser.severity || 'Mild',
          age: currentUser.age || 22,
          sex: currentUser.sex || 'male',
          pef_best: currentUser.pef_best || 520
        };
        const updatedPred = await predictAndExplain(payload);
        setRealtimePredictionData(updatedPred);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // ============================================================================
  // DOCTOR 1-CLICK CLINICAL RESPONSE PORTAL (Opens from Email Link)
  // ============================================================================
  const isDoctorReplyPortal = window.location.search.includes('view=doctor-reply') || window.location.search.includes('action=doctor-reply');
  if (isDoctorReplyPortal) {
    return <DoctorReplyPortal />;
  }

  // ============================================================================
  // STRICT AUTH GATE: Show Login/Signup & Onboarding page if not logged in
  // ============================================================================
  if (!currentUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // ============================================================================
  // AUTHENTICATED DASHBOARD VIEW
  // ============================================================================
  return (
    <div className="flex min-h-screen bg-forest-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Left Navigation Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header 
          activeTab={activeTab} 
          currentUser={currentUser}
          onSignOut={handleSignOut}
        />

        <div className="px-6 pb-10 max-w-7xl">
          {/* VIEW 1: DASHBOARD (Shows 100% Real-Time IoT Telemetry & 2-Stage ML Risk) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              {/* TOP SECTION: Hero Banner (8 cols) + Environmental Condition Card (4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Hero Welcome Card */}
                <div className="lg:col-span-8">
                  <HeroBanner currentUser={currentUser} />
                </div>

                {/* Environmental Condition Card: Good / Moderate / Bad based on Realtime ML Prediction */}
                <div className="lg:col-span-4">
                  <EnvironmentalConditionCard predictionData={realtimePredictionData} />
                </div>
              </div>

              {/* ROW 1: 3 HORIZONTAL REAL-TIME SENSOR TELEMETRY CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <TempHumidityCard 
                  telemetry={realtimeTelemetry} 
                  predictionData={realtimePredictionData} 
                />
                <ParticulateMatterCard 
                  telemetry={realtimeTelemetry} 
                  predictionData={realtimePredictionData} 
                />
                <MQ135GasCard 
                  telemetry={realtimeTelemetry} 
                  predictionData={realtimePredictionData} 
                />
              </div>

              {/* ROW 2: TELEMETRY OVERVIEW CHART (Adherence & Environmental Trend) */}
              <div className="w-full">
                <TelemetryOverviewChart 
                  historyData={historyData}
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                />
              </div>
            </div>
          )}

          {/* VIEW 2: XAI & SHAP EXPLAINABILITY PAGE (Full Telemetry Simulator & TreeSHAP Waterfall) */}
          {activeTab === 'xai' && (
            <div className="animate-fadeIn">
              <XAIPage 
                globalImportance={globalImportance} 
                currentUser={currentUser}
              />
            </div>
          )}

          {/* VIEW 3: MEDICATIONS TAB */}
          {activeTab === 'medications' && (
            <div className="p-8 rounded-3xl bg-forest-900/60 border border-emerald-500/10 backdrop-blur-md animate-fadeIn">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Asthma Medication Schedule & Adherence</h2>
                  <p className="text-xs text-slate-400">Personalized inhaler dosage and clinical compliance tracking</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="p-5 rounded-2xl bg-forest-950/60 border border-emerald-500/20">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-emerald-300">Fluticasone Propionate (Preventive)</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Daily 2x</span>
                  </div>
                  <p className="text-xs text-slate-300">2 Inhalations Morning (08:00) & Night (20:00). Keeps airways uninflamed.</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-400" /> Next dose: 08:00 PM</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Taken Today</span>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-forest-950/60 border border-amber-500/20">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-sm text-amber-300">Salbutamol / Albuterol (Rescue Inhaler)</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">As Needed</span>
                  </div>
                  <p className="text-xs text-slate-300">Use 1-2 puffs immediately if Yellow/Red environmental alert triggers or wheezing begins.</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Doses remaining: 142 puffs</span>
                    <span className="text-amber-400 font-semibold">Ready for Portable Use</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: CLINICAL MESSAGES TAB */}
          {activeTab === 'messages' && (
            <div className="animate-fadeIn">
              <MessagesPage currentUser={currentUser} />
            </div>
          )}
        </div>
      </main>

      {/* SHAP Explanation Modal */}
      <ShapModal 
        isOpen={isShapModalOpen} 
        onClose={() => setIsShapModalOpen(false)} 
        predictionData={realtimePredictionData}
      />
    </div>
  );
}
