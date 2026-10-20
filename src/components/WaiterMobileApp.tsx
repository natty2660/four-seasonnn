import React, { useState, useEffect, useRef } from 'react';
import { Waiter, VipTable, WaiterCall, CallType, CALL_PRIORITY_MAP, getCallPriorityWeight } from '../types/index.ts';
import { callSound } from '../lib/callSound.ts';
import { nativeCallBridge } from '../lib/nativeCallBridge.ts';
import { getServerBaseUrl, setServerBaseUrl, PRODUCTION_BACKEND_URL, apiFetch } from '../lib/apiConfig.ts';
import { NativeIncomingCallScreen } from './NativeIncomingCallScreen.tsx';
import { NativeAppInstallModal } from './NativeAppInstallModal.tsx';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Vibrate,
  CheckCircle2,
  Clock,
  User,
  ChevronRight,
  LogOut,
  Crown,
  AlertTriangle,
  Utensils,
  Droplets,
  Receipt,
  Check,
  Smartphone,
  Settings,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Delete,
  X,
  Zap,
  Flame,
  ArrowUpRight,
} from 'lucide-react';

interface WaiterMobileAppProps {
  waiters: Waiter[];
  vipTables: VipTable[];
  activeCalls: WaiterCall[];
  onAcceptCall: (callId: string, waiterId: string, waiterName: string) => Promise<void>;
  onHoldCall?: (callId: string, waiterId: string, waiterName: string, reason?: string) => Promise<void>;
  onCompleteCall: (callId: string) => Promise<void>;
  onStatusChange?: (
    callId: string,
    status: 'accepted' | 'hold' | 'completed' | 'pending' | 'missed',
    waiterId: string,
    waiterName: string,
    reason?: string
  ) => Promise<void>;
  onToggleDuty: (waiterId: string, onDuty: boolean) => Promise<void>;
  onBackToMenu: () => void;
}

