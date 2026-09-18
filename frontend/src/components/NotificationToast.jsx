import React, { useEffect } from 'react';
import { MessageSquare, X, ShieldCheck, User, Stethoscope } from 'lucide-react';

/**
 * Synthesizes a pleasant, gentle two-tone WhatsApp-style audio chime
 * using the browser's native Web Audio API (zero external asset dependencies).
 */
export function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    // First tone (higher note)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Second tone (slightly higher pitch, classic instant message ping)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08); // D6
    gain2.gain.setValueAtTime(0.09, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.3);
  } catch (err) {
    // Graceful fallback if audio autoplay blocked by browser policy
  }
}

export default function NotificationToast({ notification, onClose, onClick }) {
  useEffect(() => {
    if (notification) {
      playNotificationSound();
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification) return null;

  const isDoctor = notification.sender_type === 'doctor';
  const senderName = notification.sender_name || (isDoctor ? 'Doctor Specialist' : 'Patient');
  const preview = notification.message || notification.text || 'Sent you a clinical advisory';

  return (
    <div className="fixed top-5 right-5 z-[9999] max-w-sm w-[calc(100vw-2.5rem)] animate-slideDown pointer-events-auto">
      <div 
        onClick={() => {
          if (onClick) onClick(notification);
        }}
        className="bg-[#0b1b16] border-2 border-emerald-500/50 hover:border-emerald-400 p-3.5 rounded-2xl shadow-2xl shadow-emerald-950/90 backdrop-blur-xl flex items-start gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] group"
      >
        {/* Avatar with WhatsApp-style online dot */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-mint-400 p-0.5 flex items-center justify-center shadow-md shadow-emerald-500/30">
            <div className="w-full h-full bg-[#06120e] rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              {isDoctor ? <Stethoscope className="w-5 h-5 text-emerald-400" /> : <User className="w-5 h-5 text-emerald-400" />}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0b1b16] rounded-full ring-1 ring-emerald-500/50" />
        </div>

        {/* Message body */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h4 className="text-xs font-black text-white truncate flex items-center gap-1.5">
              <span>{senderName}</span>
              {isDoctor && (
                <span className="px-1.5 py-0.2 bg-emerald-500/20 border border-emerald-500/30 text-[9px] text-emerald-300 rounded font-semibold">
                  Verified MD
                </span>
              )}
            </h4>
            <span className="text-[10px] text-emerald-400/80 shrink-0 font-medium">Just now</span>
          </div>

          <p className="text-xs text-slate-300 line-clamp-2 leading-snug group-hover:text-white transition-colors">
            {preview}
          </p>

          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
            <MessageSquare className="w-3 h-3" />
            <span>Click to reply instantly</span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onClose) onClose();
          }}
          className="shrink-0 p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
