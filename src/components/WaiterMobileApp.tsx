import React, { useState, useEffect, useRef } from 'react';
import { Waiter, VipTable, WaiterCall, CallType } from '../types/index.ts';
import { callSound } from '../lib/callSound.ts';
import { nativeCallBridge } from '../lib/nativeCallBridge.ts';
import { getServerBaseUrl, setServerBaseUrl } from '../lib/apiConfig.ts';
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
} from 'lucide-react';

interface WaiterMobileAppProps {
  waiters: Waiter[];
  vipTables: VipTable[];
  activeCalls: WaiterCall[];
  onAcceptCall: (callId: string, waiterId: string, waiterName: string) => Promise<void>;
  onCompleteCall: (callId: string) => Promise<void>;
  onToggleDuty: (waiterId: string, onDuty: boolean) => Promise<void>;
  onBackToMenu: () => void;
}

export const WaiterMobileApp: React.FC<WaiterMobileAppProps> = ({
  waiters,
  vipTables,
  activeCalls,
  onAcceptCall,
  onCompleteCall,
  onToggleDuty,
  onBackToMenu,
}) => {
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('four_season_active_waiter_id') || '';
    }
    return '';
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [testRinging, setTestRinging] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => getServerBaseUrl());
  const [serverSavedSuccess, setServerSavedSuccess] = useState(false);
  const lastRungCallId = useRef<string | null>(null);

  // 1-second heartbeat to re-evaluate 45s escalation without needing page reload
  const [, setEscalationTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setEscalationTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Currently logged-in waiter
  const currentWaiter = waiters.find((w) => w.id === selectedWaiterId);

  // Auto-start native Android background Foreground Service when waiter is active & on-duty
  useEffect(() => {
    if (currentWaiter && currentWaiter.is_on_duty) {
      nativeCallBridge.startBackgroundService(currentWaiter.id, currentWaiter.name);
    }
  }, [currentWaiter?.id, currentWaiter?.is_on_duty, currentWaiter?.name]);

  // Save selected waiter to local storage and register push token
  const handleSelectWaiter = (waiter: Waiter) => {
    if (waiter.pin && waiter.pin.trim()) {
      if (pinInput.trim() !== waiter.pin.trim()) {
        setPinError(`Incorrect 4-digit PIN for ${waiter.name}.`);
        return;
      }
    }
    setSelectedWaiterId(waiter.id);
    localStorage.setItem('four_season_active_waiter_id', waiter.id);
    setPinInput('');
    setPinError(null);
    callSound.unlockAudio();
    nativeCallBridge.registerPushToken(waiter.id);
    nativeCallBridge.startBackgroundService(waiter.id, waiter.name);
  };

  const handleLogout = () => {
    callSound.stopWaiterRingtone();
    nativeCallBridge.stopNativeCallAlert();
    nativeCallBridge.stopBackgroundService();
    setSelectedWaiterId('');
    localStorage.removeItem('four_season_active_waiter_id');
  };

  // Find VIP tables assigned specifically to this waiter
  const assignedTables = vipTables.filter(
    (t) => t.assigned_waiter_id === selectedWaiterId
  );

  // Determine which pending calls should RING THIS WAITER'S PHONE
  // Rule:
  // 1. If assigned to this waiter -> RINGS ONLY THIS WAITER'S PHONE!
  // 2. If unassigned OR escalated after 45s -> RINGS ALL ON-DUTY WAITERS!
  // 3. If assigned to another waiter and NOT escalated -> DOES NOT RING THIS WAITER!
  const now = Date.now();
  const pendingCallsForMe = activeCalls.filter((c) => {
    if (c.status !== 'pending') return false;
    if (!currentWaiter?.is_on_duty) return false;

    // If escalated after 45s (either flagged on backend OR 45 seconds elapsed from created_at), ring everyone on duty
    const isEscalatedByTimer = now - new Date(c.created_at).getTime() >= 45000;
    if (c.is_escalated || isEscalatedByTimer) return true;

    if (c.assigned_waiter_id) {
      return c.assigned_waiter_id === selectedWaiterId;
    }
    // Unassigned call: rings to all on-duty waiters
    return true;
  });

  // Calls currently being attended by this waiter
  const inProgressCalls = activeCalls.filter(
    (c) => c.status === 'accepted' && c.accepted_by_waiter_id === selectedWaiterId
  );

  // Other tables pending calls (for awareness, without ring)
  const otherPendingCalls = activeCalls.filter((c) => {
    if (c.status !== 'pending') return false;
    if (c.is_escalated) return false;
    return c.assigned_waiter_id && c.assigned_waiter_id !== selectedWaiterId;
  });

  // Recent completed calls
  const completedCalls = activeCalls
    .filter((c) => c.status === 'completed' || c.status === 'cancelled')
    .slice(0, 10);

  // RINGING AND VIBRATION CONTROLLER EFFECT
  useEffect(() => {
    if (!currentWaiter || !currentWaiter.is_on_duty || isMuted) {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
      lastRungCallId.current = null;
      return;
    }

    if (pendingCallsForMe.length > 0) {
      const topCall = pendingCallsForMe[0];
      // Start real native ringing, lockscreen notification, and continuous pocket vibration
      callSound.startWaiterRingtone();
      nativeCallBridge.triggerNativeCallAlert(topCall);
      lastRungCallId.current = topCall.id;
    } else {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
      lastRungCallId.current = null;
    }

    return () => {
      callSound.stopWaiterRingtone();
      nativeCallBridge.stopNativeCallAlert();
    };
  }, [pendingCallsForMe.length, currentWaiter?.is_on_duty, isMuted, currentWaiter]);

  // Accept call action
  const handleAccept = async (callId: string, waiterId: string, waiterName: string) => {
    callSound.stopWaiterRingtone();
    await nativeCallBridge.stopNativeCallAlert();
    await onAcceptCall(callId, waiterId, waiterName);
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

  // Helper for call icon
  const getCallTypeBadge = (type: CallType) => {
    switch (type) {
      case 'order':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
            <Utensils className="w-3.5 h-3.5" /> Order Request
          </span>
        );
      case 'water':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
            <Droplets className="w-3.5 h-3.5" /> Water / Refill
          </span>
        );
      case 'bill':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
            <Receipt className="w-3.5 h-3.5" /> Bill / Payment
          </span>
        );
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" /> Urgent Assistance
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#D4AF37]/20 text-[#FCF6BA] border border-[#D4AF37]/40 text-xs font-bold">
            <Bell className="w-3.5 h-3.5" /> General Call
          </span>
        );
    }
  };

  // 1. LOGIN / PROFILE SELECTOR SCREEN
  if (!currentWaiter) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-[#141414] border-2 border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] flex items-center justify-center mx-auto mb-3 shadow-lg">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-[#FCF6BA] font-display">
              Four Season Waiter App
            </h1>
            <p className="text-xs text-[#D4AF37]/80 mt-1">
              Select your staff profile to receive direct table calls, phone ringing, and vibrations.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              Choose Your Waiter Profile:
            </label>
            <div className="space-y-2">
              {waiters.map((w) => {
                const assignedCount = vipTables.filter((t) => t.assigned_waiter_id === w.id).length;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (!w.pin || w.pin === '1234') {
                        // Quick login if default pin
                        setSelectedWaiterId(w.id);
                        localStorage.setItem('four_season_active_waiter_id', w.id);
                        callSound.unlockAudio();
                      } else {
                        // Show pin prompt
                        setSelectedWaiterId(w.id);
                      }
                    }}
                    className="w-full p-3.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-white/10 hover:border-[#D4AF37] flex items-center justify-between transition-all text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FCF6BA] font-bold flex items-center justify-center">
                        {w.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#FCF6BA]">{w.name}</div>
                        <div className="text-[11px] text-white/60">
                          {assignedCount} assigned VIP {assignedCount === 1 ? 'table' : 'tables'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          w.is_on_duty
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {w.is_on_duty ? 'On Duty' : 'Off Duty'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/40" />
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

          <div className="pt-2 border-t border-white/10 flex justify-between items-center">
            <button
              onClick={onBackToMenu}
              className="text-xs text-[#D4AF37]/80 hover:text-[#FCF6BA] transition-colors cursor-pointer"
            >
              ← Back to Digital Menu
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
                  onClick={() => setServerUrlInput('http://10.0.2.2:3000')}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
                >
                  Android Emulator
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
                  Staff Waiter
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

            {/* Switch Waiter Profile */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Switch Waiter Profile"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* FULL-SCREEN REAL NATIVE INCOMING CALL OVERLAY (WhatsApp / Telegram Call Style) */}
      {pendingCallsForMe.length > 0 && (
        <NativeIncomingCallScreen
          call={pendingCallsForMe[0]}
          waiterName={currentWaiter.name}
          waiterId={currentWaiter.id}
          isAssignedToMe={pendingCallsForMe[0].assigned_waiter_id === currentWaiter.id}
          onAccept={handleAccept}
          onMute={() => {
            setIsMuted(true);
            callSound.stopWaiterRingtone();
          }}
          isMuted={isMuted}
        />
      )}

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
                onClick={() => setServerUrlInput('http://10.0.2.2:3000')}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 cursor-pointer"
              >
                Android Emulator
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

        {/* CRITICAL INCOMING CALLS (RINGING & VIBRATING FOR ME) */}
        {pendingCallsForMe.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2 animate-pulse">
                <BellRing className="w-5 h-5 text-amber-400 animate-bounce" />
                Incoming VIP Calls ({pendingCallsForMe.length}) — Ringing!
              </h2>
              <span className="text-xs text-amber-300 font-mono">Action Required</span>
            </div>

            {pendingCallsForMe.map((call) => {
              const isAssignedToMe = call.assigned_waiter_id === selectedWaiterId;
              return (
                <div
                  key={call.id}
                  className="bg-gradient-to-r from-amber-950/80 via-[#261505] to-amber-900/60 border-2 border-amber-400 rounded-2xl p-5 shadow-2xl shadow-amber-900/50 animate-pulse relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-400 text-black flex items-center justify-center font-black text-xl shadow-lg shrink-0">
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
                          {isAssignedToMe ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37] text-black font-extrabold uppercase">
                              Your Assigned Table
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              Unassigned (First to accept)
                            </span>
                          )}
                        </div>

                        {call.message && (
                          <div className="mt-2 text-xs text-amber-200 bg-black/40 p-2 rounded-lg border border-amber-500/30">
                            &ldquo;{call.message}&rdquo;
                          </div>
                        )}

                        <div className="text-[11px] text-amber-300/80 mt-2 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Called{' '}
                            {new Date(call.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* BIG ACCEPT BUTTON */}
                    <div className="flex flex-col sm:items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleAccept(call.id, currentWaiter.id, currentWaiter.name)}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-black font-black text-sm shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>I&apos;m on My Way / Accept</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
                className="bg-[#141414] border-2 border-emerald-500/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
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
                  onClick={() => onCompleteCall(call.id)}
                  className="px-4 py-2 rounded-xl bg-[#1e2e1e] hover:bg-[#253a25] text-emerald-300 border border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer self-end sm:self-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Done / Complete</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* OTHER TABLES ACTIVITY (FOR CO-WORKERS) */}
        {otherPendingCalls.length > 0 && (
          <div className="mb-6 space-y-2 opacity-75">
            <h3 className="text-xs uppercase tracking-wider font-bold text-white/60 flex items-center gap-1.5">
              <span>Other Tables Ringing Assigned Waiters ({otherPendingCalls.length})</span>
            </h3>
            {otherPendingCalls.map((call) => {
              const waiter = waiters.find((w) => w.id === call.assigned_waiter_id);
              return (
                <div
                  key={call.id}
                  className="p-3 bg-[#111] border border-white/5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#FCF6BA]">{call.table_number}</span>
                    <span className="text-white/70">{call.table_name}</span>
                    {getCallTypeBadge(call.call_type)}
                  </div>
                  <span className="text-[10px] text-amber-400">
                    Ringing {waiter ? waiter.name : 'assigned waiter'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* NO ACTIVE CALLS STATE */}
        {pendingCallsForMe.length === 0 && inProgressCalls.length === 0 && (
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
