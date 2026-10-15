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
  Minimize2,
  PauseCircle,
  Layers,
} from 'lucide-react';

interface NativeIncomingCallScreenProps {
  call: WaiterCall;
  queuedCalls?: WaiterCall[];
  activeCallId?: string;
  onSelectCall?: (callId: string) => void;
  onHold?: (callId: string, waiterId: string, waiterName: string) => void;
  onMinimize?: () => void;
  waiterName: string;
  waiterId: string;
  isAssignedToMe: boolean;
  onAccept: (callId: string, waiterId: string, waiterName: string) => void;
  onMute: () => void;
  isMuted: boolean;
}

export const NativeIncomingCallScreen: React.FC<NativeIncomingCallScreenProps> = ({
  call,
  queuedCalls = [],
  activeCallId,
  onSelectCall,
  onHold,
  onMinimize,
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

  const getReasonLabel = (c: WaiterCall) => {
    switch (c.call_type) {
      case 'urgent':
        return {
          label: 'URGENT ASSISTANCE NEEDED',
          priorityTag: 'P1 · URGENT',
          icon: AlertTriangle,
          color: 'text-red-400',
          badgeBg: 'bg-red-500/25 border-red-500/60 text-red-200 animate-pulse',
        };
      case 'bill':
        return {
          label: 'REQUESTING BILL & PAYMENT',
          priorityTag: 'P2 · BILL',
          icon: Receipt,
          color: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200',
        };
      case 'order':
        return {
          label: 'READY TO ORDER DISHES',
          priorityTag: 'P3 · ORDER',
          icon: Utensils,
          color: 'text-amber-400',
          badgeBg: 'bg-amber-500/25 border-amber-500/60 text-amber-200',
        };
      case 'water':
        return {
          label: 'WATER & DRINK REFILL',
          priorityTag: 'P4 · WATER',
          icon: Droplets,
          color: 'text-sky-400',
          badgeBg: 'bg-sky-500/25 border-sky-500/60 text-sky-200',
        };
      default:
        return {
          label: 'CALLING WAITER',
          priorityTag: 'P5 · GENERAL',
          icon: PhoneCall,
          color: 'text-[#D4AF37]',
          badgeBg: 'bg-[#D4AF37]/25 border-[#D4AF37]/60 text-[#FCF6BA]',
        };
    }
  };

  const reason = getReasonLabel(call);
  const Icon = reason.icon;
  const currentSelectedId = activeCallId || call.id;

  return (
    <div className="fixed inset-0 z-50 bg-[#070707] flex flex-col justify-between p-4 sm:p-7 animate-fade-in overflow-hidden select-none">
      {/* Background Animated Radar Waves */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <div className="w-[350px] h-[350px] rounded-full border-2 border-[#D4AF37] animate-ping" />
        <div className="w-[550px] h-[550px] rounded-full border border-[#D4AF37]/40 animate-pulse" />
      </div>

      {/* Top Banner and Multi-Call Queue Strip */}
      <div className="relative z-10 text-center pt-1 sm:pt-2">
        <div className="flex items-center justify-between max-w-lg mx-auto mb-2 px-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FCF6BA] text-xs font-black uppercase tracking-widest shadow-lg">
            <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>INCOMING VIP TABLE CALL</span>
          </div>

          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold transition-all cursor-pointer"
              title="Minimize to Floor Grid"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Minimize</span>
            </button>
          )}
        </div>

        {/* MULTI-CALL QUEUE SWITCHER: Displayed when multiple tables are calling at the same time */}
        {queuedCalls.length > 1 && (
          <div className="max-w-lg mx-auto mb-2 p-2 rounded-2xl bg-black/60 border border-[#D4AF37]/40 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#FCF6BA] mb-1.5 px-1">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Layers className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
                <span>{queuedCalls.length} VIP Tables Calling Simultaneously</span>
              </span>
              <span className="text-white/50 text-[10px]">Tap to Switch</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {queuedCalls.map((qc) => {
                const qReason = getReasonLabel(qc);
                const isCurrent = qc.id === currentSelectedId;
                return (
                  <button
                    key={qc.id}
                    type="button"
                    onClick={() => onSelectCall && onSelectCall(qc.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isCurrent
                        ? 'bg-[#D4AF37] text-black border-[#FFF6C5] shadow-lg shadow-[#D4AF37]/30 scale-105'
                        : 'bg-white/5 hover:bg-white/15 text-white/90 border-white/20'
                    }`}
                  >
                    <span className="font-mono">{qc.table_number}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
                        qc.call_type === 'urgent'
                          ? 'bg-red-500 text-white animate-pulse'
                          : isCurrent
                          ? 'bg-black/30 text-black'
                          : 'bg-white/10 text-amber-300'
                      }`}
                    >
                      {qc.call_type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 45-Second Auto-Escalation Countdown */}
        {isAssignedToMe && (
          <div className="mt-2 max-w-xs mx-auto">
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
          <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">
            {call.is_escalated
              ? '⚠️ ESCALATED CALL: Assigned waiter did not answer within 45s!'
              : 'BROADCAST: Unassigned VIP Table Call'}
          </div>
        )}
      </div>

      {/* Center Hero Information */}
      <div className="relative z-10 text-center my-auto flex flex-col items-center">
        {/* Pulsing Bell Icon */}
        <div className="relative mb-5">
          <div className="w-20 h-20 sm:w-26 sm:h-26 rounded-full bg-gradient-to-br from-[#D4AF37] via-[#FBF5B7] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center shadow-2xl shadow-[#D4AF37]/50 animate-bounce">
            <BellRing className="w-10 h-10 sm:w-13 sm:h-13 stroke-[2.5]" />
          </div>
          <div className="absolute -inset-2 rounded-full border-2 border-[#D4AF37] animate-ping opacity-75" />
        </div>

        {/* Table Number & Name */}
        <h1 className="text-4xl sm:text-5xl font-black text-[#FCF6BA] font-mono tracking-tight">
          {call.table_number}
        </h1>
        <h2 className="text-lg sm:text-2xl font-bold text-white/95 mt-1 font-display">
          {call.table_name}
        </h2>

        {/* Reason & Priority Badge */}
        <div className={`mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-extrabold tracking-wide shadow-md ${reason.badgeBg}`}>
          <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono font-black uppercase tracking-wider">
            {reason.priorityTag}
          </span>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${reason.color}`} />
          <span className={reason.color}>{reason.label}</span>
        </div>

        {/* Message Note if present */}
        {call.message && (
          <div className="mt-3 max-w-sm mx-auto bg-black/60 border border-[#D4AF37]/40 rounded-xl p-2.5 text-xs text-amber-200 italic shadow-inner">
            &ldquo;{call.message}&rdquo;
          </div>
        )}

        <div className="mt-2 text-xs text-white/60 flex items-center gap-1 font-mono">
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
      <div className="relative z-10 flex flex-col gap-2.5 max-w-md mx-auto w-full">
        {/* HUGE ACCEPT BUTTON */}
        <button
          type="button"
          onClick={() => onAccept(call.id, waiterId, waiterName)}
          className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 text-black font-black text-base sm:text-xl shadow-2xl shadow-emerald-500/50 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer border-2 border-emerald-300"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/20 flex items-center justify-center">
            <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3.5]" />
          </div>
          <span>I&apos;M ON MY WAY / ACCEPT ({call.table_number})</span>
        </button>

        {/* Secondary controls row: Hold, Mute */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {onHold && (
            <button
              type="button"
              onClick={() => onHold(call.id, waiterId, waiterName)}
              className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Put this table call on hold while attending another customer"
            >
              <PauseCircle className="w-4 h-4 text-amber-400" />
              <span>Put on Hold</span>
            </button>
          )}

          <button
            type="button"
            onClick={onMute}
            className={`py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              !onHold ? 'col-span-2' : ''
            }`}
          >
            {isMuted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-amber-400" />}
            <span>{isMuted ? 'Unmute Ringtone' : 'Silence Sound'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
