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
import MedicationsPage from './components/MedicationsPage';
import AirMapPage from './components/AirMapPage';
import ProfileModal from './components/ProfileModal';
import DoctorReplyPortal from './components/DoctorReplyPortal';
import DoctorDashboard from './components/DoctorDashboard';
import NotificationToast from './components/NotificationToast';
import AICopilotModal from './components/AICopilotModal';
import { 
  LayoutGrid, 
  Sparkles, 
  Pill, 
  MessageSquare, 
  MapPin,
  User, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { 
  fetchHealth, 
  fetchStats, 
  fetchGlobalImportance, 
  fetchHistory, 
  fetchAlerts, 
  fetchLatestTelemetry,
  predictAndExplain,
  fetchMessages
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

  // Modal and Navigation states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isShapModalOpen, setIsShapModalOpen] = useState(false);

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
  const [isEsp32Connected, setIsEsp32Connected] = useState(false);

  // Handle Auth Success
  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('respiguard_user', JSON.stringify(userData));
    if (userData?.access_token) {
      localStorage.setItem('respiguard_token', userData.access_token);
    }
  };

  // Handle Sign Out -> redirects immediately to AuthPage
  const handleSignOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('respiguard_user');
    localStorage.removeItem('respiguard_token');
  };

  // Handle Profile Update with Instant Local & ML Recalculation
  const handleProfileUpdated = async (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('respiguard_user', JSON.stringify(updatedUser));

    // Re-evaluate 2-stage ML model with new clinical baselines
    try {
      const payload = {
        ...realtimeTelemetry,
        severity: updatedUser.severity || 'Mild',
        age: updatedUser.age || 22,
        sex: updatedUser.sex || 'male',
        pef_best: updatedUser.pef_best || 520
      };
      const updatedPred = await predictAndExplain(payload);
      setRealtimePredictionData(updatedPred);
    } catch (e) {
      console.error('Failed to update prediction after profile change', e);
    }
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
  }, [timeframe, currentUser?.id]);

  // 2. Real-Time Telemetry Polling (Every 3 seconds)
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      const latest = await fetchLatestTelemetry();
      if (latest) {
        setIsEsp32Connected(Boolean(latest.is_esp32_connected));
        if (latest.telemetry) {
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
      } else {
        setIsEsp32Connected(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Real-time WhatsApp-style Notification state
  const [notification, setNotification] = useState(null);
  const [lastMessageId, setLastMessageId] = useState(null);

  // Poll for incoming messages to trigger live pop notification
  useEffect(() => {
    if (!currentUser?.id) return;

    let isMounted = true;
    const checkIncoming = async () => {
      try {
        const msgs = await fetchMessages(currentUser.id);
        if (msgs && Array.isArray(msgs) && msgs.length > 0) {
          const newest = msgs[msgs.length - 1];
          const isDoc = currentUser.role === 'doctor';
          const isIncoming = isDoc ? (newest.sender_type === 'patient') : (newest.sender_type === 'doctor');

          if (lastMessageId && newest.id !== lastMessageId && isIncoming) {
            setNotification({
              id: newest.id,
              sender_type: newest.sender_type,
              sender_name: isDoc ? (newest.patient_name || 'Patient') : (newest.doctor_name || 'Dr. Pulmonologist'),
              message: newest.message_body || newest.text || 'Sent you a clinical message'
            });
          }
          if (isMounted) {
            setLastMessageId(newest.id);
          }
        }
      } catch (e) {}
    };

    checkIncoming();
    const interval = setInterval(checkIncoming, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser?.id, lastMessageId]);

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
  // DOCTOR WORKSPACE: Render dedicated DoctorDashboard if role === 'doctor'
  // ============================================================================
  if (currentUser.role === 'doctor') {
    return (
      <div className="min-h-screen bg-[#050d0a] text-slate-100 selection:bg-emerald-500 selection:text-white">
        <NotificationToast
          notification={notification}
          onClose={() => setNotification(null)}
          onClick={() => setNotification(null)}
        />
        <DoctorDashboard
          currentUser={currentUser}
          onLogout={handleSignOut}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onMessageSent={(msg) => setLastMessageId(msg.id)}
        />
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onProfileUpdated={handleProfileUpdated}
        />
      </div>
    );
  }

  // Mobile Bottom Navigation tabs
  const mobileNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'map', label: 'Air Map', icon: MapPin },
    { id: 'xai', label: 'Clinical AI', icon: Sparkles },
    { id: 'medications', label: 'Meds', icon: Pill },
    { id: 'messages', label: 'Consults', icon: MessageSquare },
  ];

  // ============================================================================
  // AUTHENTICATED DASHBOARD VIEW
  // ============================================================================
  return (
    <div className="flex min-h-screen bg-[#060f0c] bg-[linear-gradient(to_right,#00e59908_1px,transparent_1px),linear-gradient(to_bottom,#00e59908_1px,transparent_1px)] bg-[size:4rem_4rem] text-slate-100 selection:bg-emerald-500 selection:text-white relative">
      {/* Floating Real-time WhatsApp-Style Notification Toast */}
      <NotificationToast 
        notification={notification}
        onClose={() => setNotification(null)}
        onClick={() => {
          setActiveTab('messages');
          setNotification(null);
        }}
      />

      {/* Left Navigation Sidebar (Desktop & Mobile Drawer) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isEsp32Connected={isEsp32Connected}
      />

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-20 md:pb-10">
        <Header 
          activeTab={activeTab} 
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          isEsp32Connected={isEsp32Connected}
        />

        <div className="px-4 sm:px-6 pb-10 max-w-7xl mx-auto w-full">
          {/* VIEW 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              {/* TOP SECTION: Hero Banner (8 cols) + Environmental Condition Card (4 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-8">
                  <HeroBanner currentUser={currentUser} />
                </div>

                <div className="lg:col-span-4">
                  <EnvironmentalConditionCard 
                    predictionData={realtimePredictionData} 
                    onOpenShap={() => setIsShapModalOpen(true)}
                  />
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

              {/* ROW 2: TELEMETRY OVERVIEW CHART */}
              <div className="w-full">
                <TelemetryOverviewChart 
                  historyData={historyData}
                  timeframe={timeframe}
                  setTimeframe={setTimeframe}
                />
              </div>
            </div>
          )}

          {/* VIEW: AIR QUALITY & HOSPITAL MAP */}
          {activeTab === 'map' && (
            <div className="animate-fadeIn">
              <AirMapPage 
                realtimeTelemetry={realtimeTelemetry} 
                currentUser={currentUser}
              />
            </div>
          )}

          {/* VIEW 2: CLINICAL RISK AI & FEATURE ATTRIBUTION */}
          {activeTab === 'xai' && (
            <div className="animate-fadeIn">
              <XAIPage 
                globalImportance={globalImportance} 
                currentUser={currentUser}
                realtimeTelemetry={realtimeTelemetry}
                realtimePredictionData={realtimePredictionData}
              />
            </div>
          )}

          {/* VIEW 3: MEDICATIONS TAB (Overhauled with GINA alerts & adherence tracker) */}
          {activeTab === 'medications' && (
            <div className="animate-fadeIn">
              <MedicationsPage currentUser={currentUser} />
            </div>
          )}

          {/* VIEW 4: CLINICAL MESSAGES TAB (Overhauled with Doctor Portal & Verified Specialists) */}
          {activeTab === 'messages' && (
            <div className="animate-fadeIn">
              <MessagesPage currentUser={currentUser} />
            </div>
          )}
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-forest-950/90 backdrop-blur-lg border-t border-emerald-500/20 px-3 py-2 flex items-center justify-around shadow-2xl">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive 
                  ? 'text-emerald-400 bg-emerald-500/15' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Profile button on mobile bottom bar */}
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-400 hover:text-emerald-400 transition-all"
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
      </nav>

      {/* SHAP Explanation Modal */}
      <ShapModal 
        isOpen={isShapModalOpen} 
        onClose={() => setIsShapModalOpen(false)} 
        predictionData={realtimePredictionData}
      />

      {/* Profile & Baseline Editing Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* RespiGuard AI Copilot (Groq Tool Calling & System-Wide Assistant) */}
      {currentUser?.role !== 'doctor' && <AICopilotModal currentUser={currentUser} />}
    </div>
  );
}
