import React, { useState, useEffect } from 'react';
import { WaiterCall } from '../types/index.ts';
import {
  BellRing,
  Check,
  VolumeX,
  Volume2,
  Clock,
  Crown,
  AlertTriangle,
  Utensils,
  Droplets,
  Receipt,
  PhoneCall,
  User,
} from 'lucide-react';

interface NativeIncomingCallScreenProps {
  call: WaiterCall;
  waiterName: string;
  waiterId: string;
  isAssignedToMe: boolean;
  onAccept: (callId: string, waiterId: string, waiterName: string) => void;
  onMute: () => void;
  isMuted: boolean;
}

export const NativeIncomingCallScreen: React.FC<NativeIncomingCallScreenProps> = ({
  call,
  waiterName,
  waiterId,
  isAssignedToMe,
  onAccept,
  onMute,
  isMuted,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const elapsed = Math.floor((Date.now() - new Date(call.created_at).getTime()) / 1000);
    return Math.max(0, 45 - elapsed);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(call.created_at).getTime()) / 1000);
      const rem = Math.max(0, 45 - elapsed);
      setSecondsRemaining(rem);
    }, 1000);

    return () => clearInterval(timer);
  }, [call.created_at]);

  const getReasonLabel = () => {
    switch (call.call_type) {
      case 'order':
        return { label: 'READY TO ORDER DISHES', icon: Utensils, color: 'text-amber-400' };
      case 'water':
        return { label: 'WATER & DRINK REFILL', icon: Droplets, color: 'text-sky-400' };
      case 'bill':
        return { label: 'REQUESTING BILL / PAYMENT', icon: Receipt, color: 'text-emerald-400' };
      case 'urgent':
        return { label: 'URGENT ASSISTANCE NEEDED', icon: AlertTriangle, color: 'text-red-400' };
      default:
        return { label: 'CALLING WAITER', icon: PhoneCall, color: 'text-[#D4AF37]' };
    }
  };

  const reason = getReasonLabel();
  const Icon = reason.icon;

  return (
    <div className="fixed inset-0 z-50 bg-[#070707] flex flex-col justify-between p-6 sm:p-8 animate-fade-in overflow-hidden select-none">
      {/* Background Animated Radar Waves */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[350px] h-[350px] rounded-full border-2 border-[#D4AF37] animate-ping" />
        <div className="w-[550px] h-[550px] rounded-full border border-[#D4AF37]/40 animate-pulse" />
      </div>

      {/* Top Banner */}
      <div className="relative z-10 text-center pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FCF6BA] text-xs font-black uppercase tracking-widest shadow-lg">
          <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>INCOMING VIP TABLE CALL</span>
        </div>

        {/* 45-Second Auto-Escalation Countdown */}
        {isAssignedToMe && (
          <div className="mt-3 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-amber-300 mb-1">
              <span>{secondsRemaining > 0 ? `⚡ Auto-escalates in ${secondsRemaining}s` : '⚠️ ESCALATED TO ALL STAFF'}</span>
              <span>{Math.round((secondsRemaining / 45) * 100)}%</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  secondsRemaining > 15 ? 'bg-[#D4AF37]' : 'bg-red-500'
                }`}
                style={{ width: `${(secondsRemaining / 45) * 100}%` }}
              />
            </div>
          </div>
        )}

        {!isAssignedToMe && (
          <div className="mt-3 inline-block px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">
            {call.is_escalated
              ? '⚠️ ESCALATED CALL: Assigned waiter did not answer within 45s!'
              : 'BROADCAST: Unassigned VIP Table Call'}
          </div>
        )}
      </div>

      {/* Center Hero Information */}
      <div className="relative z-10 text-center my-auto flex flex-col items-center">
        {/* Pulsing Bell Icon */}
        <div className="relative mb-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center shadow-2xl shadow-[#D4AF37]/50 animate-bounce">
            <BellRing className="w-12 h-12 sm:w-14 sm:h-14 stroke-[2.5]" />
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-[#D4AF37] animate-ping opacity-75" />
        </div>

        {/* Table Number & Name */}
        <h1 className="text-4xl sm:text-5xl font-black text-[#FCF6BA] font-mono tracking-tight">
          {call.table_number}
        </h1>
        <h2 className="text-xl sm:text-2xl font-bold text-white/95 mt-1 font-display">
          {call.table_name}
        </h2>

        {/* Reason Badge */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm font-extrabold tracking-wide">
          <Icon className={`w-5 h-5 ${reason.color}`} />
          <span className={reason.color}>{reason.label}</span>
        </div>

        {/* Message Note if present */}
        {call.message && (
          <div className="mt-4 max-w-sm mx-auto bg-black/60 border border-[#D4AF37]/40 rounded-xl p-3 text-xs text-amber-200 italic shadow-inner">
            &ldquo;{call.message}&rdquo;
          </div>
        )}

        <div className="mt-3 text-xs text-white/60 flex items-center gap-1 font-mono">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Ringing since{' '}
            {new Date(call.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="relative z-10 flex flex-col gap-3 max-w-md mx-auto w-full">
        {/* HUGE ACCEPT BUTTON (WhatsApp / Telegram call answer style) */}
        <button
          type="button"
          onClick={() => onAccept(call.id, waiterId, waiterName)}
          className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 text-black font-black text-lg sm:text-xl shadow-2xl shadow-emerald-500/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-300"
        >
          <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
            <Check className="w-6 h-6 stroke-[3.5]" />
          </div>
          <span>I&apos;M ON MY WAY / ACCEPT</span>
        </button>

        {/* Mute audio button */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={onMute}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-semibold transition-colors"
          >
            {isMuted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-amber-400" />}
            <span>{isMuted ? 'Unmute Ringtone' : 'Silence Ringtone'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