export const WaiterMobileApp: React.FC<WaiterMobileAppProps> = ({
  waiters,
  vipTables,
  activeCalls,
  onAcceptCall,
  onHoldCall,
  onCompleteCall,
  onStatusChange,
  onToggleDuty,
  onBackToMenu,
}) => {
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('four_season_active_waiter_id') || '';
      const unlocked = sessionStorage.getItem('four_season_waiter_session_unlocked');
      if (saved && unlocked === saved && waiters.some((w) => w.id === saved)) {
        return saved;
      }
    }
    return waiters[0]?.id || '';
  });

  const [pendingWaiterId, setPendingWaiterId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('four_season_active_waiter_id') || '';
      if (saved && waiters.some((w) => w.id === saved)) {
        return saved;
      }
    }
    return waiters[0]?.id || '';
  });

  // Locked by default! Requires staff PIN to unlock access to the waiter app
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('four_season_active_waiter_id') || '';
      const unlocked = sessionStorage.getItem('four_season_waiter_session_unlocked');
      if (saved && unlocked === saved && waiters.some((w) => w.id === saved)) {
        return false;
      }
    }
    return true;
  });

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [shakeKeypad, setShakeKeypad] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(false);
  const [testRinging, setTestRinging] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getServerBaseUrl());
  const [serverSavedSuccess, setServerSavedSuccess] = useState(false);
  const [selectedIncomingCallId, setSelectedIncomingCallId] = useState<string | null>(null);
  const [isIncomingScreenMinimized, setIsIncomingScreenMinimized] = useState<boolean>(false);
  const lastRungCallId = useRef<string | null>(null);
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'accept' | 'hold' | 'complete' } | null>(null);

  // 1-second heartbeat to re-evaluate 45s escalation without needing page reload
  const [, setEscalationTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setEscalationTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ensure valid pending & selected waiter profile when waiters load or update
  useEffect(() => {
    if (waiters.length > 0) {
      setPendingWaiterId((prev) => {
        if (!prev || !waiters.some((w) => w.id === prev)) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('four_season_active_waiter_id') || '' : '';
          if (saved && waiters.some((w) => w.id === saved)) return saved;
          return waiters[0].id;
        }
        return prev;
      });

      setSelectedWaiterId((prev) => {
        if (!prev || !waiters.some((w) => w.id === prev)) {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('four_season_active_waiter_id') || '' : '';
          const unlocked = typeof window !== 'undefined' ? sessionStorage.getItem('four_season_waiter_session_unlocked') || '' : '';
          if (saved && unlocked === saved && waiters.some((w) => w.id === saved)) {
            setIsLocked(false);
            return saved;
          }
          return waiters[0].id;
        }
        return prev;
      });
    }
  }, [waiters]);

  // Currently logged-in waiter
  const currentWaiter = waiters.find((w) => w.id === selectedWaiterId);

  // Authenticate and unlock waiter app with PIN
  const verifyPin = (pinToTest: string, waiterId?: string) => {
    const targetId = waiterId || pendingWaiterId || selectedWaiterId;
    const waiter = waiters.find((w) => w.id === targetId);
    if (!waiter) {
      setPinError('Please select your staff profile first.');
      return;
    }

    const expectedPin = waiter.pin?.trim() || '1234';

    if (pinToTest === expectedPin) {
      setSelectedWaiterId(waiter.id);
      setPendingWaiterId(waiter.id);
      setIsLocked(false);
      setPinInput('');
      setPinError(null);
      setShakeKeypad(false);
      if (typeof window !== 'undefined') {
        localStorage.setItem('four_season_active_waiter_id', waiter.id);
        sessionStorage.setItem('four_season_waiter_session_unlocked', waiter.id);
      }
      callSound.unlockAudio();
    } else {
      setPinError(`Access Denied: Incorrect PIN for ${waiter.name}.`);
      setShakeKeypad(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setTimeout(() => setShakeKeypad(false), 500);
      setTimeout(() => setPinInput(''), 600);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    setPinError(null);

    const targetId = pendingWaiterId || selectedWaiterId;
    const targetWaiter = waiters.find((w) => w.id === targetId);
    const expectedLength = targetWaiter?.pin?.trim().length || 4;

    if (next.length === expectedLength) {
      verifyPin(next, targetId);
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handleClear = () => {
    setPinInput('');
    setPinError(null);
  };

  const handleSelectPendingWaiter = (waiterId: string) => {
    setPendingWaiterId(waiterId);
    setPinInput('');
    setPinError(null);
  };

  // Immediate Lock: secures the screen when stepping away
  const handleLock = () => {
    callSound.stopWaiterRingtone();
    nativeCallBridge.stopNativeCallAlert();
    setIsLocked(true);
    setPinInput('');
    setPinError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('four_season_waiter_session_unlocked');
    }
  };

  const handleLogout = () => {
    callSound.stopWaiterRingtone();
    nativeCallBridge.stopNativeCallAlert();
    nativeCallBridge.stopBackgroundService();
    setSelectedWaiterId('');
    setPendingWaiterId('');
    setIsLocked(true);
    setPinInput('');
    setPinError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('four_season_active_waiter_id');
      sessionStorage.removeItem('four_season_waiter_session_unlocked');
    }
  };

  // Physical keyboard listener for PIN entry
  useEffect(() => {
    if (!isLocked && currentWaiter) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      } else if (e.key === 'Enter') {
        if (pinInput.length > 0) {
          verifyPin(pinInput);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, currentWaiter, pendingWaiterId, selectedWaiterId, pinInput, waiters]);

  // Find VIP tables assigned specifically to this waiter
  const assignedTables = vipTables.filter(
    (t) => t.assigned_waiter_id === selectedWaiterId
  );

  // Determine which pending calls should RING THIS WAITER'S PHONE
  // Rule:
  // 1. If assigned to this waiter -> RINGS ONLY THIS WAITER'S PHONE!
  // 2. If unassigned OR escalated after 45s -> RINGS ALL ON-DUTY WAITERS!
  // 3. If assigned to a deleted waiter or off-duty waiter -> RINGS ALL ON-DUTY WAITERS IMMEDIATELY!
  // 4. If assigned to another on-duty waiter and NOT escalated -> DOES NOT RING THIS WAITER!
  const now = Date.now();
  // All active pending calls in the restaurant, sorted by priority ranking (Urgent > Bill > Order > Water > General) then newest first
  const allPendingCalls = activeCalls
    .filter((c) => c.status === 'pending')
    .sort((a, b) => {
      // 1. High-priority calls always jump to top
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
      // 2. Newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Calls that specifically trigger ringing and high-priority alerts for this waiter
  // High-priority calls always jump to the top of the ringing alert queue
  const pendingCallsForMe = allPendingCalls
    .filter((c) => {
      if (!currentWaiter?.is_on_duty) return false;

      // If escalated after 45s (either flagged on backend OR 45 seconds elapsed from created_at), ring everyone on duty
      const isEscalatedByTimer = now - new Date(c.created_at).getTime() >= 45000;
      if (c.is_escalated || isEscalatedByTimer) return true;

      if (c.assigned_waiter_id) {
        // Check if assigned waiter actually exists in staff roster
        const assigned = waiters.find((w) => w.id === c.assigned_waiter_id);
        if (!assigned || !assigned.is_active || !assigned.is_on_duty) {
          // Ghost waiter or off duty -> ring all on-duty waiters immediately!
          return true;
        }
        return c.assigned_waiter_id === selectedWaiterId;
      }
      // Unassigned call: rings to all on-duty waiters
      return true;
    })
    .sort((a, b) => {
      // 1. High priority calls always jump to top of waiter's dashboard
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;

      // 2. If same priority, my directly assigned tables come first
      const aIsMine = a.assigned_waiter_id === selectedWaiterId ? 1 : 0;
      const bIsMine = b.assigned_waiter_id === selectedWaiterId ? 1 : 0;
      if (bIsMine !== aIsMine) return bIsMine - aIsMine;

      // 3. Newest first
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Counts of pending calls by priority level for the live dashboard hierarchy
  const urgentCount = allPendingCalls.filter((c) => c.call_type === 'urgent').length;
  const billCount = allPendingCalls.filter((c) => c.call_type === 'bill').length;
  const orderCount = allPendingCalls.filter((c) => c.call_type === 'order').length;
  const waterCount = allPendingCalls.filter((c) => c.call_type === 'water').length;

  // Calls currently being attended by this waiter (sorted by priority then newest)
  const inProgressCalls = activeCalls
    .filter(
      (c) =>
        c.status === 'accepted' &&
        (c.accepted_by_waiter_id === selectedWaiterId || c.accepted_by_name === currentWaiter?.name)
    )
    .sort((a, b) => {
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Other active restaurant calls (assigned to co-workers, or active while off-duty)
  const otherPendingCalls = allPendingCalls
    .filter((c) => !pendingCallsForMe.some((myCall) => myCall.id === c.id))
    .sort((a, b) => {
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Calls on HOLD (waiting because waiter was attending another customer)
  const heldCalls = activeCalls
    .filter((c) => c.status === 'hold')
    .sort((a, b) => {
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Calls MISSED (timed out after 60s without answer, displaying on waiter's list)
  const missedCalls = activeCalls
    .filter((c) => c.status === 'missed')
    .sort((a, b) => {
      const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.missed_at || b.created_at).getTime() - new Date(a.missed_at || a.created_at).getTime();
    });

  // Recent completed calls sorted chronologically by completion time descending (newest on top)
  const completedCalls = activeCalls
    .filter((c) => c.status === 'completed' || c.status === 'cancelled')
    .sort(
      (a, b) =>
        new Date(b.completed_at || b.created_at).getTime() -
        new Date(a.completed_at || a.created_at).getTime()
    )
    .slice(0, 25);

  // Track silenced/acknowledged calls to eliminate repeated re-ringing on simple re-renders
  const [silencedCallIds, setSilencedCallIds] = useState<Set<string>>(new Set());

  // RINGING AND VIBRATION CONTROLLER EFFECT
  const activeTopCall = pendingCallsForMe[0] || null;
  const activeTopCallId = activeTopCall?.id || null;

  useEffect(() => {
    if (!currentWaiter || !currentWaiter.is_on_duty || isMuted || !activeTopCallId) {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
      return;
    }

    // Only start ringtone if this call hasn't already been silenced and hasn't already rung
    if (activeTopCall && !silencedCallIds.has(activeTopCall.id) && lastRungCallId.current !== activeTopCall.id) {
      callSound.startWaiterRingtone();
      nativeCallBridge.triggerNativeCallAlert(activeTopCall);
      lastRungCallId.current = activeTopCall.id;
    }
  }, [activeTopCallId, currentWaiter?.is_on_duty, isMuted, currentWaiter?.id, silencedCallIds]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
    };
  }, []);

  const handleSilenceCall = (callId: string) => {
    callSound.stopWaiterRingtone();
    nativeCallBridge.stopNativeCallAlert();
    setSilencedCallIds((prev) => new Set(prev).add(callId));
  };

  // Accept call action
  const handleAccept = async (callId: string, waiterId: string, waiterName: string) => {
    callSound.stopWaiterRingtone();
    await nativeCallBridge.stopNativeCallAlert();
    setSilencedCallIds((prev) => new Set(prev).add(callId));
    await onAcceptCall(callId, waiterId, waiterName);
  };

  // Hold call action
  const handleHold = async (callId: string, waiterId: string, waiterName: string) => {
    callSound.stopWaiterRingtone();
    await nativeCallBridge.stopNativeCallAlert();
    setSilencedCallIds((prev) => new Set(prev).add(callId));
    if (onHoldCall) {
      await onHoldCall(callId, waiterId, waiterName);
    } else {
      await apiFetch(`/api/waiter-calls/${callId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
      });
    }
  };

  // Dedicated Call Status Changer handler - communicates directly to VIP customer
  const handleStatusChange = async (
    callId: string,
    targetStatus: 'accepted' | 'hold' | 'completed',
    tableNumber?: string
  ) => {
    if (!currentWaiter) return;
    callSound.stopWaiterRingtone();
    await nativeCallBridge.stopNativeCallAlert();
    setSilencedCallIds((prev) => new Set(prev).add(callId));

    if (onStatusChange) {
      await onStatusChange(callId, targetStatus, currentWaiter.id, currentWaiter.name);
    } else if (targetStatus === 'accepted') {
      await handleAccept(callId, currentWaiter.id, currentWaiter.name);
    } else if (targetStatus === 'hold') {
      await handleHold(callId, currentWaiter.id, currentWaiter.name);
    } else if (targetStatus === 'completed') {
      await onCompleteCall(callId);
    }

    if (targetStatus === 'accepted') {
      setStatusToast({
        message: `✅ Table ${tableNumber || ''} ACCEPTED! VIP Customer notified: ${currentWaiter.name} is on the way immediately.`,
        type: 'accept',
      });
    } else if (targetStatus === 'hold') {
      setStatusToast({
        message: `⏳ Table ${tableNumber || ''} placed on Hold. Customer informed they are queued.`,
        type: 'hold',
      });
    } else if (targetStatus === 'completed') {
      setStatusToast({
        message: `✓ Table ${tableNumber || ''} call marked completed.`,
        type: 'complete',
      });
    }

    setTimeout(() => {
      setStatusToast(null);
    }, 4500);
  };

  // Dedicated Status Changer component for all call states - communicates directly to VIP customer
  const renderStatusChanger = (call: WaiterCall) => {
    const isAccepted = call.status === 'accepted';
    const isHold = call.status === 'hold';
    const isCompleted = call.status === 'completed';

    return (
      <div className="mt-3 pt-2.5 border-t border-white/10 w-full">
        <div className="flex items-center justify-between text-[11px] mb-1.5 flex-wrap gap-1">
          <span className="text-[#D4AF37] font-black uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#D4AF37]" /> Dedicated Status Changer:
          </span>
          <span className="text-white/60 font-mono text-[10px] flex items-center gap-1">
            <span>Customer Sees:</span>
            <span
              className={`font-black uppercase px-2 py-0.5 rounded text-[9px] shadow-sm flex items-center gap-1 ${
                isAccepted
                  ? 'bg-emerald-400 text-black ring-1 ring-emerald-300 animate-pulse'
                  : isHold
                  ? 'bg-amber-400 text-black ring-1 ring-amber-300'
                  : call.status === 'missed'
                  ? 'bg-rose-500 text-white'
                  : 'bg-red-500/80 text-white animate-pulse'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {isAccepted
                ? 'Accepted (On Way)'
                : isHold
                ? 'On Hold (Queued)'
                : call.status === 'missed'
                ? 'Missed Call'
                : 'Paging / Calling'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* 1. Accept Status Button (Direct to VIP Customer) */}
          <button
            type="button"
            onClick={() => handleStatusChange(call.id, 'accepted', call.table_number)}
            className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isAccepted
                ? 'bg-emerald-400 text-black ring-2 ring-emerald-200 shadow-lg shadow-emerald-950/60 font-black'
                : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-2 border-emerald-500/60 hover:border-emerald-400 active:scale-95 shadow-sm shadow-emerald-950/40'
            }`}
            title="Accept this call immediately and notify VIP customer that you are coming"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isAccepted ? '✓ Accepted' : 'Accept (On Way)'}</span>
          </button>

          {/* 2. Hold Status Button */}
          <button
            type="button"
            onClick={() => handleStatusChange(call.id, 'hold', call.table_number)}
            className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isHold
                ? 'bg-amber-400 text-black ring-2 ring-amber-200 shadow-lg shadow-amber-950/60 font-black'
                : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 hover:border-amber-400 active:scale-95'
            }`}
            title="Place call on hold and notify VIP customer they are next in line"
          >
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isHold ? '⏳ On Hold' : 'Put on Hold'}</span>
          </button>

          {/* 3. Complete Status Button */}
          <button
            type="button"
            onClick={() => handleStatusChange(call.id, 'completed', call.table_number)}
            className={`py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isCompleted
                ? 'bg-blue-500 text-white font-black'
                : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/15 hover:border-white/30 active:scale-95'
            }`}
            title="Mark call completed"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isCompleted ? '✓ Done' : 'Complete'}</span>
          </button>
        </div>
      </div>
    );
  };

  // Test ring function
  const handleTestRing = () => {
    callSound.unlockAudio();
    if (testRinging) {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
      setTestRinging(false);
    } else {
      setTestRinging(true);
      callSound.startWaiterRingtone();
      nativeCallBridge.triggerNativeCallAlert({
        id: 'test_ring_' + Date.now(),
        table_id: 'test',
        table_number: 'VIP-TEST',
        table_name: 'Test Device Call',
        call_type: 'urgent',
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      // Fire hardware native alarm and continuous vibration on device
      nativeCallBridge.testDeviceHardware();
      setTimeout(() => {
        callSound.stopWaiterRingtone();
        nativeCallBridge.stopNativeCallAlert();
        setTestRinging(false);
      }, 5000);
    }
  };

  // Helper for priority ranking badge
  const getCallTypeBadge = (type: CallType) => {
    switch (type) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/25 text-red-200 border border-red-500/50 text-xs font-black shadow-sm shadow-red-500/20 animate-pulse">
            <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[10px] font-black uppercase tracking-wider">
              P1
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-300" />
            <span>Urgent Assistance</span>
          </span>
        );
      case 'bill':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-500/50 text-xs font-black shadow-sm shadow-emerald-500/20">
            <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider">
              P2
            </span>
            <Receipt className="w-3.5 h-3.5 text-emerald-300" />
            <span>Bill & Payment</span>
          </span>
        );
      case 'order':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/25 text-amber-200 border border-amber-500/50 text-xs font-black shadow-sm shadow-amber-500/20">
            <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider">
              P3
            </span>
            <Utensils className="w-3.5 h-3.5 text-amber-300" />
            <span>Order Request</span>
          </span>
        );
      case 'water':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/25 text-sky-200 border border-sky-500/50 text-xs font-black shadow-sm shadow-sky-500/20">
            <span className="px-1.5 py-0.2 rounded bg-sky-400 text-black text-[10px] font-black uppercase tracking-wider">
              P4
            </span>
            <Droplets className="w-3.5 h-3.5 text-sky-300" />
            <span>Water / Refill</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D4AF37]/25 text-[#FCF6BA] border border-[#D4AF37]/50 text-xs font-black shadow-sm shadow-[#D4AF37]/20">
            <span className="px-1.5 py-0.2 rounded bg-[#D4AF37] text-black text-[10px] font-black uppercase tracking-wider">
              P5
            </span>
            <Bell className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>General Call</span>
          </span>
        );
    }
  };

  // Helper for priority card visual theme
  const getCallPriorityCardTheme = (type: CallType) => {
    switch (type) {
      case 'urgent':
        return {
          wrapper: 'bg-gradient-to-r from-red-950/90 via-[#330d0d] to-red-900/60 border-2 border-red-500/90 shadow-2xl shadow-red-900/60 animate-pulse',
          numberBg: 'bg-red-500 text-white',
          topBanner: 'bg-red-500 text-white',
          priorityLabel: 'P1 · HIGHEST PRIORITY (URGENT)',
        };
      case 'bill':
        return {
          wrapper: 'bg-gradient-to-r from-emerald-950/80 via-[#0e2718] to-emerald-900/50 border-2 border-emerald-400/80 shadow-xl shadow-emerald-900/40',
          numberBg: 'bg-emerald-400 text-black',
          topBanner: 'bg-emerald-500/30 text-emerald-200 border-b border-emerald-500/30',
          priorityLabel: 'P2 · HIGH PRIORITY (BILL)',
        };
      case 'order':
        return {
          wrapper: 'bg-gradient-to-r from-amber-950/80 via-[#261505] to-amber-900/60 border-2 border-amber-400/80 shadow-xl shadow-amber-900/40',
          numberBg: 'bg-amber-400 text-black',
          topBanner: 'bg-amber-500/30 text-amber-200 border-b border-amber-500/30',
          priorityLabel: 'P3 · MEDIUM PRIORITY (ORDER)',
        };
      case 'water':
        return {
          wrapper: 'bg-gradient-to-r from-sky-950/80 via-[#081e2b] to-sky-900/50 border-2 border-sky-400/70 shadow-xl shadow-sky-900/30',
          numberBg: 'bg-sky-400 text-black',
          topBanner: 'bg-sky-500/30 text-sky-200 border-b border-sky-500/30',
          priorityLabel: 'P4 · STANDARD PRIORITY (WATER)',
        };
      default:
        return {
          wrapper: 'bg-gradient-to-r from-[#211a0c] via-[#1a1408] to-[#120f06] border-2 border-[#D4AF37]/60 shadow-lg shadow-black/40',
          numberBg: 'bg-[#D4AF37] text-black',
          topBanner: 'bg-[#D4AF37]/20 text-[#FCF6BA] border-b border-[#D4AF37]/30',
          priorityLabel: 'P5 · GENERAL PRIORITY',
        };
    }
  };

  // 1. LOCKED STAFF SECURITY GATE / LOGIN SCREEN
  if (isLocked || !currentWaiter) {
    const activePendingWaiter =
      waiters.find((w) => w.id === (pendingWaiterId || selectedWaiterId)) ||
      (waiters.length === 1 ? waiters[0] : null);

    return (
      <div className="min-h-screen bg-[#080808] text-[#EDEDED] flex flex-col justify-center items-center p-4 selection:bg-[#D4AF37] selection:text-black">
        <div className="w-full max-w-md bg-[#121212] border-2 border-[#D4AF37]/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle gold security ambient glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#AA771C]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Security Status Header */}
          <div className="text-center mb-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#201C10] to-[#121008] border border-[#D4AF37]/50 text-[#FCF6BA] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#D4AF37]/10">
              <Lock className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>Restricted Access · Terminal Locked</span>
            </div>
            <h1 className="text-2xl font-black text-[#FCF6BA] font-display">
              VIP Reservation Desk
            </h1>
            <p className="text-xs text-[#D4AF37]/80 mt-1 max-w-xs mx-auto">
              Central VIP call reception & floor dispatch. Enter PIN (1234) to unlock live table alerts.
            </p>
          </div>

          {/* Urgent Active Call Notification on Lock Screen */}
          {allPendingCalls.length > 0 && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-400 text-amber-200 animate-pulse shadow-2xl shadow-amber-950/70 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-amber-400 animate-bounce" />
                  <span className="font-black text-sm text-[#FCF6BA]">
                    {allPendingCalls.length} ACTIVE VIP {allPendingCalls.length === 1 ? 'CALL' : 'CALLS'} WAITING!
                  </span>
                </div>
                <span className="text-[10px] bg-amber-400 text-black font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Action Required
                </span>
              </div>
              <div className="mt-2 text-xs font-semibold text-white/90">
                {allPendingCalls.map((c) => `${c.table_number} (${c.table_name})`).join(' · ')}
              </div>
              <div className="mt-1 text-[11px] text-amber-300">
                Unlock below to accept and attend to table
              </div>
            </div>
          )}

          {/* If a waiter is selected: Show PIN Keypad */}
          {activePendingWaiter ? (
            <div className="space-y-5 relative z-10">
              {/* Selected Staff Card */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-black font-black text-base flex items-center justify-center shadow">
                    {activePendingWaiter.name[0]}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-[#FCF6BA]">
                      {activePendingWaiter.name}
                    </div>
                    <div className="text-[11px] text-white/50 flex items-center gap-1.5">
                      <span>Staff Member</span>
                      <span>·</span>
                      <span className={activePendingWaiter.is_on_duty ? 'text-emerald-400 font-bold' : 'text-white/40'}>
                        {activePendingWaiter.is_on_duty ? 'On Duty' : 'Off Duty'}
                      </span>
                    </div>
                  </div>
                </div>

                {waiters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingWaiterId('');
                      setPinInput('');
                      setPinError(null);
                    }}
                    className="text-xs text-[#D4AF37] hover:underline font-bold px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* 4-Digit Masked PIN Indicators */}
              <div
                className={`flex flex-col items-center justify-center transition-all ${
                  shakeKeypad ? 'animate-bounce' : ''
                }`}
              >
                <div className="flex items-center gap-3 py-2">
                  {[0, 1, 2, 3].map((index) => {
                    const isFilled = pinInput.length > index;
                    return (
                      <div
                        key={index}
                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                          isFilled
                            ? 'bg-[#D4AF37] ring-4 ring-[#D4AF37]/30 scale-110 shadow-lg shadow-[#D4AF37]/50'
                            : 'bg-black/60 border-2 border-white/20'
                        }`}
                      />
                    );
                  })}
                </div>

                {pinError ? (
                  <div className="mt-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-center">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                ) : (
                  <div className="mt-1 text-[11px] text-white/50 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-[#D4AF37]" />
                    <span>Enter 4-digit PIN for {activePendingWaiter.name}</span>
                  </div>
                )}
              </div>

              {/* Tactical Numeric Touch Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-13 rounded-2xl bg-[#1c1c1c] hover:bg-[#262626] active:bg-[#D4AF37] active:text-black border border-white/10 hover:border-[#D4AF37]/50 text-white font-mono font-bold text-xl flex items-center justify-center transition-all shadow-md cursor-pointer select-none"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleClear}
                  className="h-13 rounded-2xl bg-[#161616] hover:bg-[#222] border border-white/10 text-white/60 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer select-none"
                  title="Clear PIN"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="h-13 rounded-2xl bg-[#1c1c1c] hover:bg-[#262626] active:bg-[#D4AF37] active:text-black border border-white/10 hover:border-[#D4AF37]/50 text-white font-mono font-bold text-xl flex items-center justify-center transition-all shadow-md cursor-pointer select-none"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-13 rounded-2xl bg-[#161616] hover:bg-[#222] border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all cursor-pointer select-none"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {/* Unlock Action Button */}
              <button
                type="button"
                onClick={() => verifyPin(pinInput)}
                disabled={pinInput.length === 0}
                className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                  pinInput.length > 0
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black hover:brightness-110 active:scale-95'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                <Unlock className="w-4 h-4 stroke-[2.5]" />
                <span>Unlock Reservation Desk</span>
              </button>

              <div className="text-[10px] text-white/40 text-center">
                Secure staff access. Enter your personal staff PIN to proceed.
              </div>
            </div>
          ) : (
            /* If no waiter is selected yet: Profile Picker */
            <div className="space-y-3 mb-6 relative z-10">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                Select Your Waiter Profile to Unlock:
              </label>

              <div className="space-y-2">
                {waiters.map((w) => {
                  const assignedCount = vipTables.filter((t) => t.assigned_waiter_id === w.id).length;
                  return (
                    <button
                      key={w.id}
                      onClick={() => handleSelectPendingWaiter(w.id)}
                      className="w-full p-3.5 rounded-2xl bg-[#1a1a1a] hover:bg-[#242424] border border-white/10 hover:border-[#D4AF37] flex items-center justify-between transition-all text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCF6BA] font-black flex items-center justify-center group-hover:bg-[#D4AF37] group-hover:text-black transition-colors">
                          {w.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#FCF6BA]">{w.name}</div>
                          <div className="text-[11px] text-white/50">
                            {assignedCount} dedicated VIP {assignedCount === 1 ? 'table' : 'tables'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            w.is_on_duty
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {w.is_on_duty ? 'On Duty' : 'Off Duty'}
                        </span>
                        <Lock className="w-3.5 h-3.5 text-[#D4AF37]" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {waiters.length === 0 && (
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 text-center">
                  No waiters configured yet. Please configure waiters in the Admin Dashboard.
                </div>
              )}
            </div>
          )}

          {/* Bottom Navigation & Utilities */}
          <div className="pt-4 mt-6 border-t border-white/10 flex justify-between items-center relative z-10">
            <button
              onClick={onBackToMenu}
              className="text-xs text-[#D4AF37]/80 hover:text-[#FCF6BA] transition-colors cursor-pointer"
            >
              ← Back to Customer Menu
            </button>
            <button
              onClick={() => setIsServerModalOpen(true)}
              className="text-xs text-white/50 hover:text-[#FCF6BA] flex items-center gap-1 transition-colors cursor-pointer"
              title="Configure Server URL"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Server Connection</span>
            </button>
          </div>
        </div>

        {/* SERVER URL CONFIGURATION MODAL (WHEN NOT LOGGED IN) */}
        {isServerModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#161616] border border-[#D4AF37]/40 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="font-bold text-base text-[#FCF6BA]">Server Connection Setup</h3>
                </div>
                <button
                  onClick={() => {
                    setIsServerModalOpen(false);
                    setServerSavedSuccess(false);
                  }}
                  className="text-white/40 hover:text-white text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-white/70 mt-3">
                When running the APK on an Android phone, point this to your computer or cloud server URL (e.g. Wi-Fi IP <span className="font-mono text-[#FCF6BA]">http://192.168.1.X:3000</span>).
              </p>

              <div className="mt-4">
                <label className="block text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1">
                  Server URL:
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="e.g. http://192.168.1.100:3000"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0e0e0e] border border-white/20 text-white text-xs font-mono focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setServerUrlInput(window.location.origin)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
                >
                  Current Origin
                </button>
                <button
                  type="button"
                  onClick={() => setServerUrlInput(PRODUCTION_BACKEND_URL)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
                >
                  Production Cloud Server
                </button>
              </div>

              {serverSavedSuccess && (
                <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold text-center">
                  ✓ Server URL saved successfully!
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsServerModalOpen(false);
                    setServerSavedSuccess(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServerBaseUrl(serverUrlInput);
                    setServerSavedSuccess(true);
                    setTimeout(() => {
                      setIsServerModalOpen(false);
                      setServerSavedSuccess(false);
                    }, 1000);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black text-xs font-black shadow-lg cursor-pointer"
                >
                  Save URL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. ACTIVE WAITER WORKSPACE (MOBILE APP)
  return (
    <div className="min-h-screen bg-[#080808] text-[#EDEDED] flex flex-col font-sans pb-16 selection:bg-[#D4AF37] selection:text-black">
      {/* Top Mobile Header */}
      <header className="sticky top-0 z-40 bg-[#0e0e0e]/95 backdrop-blur-md border-b border-[#D4AF37]/30 px-4 py-3 shadow-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center font-black text-sm shadow">
              {currentWaiter.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-[#FCF6BA] truncate max-w-[150px] sm:max-w-none">
                  {currentWaiter.name}
                </h1>
                <span className="text-[10px] bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 px-2 py-0.5 rounded-full font-bold">
                  {waiters.length === 1 ? 'Central Dispatch' : 'Staff Waiter'}
                </span>
              </div>
              <div className="text-[11px] text-white/60 flex items-center gap-1.5 mt-0.5">
                <span>{assignedTables.length} Assigned VIP Tables</span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            {/* Server Settings button */}
            <button
              onClick={() => setIsServerModalOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/20 transition-colors cursor-pointer"
              title="Backend Server Connection"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Install Native APK button */}
            <button
              onClick={() => setIsInstallModalOpen(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#D4AF37] border border-[#D4AF37]/30 transition-colors cursor-pointer"
              title="Download Android APK & Native Info"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            {/* Quick Lock Terminal Button */}
            <button
              onClick={handleLock}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Lock Waiter App (PIN Required to Re-enter)"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>

            {/* Duty Status Switcher */}
            <button
              onClick={() => onToggleDuty(currentWaiter.id, !currentWaiter.is_on_duty)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer ${
                currentWaiter.is_on_duty
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  currentWaiter.is_on_duty ? 'bg-black animate-pulse' : 'bg-white/40'
                }`}
              />
              <span>{currentWaiter.is_on_duty ? 'On Duty' : 'On Break'}</span>
            </button>

            {/* Sign Out / Switch Waiter Profile */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Log Out & Switch Profile"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Minimized Ringing Queue Banner */}
      {isIncomingScreenMinimized && pendingCallsForMe.length > 0 && (
        <div className="bg-gradient-to-r from-amber-600 via-[#D4AF37] to-amber-700 text-black px-4 py-2.5 flex items-center justify-between shadow-xl border-b border-black/20 sticky top-[61px] z-30 animate-pulse">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-4 h-4 animate-bounce text-black shrink-0" />
            <span className="font-black text-xs uppercase tracking-wide truncate">
              {pendingCallsForMe.length} VIP {pendingCallsForMe.length === 1 ? 'Table' : 'Tables'} Calling!
            </span>
            <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
              Top: {pendingCallsForMe[0].table_number} ({pendingCallsForMe[0].call_type})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsIncomingScreenMinimized(false)}
            className="px-3 py-1 rounded-xl bg-black text-[#FCF6BA] font-extrabold text-xs shadow hover:bg-neutral-900 transition-all cursor-pointer shrink-0"
          >
            Open Call Screen
          </button>
        </div>
      )}

      {/* FULL-SCREEN REAL NATIVE INCOMING CALL OVERLAY (WhatsApp / Telegram Call Style) */}
      {!isIncomingScreenMinimized && pendingCallsForMe.length > 0 && (() => {
        const activeCall =
          pendingCallsForMe.find((c) => c.id === selectedIncomingCallId) ||
          pendingCallsForMe[0];
        return (
          <NativeIncomingCallScreen
            call={activeCall}
            queuedCalls={pendingCallsForMe}
            activeCallId={activeCall.id}
            onSelectCall={(id) => setSelectedIncomingCallId(id)}
            onHold={handleHold}
            onMinimize={() => setIsIncomingScreenMinimized(true)}
            waiterName={currentWaiter.name}
            waiterId={currentWaiter.id}
            isAssignedToMe={activeCall.assigned_waiter_id === currentWaiter.id}
            onAccept={handleAccept}
            onMute={() => {
              setIsMuted(true);
              callSound.stopWaiterRingtone();
            }}
            isMuted={isMuted}
          />
        );
      })()}

      {/* NATIVE APP APK & INSTALLATION GUIDE MODAL */}
      <NativeAppInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      {/* SERVER URL CONFIGURATION MODAL (WHEN LOGGED IN) */}
      {isServerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161616] border border-[#D4AF37]/40 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-bold text-base text-[#FCF6BA]">Server Connection Setup</h3>
              </div>
              <button
                onClick={() => {
                  setIsServerModalOpen(false);
                  setServerSavedSuccess(false);
                }}
                className="text-white/40 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/70 mt-3">
              Configure backend host for the Android app. Changes immediately update the native background foreground service.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1">
                Backend Server URL:
              </label>
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="e.g. http://192.168.1.100:3000"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0e0e0e] border border-white/20 text-white text-xs font-mono focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setServerUrlInput(window.location.origin)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
              >
                Current Origin
              </button>
              <button
                type="button"
                onClick={() => setServerUrlInput(PRODUCTION_BACKEND_URL)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
              >
                Production Cloud Server
              </button>
            </div>

            {serverSavedSuccess && (
              <div className="mt-3 p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold text-center">
                ✓ Server URL saved! Background service reconnected.
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsServerModalOpen(false);
                  setServerSavedSuccess(false);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setServerBaseUrl(serverUrlInput);
                  if (currentWaiter && currentWaiter.is_on_duty) {
                    nativeCallBridge.startBackgroundService(currentWaiter.id, currentWaiter.name);
                  }
                  setServerSavedSuccess(true);
                  setTimeout(() => {
                    setIsServerModalOpen(false);
                    setServerSavedSuccess(false);
                  }, 1000);
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-black text-xs font-black shadow-lg cursor-pointer"
              >
                Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Waiter Dashboard Body */}
      <main className="max-w-3xl mx-auto w-full px-4 pt-4 flex-1">
        {/* Live Status Change Alert Toast */}
        {statusToast && (
          <div
            className={`mb-4 p-3.5 rounded-2xl shadow-xl border text-xs font-black flex items-center justify-between gap-2 transition-all animate-bounce ${
              statusToast.type === 'accept'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-emerald-950/80 ring-1 ring-emerald-400/50'
                : statusToast.type === 'hold'
                ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-amber-950/80 ring-1 ring-amber-400/50'
                : 'bg-blue-950/90 border-blue-400 text-blue-200 shadow-blue-950/80 ring-1 ring-blue-400/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>{statusToast.message}</span>
            </div>
            <button
              onClick={() => setStatusToast(null)}
              className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Device Sound & Vibration Readiness Deck */}
        <div className="bg-[#141414] border border-[#D4AF37]/30 rounded-2xl p-4 shadow-lg mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                currentWaiter.is_on_duty ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'
              }`}
            >
              <Vibrate className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#FCF6BA] flex items-center gap-1.5">
                <span>Ringtone & Vibration Alert System</span>
                <span className="text-[10px] text-emerald-400 font-normal">Active</span>
              </div>
              <p className="text-[11px] text-white/60">
                {currentWaiter.is_on_duty
                  ? 'Assigned VIP table calls will ring and vibrate this device.'
                  : 'You are currently on break. Turn on duty to receive calls.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={handleTestRing}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                testRinging
                  ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                  : 'bg-[#1e1e1e] text-[#FCF6BA] border-white/10 hover:border-[#D4AF37]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{testRinging ? 'Ringing... (Stop)' : 'Test Sound'}</span>
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-[#1e1e1e] text-white/70 border-white/10'
              }`}
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Assigned VIP Tables Pills */}
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wider font-extrabold text-[#D4AF37] mb-2 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-[#D4AF37]" />
            My Responsible VIP Tables ({assignedTables.length}):
          </div>
          <div className="flex flex-wrap gap-2">
            {assignedTables.map((t) => (
              <span
                key={t.id}
                className="px-3 py-1 rounded-xl bg-[#181818] border border-[#D4AF37]/40 text-[#FCF6BA] text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-[#D4AF37]">{t.table_number}</span>
                <span className="text-white/80 font-normal truncate max-w-[140px]">{t.name}</span>
              </span>
            ))}
            {assignedTables.length === 0 && (
              <span className="text-xs text-white/50 italic">
                No specific tables assigned yet. You will receive general broadcast calls from unassigned VIP tables.
              </span>
            )}
          </div>
        </div>

        {/* PRIORITY RANKING HIERARCHY BAR */}
        <div className="bg-[#141414] border border-[#D4AF37]/30 rounded-2xl p-3.5 mb-5 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-black uppercase tracking-wider text-[#FCF6BA]">
                Priority Dispatch Ranking
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#FCF6BA] font-bold border border-[#D4AF37]/40">
                Auto-Prioritized
              </span>
            </div>
            <span className="text-[11px] text-white/50">
              High-priority calls (Urgent &gt; Bill &gt; Order &gt; Water) automatically jump to the top
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                urgentCount > 0
                  ? 'bg-red-500/20 border-red-500 text-red-200 animate-pulse shadow-md shadow-red-900/30'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={`w-4 h-4 ${urgentCount > 0 ? 'text-red-400' : 'text-red-400/60'}`} />
                <span className="text-xs font-black">1. Urgent</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  urgentCount > 0 ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60'
                }`}
              >
                {urgentCount}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                billCount > 0
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-900/20'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Receipt className={`w-4 h-4 ${billCount > 0 ? 'text-emerald-400' : 'text-emerald-400/60'}`} />
                <span className="text-xs font-black">2. Bill</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  billCount > 0 ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                {billCount}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                orderCount > 0
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-900/20'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Utensils className={`w-4 h-4 ${orderCount > 0 ? 'text-amber-400' : 'text-amber-400/60'}`} />
                <span className="text-xs font-black">3. Order</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  orderCount > 0 ? 'bg-amber-400 text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                {orderCount}
              </span>
            </div>

            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                waterCount > 0
                  ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow-md shadow-sky-900/20'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Droplets className={`w-4 h-4 ${waterCount > 0 ? 'text-sky-400' : 'text-sky-400/60'}`} />
                <span className="text-xs font-black">4. Water</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                  waterCount > 0 ? 'bg-sky-400 text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                {waterCount}
              </span>
            </div>
          </div>
        </div>

        {/* CRITICAL INCOMING CALLS (RINGING & VIBRATING FOR ME) */}
        {pendingCallsForMe.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 animate-pulse">
                <BellRing className="w-5 h-5 text-amber-400 animate-bounce" />
                Incoming VIP Calls ({pendingCallsForMe.length}) — Ringing!
              </h2>
              <span className="text-xs text-amber-300 font-mono font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Ranked Queue
              </span>
            </div>

            {pendingCallsForMe.map((call, index) => {
              const isAssignedToMe = call.assigned_waiter_id === selectedWaiterId;
              const theme = getCallPriorityCardTheme(call.call_type);
              const isUrgent = call.call_type === 'urgent';

              return (
                <div
                  key={call.id}
                  className={`${theme.wrapper} rounded-2xl p-5 relative overflow-hidden transition-all`}
                >
                  {/* Priority & Queue Position Pill */}
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10 text-xs">
                    <span className="font-mono font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/40 font-black text-[#FCF6BA] border border-white/10">
                        Queue #{index + 1}
                      </span>
                      <span className={isUrgent ? 'text-red-300 animate-pulse font-bold' : 'text-white/80'}>
                        {theme.priorityLabel}
                      </span>
                    </span>
                    {isAssignedToMe ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37] text-black font-extrabold uppercase shrink-0">
                        Your Assigned Table
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 shrink-0">
                        Unassigned (First to accept)
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl ${theme.numberBg} flex items-center justify-center font-black text-xl shadow-lg shrink-0`}>
                        {call.table_number.replace('VIP-', '')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-base text-[#FCF6BA] font-mono">
                            {call.table_number}
                          </span>
                          <span className="text-xs font-semibold text-white/90">
                            {call.table_name}
                          </span>
                          {getCallTypeBadge(call.call_type)}
                        </div>

                        {call.message && (
                          <div className="mt-2 text-xs text-amber-200 bg-black/50 p-2 rounded-lg border border-white/10 font-medium">
                            &ldquo;{call.message}&rdquo;
                          </div>
                        )}

                        <div className="text-[11px] text-white/70 mt-2 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            Called{' '}
                            {new Date(call.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          {call.is_escalated && (
                            <span className="text-red-400 font-bold bg-red-500/20 px-1.5 py-0.5 rounded text-[10px] border border-red-500/40">
                              ⚡ Escalated Broadcast
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* BIG ACCEPT / HOLD BUTTON */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => handleSilenceCall(call.id)}
                          className="px-3.5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FCF6BA] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/10 shrink-0"
                          title="Silence ringtone alarm without accepting"
                        >
                          <VolumeX className="w-4 h-4 text-amber-300" />
                          <span className="hidden sm:inline">Silence</span>
                        </button>
                        <button
                          onClick={() => handleStatusChange(call.id, 'accepted', call.table_number)}
                          className={`flex-1 sm:flex-initial px-6 py-3.5 rounded-xl font-black text-sm shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isUrgent
                              ? 'bg-gradient-to-r from-red-500 via-red-600 to-amber-500 text-white shadow-red-900/50'
                              : 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-black shadow-emerald-900/50'
                          }`}
                        >
                          <Check className="w-5 h-5 stroke-[3]" />
                          <span>I&apos;m on My Way / Accept</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Call Status Changer Bar */}
                  {renderStatusChanger(call)}
                </div>
              );
            })}
          </div>
        )}

        {/* MISSED VIP CALLS (ATTENTION REQUIRED) */}
        {missedCalls.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                Missed VIP Calls ({missedCalls.length}) — Attention Required
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                Customer Waiting
              </span>
            </div>

            {missedCalls.map((call) => {
              return (
                <div
                  key={call.id}
                  className="bg-[#181111] border-2 border-rose-500/60 rounded-2xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-rose-950/80 text-rose-300 font-mono font-black text-lg flex items-center justify-center border border-rose-500/40 shrink-0">
                        {call.table_number.replace('VIP-', '')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#FCF6BA]">{call.table_number}</span>
                          <span className="text-white/80 text-xs font-semibold">{call.table_name}</span>
                          {getCallTypeBadge(call.call_type)}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 border border-rose-500/40 font-bold">
                            Missed Call
                          </span>
                        </div>
                        {call.message && (
                          <p className="text-xs text-amber-200/90 mt-1 italic">&ldquo;{call.message}&rdquo;</p>
                        )}
                        <div className="text-[10px] text-white/50 mt-1 flex items-center gap-2">
                          <span>
                            Missed at{' '}
                            {new Date(call.missed_at || call.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleStatusChange(call.id, 'accepted', call.table_number)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Attend Missed Call</span>
                      </button>
                      <button
                        onClick={() => onCompleteCall(call.id)}
                        className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium text-xs border border-white/10 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Call Status Changer Bar */}
                  {renderStatusChanger(call)}
                </div>
              );
            })}
          </div>
        )}

        {/* QUEUED ON HOLD CALLS */}
        {heldCalls.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Queued on Hold ({heldCalls.length}) — Customer Waiting
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Next in Line
              </span>
            </div>

            {heldCalls.map((call) => (
              <div
                key={call.id}
                className="bg-[#19150e] border-2 border-amber-500/50 rounded-2xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-950/80 text-amber-300 font-mono font-black text-lg flex items-center justify-center border border-amber-500/40 shrink-0">
                      {call.table_number.replace('VIP-', '')}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#FCF6BA]">{call.table_number}</span>
                        <span className="text-white/80 text-xs font-semibold">{call.table_name}</span>
                        {getCallTypeBadge(call.call_type)}
                        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-400 text-black font-black uppercase tracking-wider shadow-sm">
                          <Clock className="w-3 h-3 stroke-[3]" />
                          Hold
                        </span>
                      </div>
                      {call.hold_reason && (
                        <p className="text-[11px] text-amber-300 font-semibold mt-1">
                          📌 {call.hold_reason}
                        </p>
                      )}
                      <p className="text-xs text-amber-200/80 mt-0.5">
                        Customer is queued waiting for you to complete your current table.
                      </p>
                      {call.message && (
                        <p className="text-xs text-white/70 mt-0.5 italic">&ldquo;{call.message}&rdquo;</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleStatusChange(call.id, 'accepted', call.table_number)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer self-end sm:self-center shrink-0"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Accept Now</span>
                  </button>
                </div>

                {/* Dedicated Call Status Changer Bar */}
                {renderStatusChanger(call)}
              </div>
            ))}
          </div>
        )}

        {/* IN-PROGRESS REQUESTS (ACCEPTED & ATTENDING) */}
        {inProgressCalls.length > 0 && (
          <div className="mb-6 space-y-3">
            <h2 className="text-xs uppercase tracking-wider font-extrabold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              In-Progress Calls Attending Now ({inProgressCalls.length})
            </h2>

            {inProgressCalls.map((call) => (
              <div
                key={call.id}
                className="bg-[#141414] border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/30">
                      {call.table_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#FCF6BA]">{call.table_name}</span>
                        {getCallTypeBadge(call.call_type)}
                      </div>
                      {call.message && (
                        <p className="text-xs text-white/70 mt-0.5">&ldquo;{call.message}&rdquo;</p>
                      )}
                      <span className="text-[10px] text-white/50 block mt-1">
                        Accepted at{' '}
                        {call.accepted_at
                          ? new Date(call.accepted_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'just now'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStatusChange(call.id, 'completed', call.table_number)}
                    className="px-4 py-2 rounded-xl bg-[#1e2e1e] hover:bg-[#253a25] text-emerald-300 border border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end sm:self-center"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Done / Complete</span>
                  </button>
                </div>

                {/* Dedicated Call Status Changer Bar */}
                {renderStatusChanger(call)}
              </div>
            ))}
          </div>
        )}

        {/* OTHER TABLES ACTIVITY (FOR CO-WORKERS / ASSIST MODE) */}
        {otherPendingCalls.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#D4AF37] flex items-center justify-between">
              <span>Active Restaurant Calls ({otherPendingCalls.length})</span>
              <span className="text-[10px] text-white/50 normal-case font-normal">
                {currentWaiter.is_on_duty ? 'Co-worker tables — Tap to assist' : 'You are off duty'}
              </span>
            </h3>
            {otherPendingCalls.map((call) => {
              const waiter = waiters.find((w) => w.id === call.assigned_waiter_id);
              const theme = getCallPriorityCardTheme(call.call_type);
              const isUrgent = call.call_type === 'urgent';

              return (
                <div
                  key={call.id}
                  className={`p-4 bg-[#141414] border rounded-2xl flex flex-col gap-3 shadow-md transition-all ${
                    isUrgent
                      ? 'border-red-500/80 shadow-red-950/40 animate-pulse'
                      : 'border-[#D4AF37]/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${theme.numberBg} font-mono font-bold flex items-center justify-center border border-white/10 shrink-0`}>
                        {call.table_number.replace('VIP-', '')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#FCF6BA]">{call.table_number}</span>
                          <span className="text-white/80 text-xs font-semibold">{call.table_name}</span>
                          {getCallTypeBadge(call.call_type)}
                        </div>
                        {call.message && (
                          <p className="text-xs text-white/70 mt-1 italic">&ldquo;{call.message}&rdquo;</p>
                        )}
                        <div className="text-[11px] text-white/50 mt-1 flex items-center gap-2 flex-wrap">
                          <span>
                            {waiter ? `Assigned to ${waiter.name}` : 'Unassigned (General Broadcast)'}
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(call.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {call.is_escalated && (
                            <span className="text-red-400 font-bold bg-red-500/20 px-1.5 py-0.5 rounded text-[10px] border border-red-500/40">
                              ⚡ Escalated Broadcast
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStatusChange(call.id, 'accepted', call.table_number)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer self-end sm:self-center shrink-0"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Accept &amp; Assist</span>
                    </button>
                  </div>

                  {/* Dedicated Call Status Changer Bar */}
                  {renderStatusChanger(call)}
                </div>
              );
            })}
          </div>
        )}

        {/* NO ACTIVE CALLS STATE */}
        {allPendingCalls.length === 0 && inProgressCalls.length === 0 && (
          <div className="p-8 text-center bg-[#111] border border-white/10 rounded-2xl my-4">
            <div className="w-12 h-12 rounded-full bg-white/5 text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#FCF6BA]">All VIP Tables Are Attended</h3>
            <p className="text-xs text-white/60 mt-1 max-w-sm mx-auto">
              Your device is actively listening. When a guest touches the call button at your assigned tables, your phone will ring and vibrate immediately.
            </p>
          </div>
        )}

        {/* RECENT CALLS HISTORY */}
        {completedCalls.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-[#D4AF37] mb-3">
              Recent Completed Calls:
            </h3>
            <div className="space-y-2">
              {completedCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-3 bg-[#121212] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[#FCF6BA]">{call.table_number}</span>
                    <span className="text-white/80">{call.table_name}</span>
                    <span className="text-[10px] text-white/50">({call.call_type})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      Attended by {call.accepted_by_name || 'Staff'}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date(call.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Return to digital menu */}
      <footer className="max-w-3xl mx-auto w-full px-4 pt-6 text-center">
        <button
          onClick={onBackToMenu}
          className="text-xs text-[#D4AF37]/80 hover:text-[#FCF6BA] hover:underline cursor-pointer"
        >
          ← Return to Customer Digital Menu
        </button>
      </footer>
    </div>
  );
};
