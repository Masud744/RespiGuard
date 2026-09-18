import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Send, X, Bot, RefreshCw, ShieldCheck, 
  Activity, Wind, Pill, Stethoscope, ChevronDown, Check,
  Zap, AlertCircle, MessageSquare, Trash2, Cpu,
  Maximize2, Minimize2, MapPin
} from 'lucide-react';
import { sendCopilotMessage, fetchCopilotStatus, fetchCopilotHistory, clearCopilotHistory } from '../api';

export default function AICopilotModal({ currentUser }) {
  // Chatbot is strictly excluded from Doctor Section as requested
  if (currentUser?.role === 'doctor') {
    return null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [sizeMode, setSizeMode] = useState('normal'); // 'normal' | 'expanded' | 'fullscreen'
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // Persistent storage key scoped to current authenticated user
  const storageKey = currentUser?.id 
    ? `respiguard_copilot_messages_${currentUser.id}` 
    : 'respiguard_copilot_messages_guest';

  const getInitialGreeting = () => {
    const name = currentUser?.full_name?.split(' ')[0] || 'there';
    return `Hello ${name}! 👋\nHow can I assist you with your environment, air quality map, medication schedule, or consultations today?`;
  };

  // Initialize messages from localStorage if available
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If the first message has old robotic tool list, update it to clean greeting
          if (parsed[0]?.id === 'welcome' && parsed[0]?.content?.includes('I have real-time tool access to:')) {
            parsed[0].content = getInitialGreeting();
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load saved copilot messages", e);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: getInitialGreeting(),
        tools_called: []
      }
    ];
  });

  // Save messages to localStorage whenever conversation updates
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to persist copilot messages", e);
    }
  }, [messages, storageKey]);

  // Sync conversation history from encrypted database on mount / account change
  useEffect(() => {
    let isMounted = true;
    fetchCopilotHistory()
      .then(cloudMsgs => {
        if (!isMounted) return;
        if (Array.isArray(cloudMsgs) && cloudMsgs.length > 0) {
          setMessages(cloudMsgs);
        }
      })
      .catch(err => console.warn("Failed to sync cloud chat history:", err));
    return () => { isMounted = false; };
  }, [currentUser?.id]);

  // Quick suggestion prompts
  const quickPrompts = [
    { label: '🧠 Explain Asthma Risk & XAI', text: 'Explain my current asthma risk prediction and which features are responsible why' },
    { label: '🌿 Can I go outside right now?', text: 'Can I go outside right now?' },
    { label: '🗺️ Air Quality Map & Hospitals', text: 'Show me Kaliakair air quality map and nearest emergency hospital' },
    { label: '📡 Live PM2.5 & Temp', text: 'What is my current live sensor PM2.5 and temperature?' },
    { label: '💊 Check Medication Schedule', text: 'When is my next medication dose and how many doses left?' },
    { label: '🩺 Show Doctor Info', text: 'Give me Dr. Zaman Islam\'s chamber and contact information' },
    { label: '💨 Log 1 Rescue Puff', text: 'I took 1 rescue puff, please log it for me' }
  ];

  // Fetch engine status on open
  useEffect(() => {
    if (isOpen) {
      fetchCopilotStatus()
        .then(data => setCopilotStatus(data))
        .catch(() => setCopilotStatus(null));
    }
  }, [isOpen]);

  // Auto-scroll chat on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, sizeMode]);

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build conversation history for context (last 6 turns)
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await sendCopilotMessage(query, history);
      
      const assistantMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.response || 'I processed your request.',
        tools_called: res.tools_called || [],
        mode: res.mode,
        model: res.model
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Sorry, I encountered an issue: ${err.message || 'Could not connect to AI Copilot.'}`,
          tools_called: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    const fresh = [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Chat history cleared. How can I assist you right now?`,
        tools_called: []
      }
    ];
    setMessages(fresh);
    try {
      localStorage.setItem(storageKey, JSON.stringify(fresh));
    } catch (e) {
      console.warn("Failed to clear copilot storage", e);
    }
    await clearCopilotHistory();
  };

  const toggleSizeMode = () => {
    setSizeMode(prev => {
      if (prev === 'normal') return 'expanded';
      if (prev === 'expanded') return 'fullscreen';
      return 'normal';
    });
  };

  // Determine size classes dynamically
  const getSizeClasses = () => {
    if (sizeMode === 'fullscreen') {
      return 'fixed inset-2 md:inset-6 z-50 w-auto h-auto rounded-3xl';
    }
    if (sizeMode === 'expanded') {
      return 'fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50 w-[calc(100vw-1.5rem)] md:w-[780px] h-[82vh] md:h-[84vh] max-h-[92vh] rounded-3xl';
    }
    // Default normal mode
    return 'fixed bottom-20 right-3 md:bottom-6 md:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[460px] h-[72vh] md:h-[620px] max-h-[86vh] rounded-3xl';
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON (Bottom-Right, placed above mobile nav bar) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#00e599] text-forest-950 font-black text-xs shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-400/60 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-emerald-300/40"
          title="Open RespiGuard AI Copilot"
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-forest-950 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-950 animate-ping" />
          </div>
          <span className="tracking-wide">AI Copilot</span>
        </button>
      )}

      {/* FLOATING CHAT DRAWER / RESIZABLE WINDOW */}
      {isOpen && (
        <div 
          className={`${getSizeClasses()} overflow-hidden shadow-2xl shadow-black/80 border border-emerald-500/30 bg-forest-950/95 backdrop-blur-2xl flex flex-col transition-all duration-300 animate-fadeIn`}
        >
          
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-forest-800/80 bg-gradient-to-r from-forest-900/95 via-[#0e3025] to-forest-950 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md shadow-emerald-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-forest-950 rounded-[14px] flex items-center justify-center">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white tracking-tight">RespiGuard AI Copilot</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-300/80">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>
                    {copilotStatus?.groq_active ? 'Groq Llama-3.3-70B Cloud' : 'Intelligent Tool Engine'}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions: Size Toggle, Clear History, Close */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSizeMode}
                title={sizeMode === 'normal' ? 'Expand window' : sizeMode === 'expanded' ? 'Full screen' : 'Restore size'}
                className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-300 hover:bg-forest-800/60 transition cursor-pointer"
              >
                {sizeMode === 'normal' ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={clearChat}
                title="Clear conversation"
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-forest-800/60 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize Copilot"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-forest-800/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3.5 custom-scrollbar">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* Tool execution badges if tools were invoked */}
                  {msg.tools_called && msg.tools_called.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5 max-w-[95%]">
                      {msg.tools_called.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-300"
                        >
                          <Zap className="w-2.5 h-2.5 text-emerald-400" />
                          <span>
                            {t.name === 'get_xai_clinical_risk_and_shap' 
                              ? 'Tool: XAI Risk & TreeSHAP Drivers' 
                              : t.name === 'get_air_quality_map_and_emergency_facilities'
                              ? 'Tool: Regional Map & Emergency Hospitals'
                              : `Tool: ${t.name}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-lg ${
                      isUser
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs'
                        : 'bg-forest-900/90 border border-forest-700/80 text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  <span className="text-[9px] font-mono text-slate-500 mt-0.5 px-1">
                    {isUser ? 'You' : 'RespiGuard AI'}
                  </span>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-forest-900/80 border border-emerald-500/20 text-xs text-emerald-300 w-fit animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Consulting live tools & clinical database...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="px-2.5 py-2 border-t border-forest-800/60 bg-forest-900/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.text)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-xl bg-forest-800/80 hover:bg-emerald-950/80 border border-emerald-500/20 hover:border-emerald-400/40 text-[10px] font-semibold text-slate-300 hover:text-emerald-300 shrink-0 transition cursor-pointer disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 sm:p-3 border-t border-forest-800 bg-forest-900/90 backdrop-blur-md flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Ask in বাংলা, Banglish, or English..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-forest-950 border border-emerald-500/25 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="px-3.5 sm:px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-forest-950 font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/20 disabled:opacity-40 cursor-pointer transition"
            >
              {isLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>

        </div>
      )}
    </>
  );
}
