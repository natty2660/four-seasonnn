import { useState, useEffect, useCallback } from 'react';
import {
  Restaurant,
  Category,
  MenuItem,
  VipTable,
  Waiter,
  WaiterCall,
  CallType,
  CallStatus,
  getCallPriorityWeight,
} from './types/index.ts';
import {
  loadClientState,
  saveClientState,
  DatabaseState,
} from './lib/storage.ts';
import {
  startVipSession,
  getVipSession,
  isVipSessionValid,
} from './lib/vipSession.ts';
import { Capacitor } from '@capacitor/core';
import { apiFetch, isNativeApp, getApiUrl } from './lib/apiConfig.ts';
import { PublicMenu } from './components/PublicMenu.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { QRModal } from './components/QRModal.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { ConfidentialLogoCropModal } from './components/ConfidentialLogoCropModal.tsx';
import { OriginalPhotoEnhancerModal } from './components/OriginalPhotoEnhancerModal.tsx';
import { VipTableCustomerView } from './components/VipTableCustomerView.tsx';
import { VipTableSelectorModal } from './components/VipTableSelectorModal.tsx';
import { WaiterMobileApp } from './components/WaiterMobileApp.tsx';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() => loadClientState());
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isLogoCropperOpen, setIsLogoCropperOpen] = useState(false);
  const [isPhotoEnhancerOpen, setIsPhotoEnhancerOpen] = useState(false);
  const [isVipSelectorOpen, setIsVipSelectorOpen] = useState(false);
  const [selectedVipTable, setSelectedVipTable] = useState<VipTable | null>(null);

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('prime_cafe_admin_token');
    }
    return null;
  });
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      // On native Capacitor Android APK, default app launch path to the Waiter Mobile App
      if (isNativeApp()) {
        const isViewingMenu = sessionStorage.getItem('waiter_viewing_menu') === 'true';
        if (!isViewingMenu || path === '/' || path === '/index.html' || path === '' || !path) {
          return '/waiter';
        }
      }
      return path;
    }
    return '/menu/prime-cafe';
  });

  // Enforce Waiter Mobile App route upon initial load of native Capacitor Android APK
  useEffect(() => {
    if (isNativeApp()) {
      const isViewingMenu = typeof window !== 'undefined' && sessionStorage.getItem('waiter_viewing_menu') === 'true';
      const p = typeof window !== 'undefined' ? window.location.pathname : '';
      if (!isViewingMenu || p === '/' || p === '/index.html' || p === '' || !p) {
        setCurrentPath('/waiter');
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/waiter');
        }
      }
    }
  }, []);

  // Keep route synced with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

/**
 * Authoritative reconciliation for live waiter calls.
 * Ensures newer confirmed statuses (e.g. accepted, completed) are never reversed by older polling responses.
 * Completely eliminates flickering, disappearing calls, duplicate rings, and keeps accepted status locked.
 */
function reconcileWaiterCalls(prevCalls: WaiterCall[], incomingCalls: WaiterCall[]): WaiterCall[] {
  const prevMap = new Map((prevCalls || []).map((c) => [c.id, c]));
  const mergedMap = new Map<string, WaiterCall>();

  // Lock duration for locally accepted calls: 120 seconds (generously absorbs polling delays, mobile network lag, or server queue delay)
  const ACCEPT_LOCK_WINDOW_MS = 120000;
  // Terminal status lock duration (completed/cancelled shouldn't resurrect to pending or accepted within this window)
  const TERMINAL_LOCK_WINDOW_MS = 45000;
  // Preservation window for newly created/pending calls missing from incoming payload
  const NEW_CALL_PERSIST_WINDOW_MS = 60000;

  const now = Date.now();

  // 1. Process all incoming authoritative calls from backend
  for (const inc of incomingCalls || []) {
    const prev = prevMap.get(inc.id);
    if (!prev) {
      mergedMap.set(inc.id, inc);
      continue;
    }

    // SCENARIO 1: Call was completed or cancelled locally, but server poll returned pending, hold, or missed
    const wasCompletedLocally = prev.status === 'completed' || prev.status === 'cancelled';
    const isStaleIncomingActive = inc.status === 'pending' || inc.status === 'hold';
    const completedAtTime = prev.completed_at ? new Date(prev.completed_at).getTime() : now;
    const isWithinTerminalLock = now - completedAtTime < TERMINAL_LOCK_WINDOW_MS;

    if (wasCompletedLocally && isStaleIncomingActive && isWithinTerminalLock) {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // SCENARIO 2: Call was placed on HOLD locally, but server returned pending
    const wasHoldLocally = prev.status === 'hold';
    const heldAtTime = prev.held_at ? new Date(prev.held_at).getTime() : now;
    const isWithinHoldLock = now - heldAtTime < ACCEPT_LOCK_WINDOW_MS;

    if (wasHoldLocally && inc.status === 'pending' && isWithinHoldLock) {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'hold',
        held_at: prev.held_at || new Date().toISOString(),
        hold_reason: prev.hold_reason || 'Waiter currently attending another customer',
        accepted_by_waiter_id: prev.accepted_by_waiter_id || inc.accepted_by_waiter_id || null,
        accepted_by_name: prev.accepted_by_name || inc.accepted_by_name || 'Staff Member',
      });
      continue;
    }

    // SCENARIO 3: Call was marked MISSED (timed out). Stale pending must NEVER resurrect it to ring again!
    const wasMissed = prev.status === 'missed';
    if (wasMissed && inc.status === 'pending') {
      mergedMap.set(inc.id, prev);
      continue;
    }

    // SCENARIO 4: Server returned 'pending' but call was already accepted locally
    // Strongly lock to 'accepted' while within accept window (only if server returned pending)
    const wasAcceptedLocally = prev.status === 'accepted';
    const acceptedAtTime = prev.accepted_at ? new Date(prev.accepted_at).getTime() : now;
    const isWithinAcceptLock = now - acceptedAtTime < ACCEPT_LOCK_WINDOW_MS;

    if (wasAcceptedLocally && inc.status === 'pending' && isWithinAcceptLock) {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'accepted',
        accepted_by_waiter_id: prev.accepted_by_waiter_id || inc.accepted_by_waiter_id || null,
        accepted_by_name: prev.accepted_by_name || inc.accepted_by_name || 'Staff Member',
        accepted_at: prev.accepted_at || new Date().toISOString(),
      });
      continue;
    }

    // SCENARIO 5: Server returned 'accepted' - waiter accepted the call! Lock it in firmly!
    if (inc.status === 'accepted') {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'accepted',
        accepted_by_waiter_id: inc.accepted_by_waiter_id || prev.accepted_by_waiter_id || null,
        accepted_by_name: inc.accepted_by_name || prev.accepted_by_name || 'Staff Member',
        accepted_at: inc.accepted_at || prev.accepted_at || new Date().toISOString(),
      });
      continue;
    }

    // SCENARIO 6: Server returned 'hold' - retain hold state and metadata across all devices
    if (inc.status === 'hold') {
      mergedMap.set(inc.id, {
        ...inc,
        status: 'hold',
        held_at: inc.held_at || prev.held_at || new Date().toISOString(),
        hold_reason: inc.hold_reason || prev.hold_reason || 'Waiter currently attending another customer',
        accepted_by_waiter_id: inc.accepted_by_waiter_id || prev.accepted_by_waiter_id || null,
        accepted_by_name: inc.accepted_by_name || prev.accepted_by_name || 'Staff Member',
      });
      continue;
    }

    // Otherwise, accept authoritative server state (including 'missed', 'completed', etc.)
    mergedMap.set(inc.id, inc);
  }

  // 2. Flicker prevention & history preservation:
  // - Brand-new local pending/hold calls created in the last 60 seconds missing from backend snapshot
  // - Completed and cancelled call history so historical logs never abruptly vanish
  for (const prev of prevCalls || []) {
    if (!mergedMap.has(prev.id)) {
      if (prev.status === 'pending' || prev.status === 'hold') {
        const timeRef = new Date(prev.created_at).getTime();
        if (now - timeRef < 60000) {
          mergedMap.set(prev.id, prev);
        }
      } else if (prev.status === 'completed' || prev.status === 'cancelled' || prev.status === 'missed') {
        // Permanently preserve completed/cancelled history in dashboard records
        mergedMap.set(prev.id, prev);
      }
    }
  }

  // 3. Stably sort by lifecycle status: accepted (4000) > pending (3000) > hold (2500) > missed (1500) > resolved (1000)
  const getStatusOrder = (status: string): number => {
    if (status === 'accepted') return 4000;
    if (status === 'pending') return 3000;
    if (status === 'hold') return 2500;
    if (status === 'missed') return 1500;
    return 1000;
  };

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => {
    // 1. Prioritize active pending calls first, followed by in-progress accepted, then resolved
    const statusDiff = getStatusOrder(b.status) - getStatusOrder(a.status);
    if (statusDiff !== 0) return statusDiff;

    // 2. Prioritize by call type priority ranking: Urgent (500) > Bill (400) > Order (300) > Water (200) > General (100)
    const priorityDiff = getCallPriorityWeight(b.call_type) - getCallPriorityWeight(a.call_type);
    if (priorityDiff !== 0) return priorityDiff;

    // 3. Tie-breaker: newest calls first
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return result;
}

  // Fetch / revalidate menu, live waiters, VIP tables, and active calls from authoritative backend
  const refreshFromAPI = useCallback(async () => {
    try {
      const [menuRes, waitersRes, tablesRes, callsRes] = await Promise.allSettled([
        apiFetch('/api/menu/prime-cafe'),
        apiFetch('/api/waiters'),
        apiFetch('/api/vip-tables'),
        apiFetch('/api/waiter-calls'),
      ]);

      let freshMenuData: any = null;
      if (menuRes.status === 'fulfilled' && menuRes.value.ok) {
        freshMenuData = await menuRes.value.json().catch(() => null);
      }

      let freshWaiters: Waiter[] | null = null;
      if (waitersRes.status === 'fulfilled' && waitersRes.value.ok) {
        const w = await waitersRes.value.json().catch(() => null);
        if (Array.isArray(w)) freshWaiters = w;
      }

      let freshTables: VipTable[] | null = null;
      if (tablesRes.status === 'fulfilled' && tablesRes.value.ok) {
        const t = await tablesRes.value.json().catch(() => null);
        if (Array.isArray(t)) freshTables = t;
      }

      let freshCalls: WaiterCall[] | null = null;
      if (callsRes.status === 'fulfilled' && callsRes.value.ok) {
        const c = await callsRes.value.json().catch(() => null);
        if (Array.isArray(c)) freshCalls = c;
      }

      setDbState((prevState) => {
        const mergedCalls = freshCalls
          ? reconcileWaiterCalls(prevState.waiter_calls || [], freshCalls)
          : prevState.waiter_calls;
        const mergedWaiters = freshWaiters !== null ? freshWaiters : prevState.waiters;

        const freshState: DatabaseState = {
          ...prevState,
          ...(freshMenuData?.restaurant && freshMenuData?.categories && freshMenuData?.items
            ? {
                restaurant: freshMenuData.restaurant,
                categories: freshMenuData.categories,
                items: freshMenuData.items,
              }
            : {}),
          waiters: mergedWaiters,
          ...(freshTables ? { vip_tables: freshTables } : {}),
          waiter_calls: mergedCalls,
          last_updated: freshMenuData?.generated_at || new Date().toISOString(),
        };
        saveClientState(freshState);
        return freshState;
      });
    } catch (err) {
      // Offline / serverless cold boot fallback: local client state already loaded
      console.warn('API refresh notice (fallback to local state):', err);
    }
  }, []);

  useEffect(() => {
    refreshFromAPI();
  }, [refreshFromAPI]);

  // Real-time synchronization: Server-Sent Events (SSE) stream + controlled polling fallback
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const pollCalls = async () => {
      try {
        const [callsRes, waitersRes] = await Promise.allSettled([
          apiFetch('/api/waiter-calls'),
          apiFetch('/api/waiters'),
        ]);

        let calls: WaiterCall[] | null = null;
        if (callsRes.status === 'fulfilled' && callsRes.value.ok) {
          const c = await callsRes.value.json().catch(() => null);
          if (Array.isArray(c)) calls = c;
        }

        let waiters: Waiter[] | null = null;
        if (waitersRes.status === 'fulfilled' && waitersRes.value.ok) {
          const w = await waitersRes.value.json().catch(() => null);
          if (Array.isArray(w)) waiters = w;
        }

        if (calls || waiters) {
          setDbState((prev) => {
            const mergedCalls = calls
              ? reconcileWaiterCalls(prev.waiter_calls || [], calls)
              : prev.waiter_calls;
            const mergedWaiters = waiters !== null ? waiters : prev.waiters;

            const hasCallDiff = JSON.stringify(prev.waiter_calls) !== JSON.stringify(mergedCalls);
            const hasWaiterDiff = JSON.stringify(prev.waiters) !== JSON.stringify(mergedWaiters);

            if (hasCallDiff || hasWaiterDiff) {
              const next: DatabaseState = {
                ...prev,
                waiter_calls: mergedCalls,
                waiters: mergedWaiters,
              };
              saveClientState(next);
              return next;
            }
            return prev;
          });
        }
      } catch {
        // Silent catch for offline or initial boot
      }
    };

    // 1. Initial revalidation
    pollCalls();

    // 2. Connect to Server-Sent Events (SSE) stream for instant real-time pushes
    try {
      const streamUrl = getApiUrl('/api/waiter-calls/stream');
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && (data.calls || data.waiters)) {
            setDbState((prev) => {
              const mergedCalls = Array.isArray(data.calls)
                ? reconcileWaiterCalls(prev.waiter_calls || [], data.calls)
                : prev.waiter_calls;
              const mergedWaiters = Array.isArray(data.waiters) ? data.waiters : prev.waiters;

              const hasCallDiff = JSON.stringify(prev.waiter_calls) !== JSON.stringify(mergedCalls);
              const hasWaiterDiff = JSON.stringify(prev.waiters) !== JSON.stringify(mergedWaiters);

              if (hasCallDiff || hasWaiterDiff) {
                const next: DatabaseState = {
                  ...prev,
                  waiter_calls: mergedCalls,
                  waiters: mergedWaiters,
                };
                saveClientState(next);
                return next;
              }
              return prev;
            });
          }
        } catch {}
      };

      eventSource.onerror = () => {
        // If SSE stream is interrupted, controlled polling maintains real-time sync
      };
    } catch (e) {
      console.warn('SSE stream setup note:', e);
    }

    // 3. Controlled polling interval (resilient diagnostic & fallback)
    pollInterval = setInterval(pollCalls, 3000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  // State update handlers that persist immediately to localStorage & server
  const handleUpdateRestaurant = (updated: Restaurant) => {
    const next: DatabaseState = {
      ...dbState,
      restaurant: updated,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    if (adminToken) {
      apiFetch('/api/restaurants', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(updated),
      }).catch(() => {});
    }
  };

  const handleUpdateCategories = (categories: Category[]) => {
    const next: DatabaseState = {
      ...dbState,
      categories,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    if (adminToken) {
      apiFetch('/api/categories/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ categories }),
      }).catch(() => {});
    }
  };

  const handleUpdateItems = (items: MenuItem[]) => {
    const next: DatabaseState = {
      ...dbState,
      items,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    if (adminToken) {
      apiFetch('/api/items/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }
  };

  const handleUpdateTables = (tables: VipTable[]) => {
    const next: DatabaseState = {
      ...dbState,
      vip_tables: tables,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    // Sync VIP tables to authoritative backend
    apiFetch('/api/vip-tables/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vip_tables: tables }),
    }).catch((err) => console.warn('Sync tables note:', err));
  };

  const handleUpdateWaiters = (waiters: Waiter[]) => {
    const next: DatabaseState = {
      ...dbState,
      waiters,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    // Sync waiters to authoritative backend so deletions & additions persist permanently
    apiFetch('/api/waiters/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waiters }),
    }).catch((err) => console.warn('Sync waiters note:', err));
  };

  // VIP Customer: Place Call
  const handlePlaceCall = async (
    tableId: string,
    callType: CallType,
    message?: string
  ): Promise<boolean> => {
    // Security check: 4-hour VIP session expiration
    if (!isVipSessionValid(tableId)) {
      console.warn('VIP session for table', tableId, 'has expired after 4 hours. Call blocked.');
      return false;
    }

    try {
      const res = await apiFetch('/api/waiter-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, call_type: callType, message }),
      });
      if (res.ok) {
        const call: WaiterCall = await res.json();
        setDbState((prev) => {
          // Archive previous pending, hold, or missed calls for this table in local state
          const updatedPrevCalls = (prev.waiter_calls || []).map((c) =>
            (c.table_id === call.table_id || c.table_number === call.table_number) &&
            c.id !== call.id &&
            (c.status === 'pending' || c.status === 'hold' || c.status === 'missed')
              ? { ...c, status: 'completed' as const, completed_at: new Date().toISOString() }
              : c
          );
          const nextCalls = [
            call,
            ...updatedPrevCalls.filter((c) => c.id !== call.id),
          ].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const next = {
            ...prev,
            waiter_calls: nextCalls,
          };
          saveClientState(next);
          return next;
        });
        return true;
      }
    } catch (e) {
      console.warn('Fallback offline place call:', e);
    }
    return false;
  };

  // Waiter & Admin: Accept Call (Auto-places on HOLD if waiter already attending another table)
  const handleAcceptCall = async (
    callId: string,
    waiterId: string,
    waiterName: string
  ): Promise<void> => {
    const acceptedAt = new Date().toISOString();

    // Check if this waiter already has another active accepted call in progress
    const alreadyAttendingCall = (dbState.waiter_calls || []).find(
      (c) =>
        c.id !== callId &&
        c.status === 'accepted' &&
        (c.accepted_by_waiter_id === waiterId || c.assigned_waiter_id === waiterId)
    );

    const isPlacingOnHold = Boolean(alreadyAttendingCall);
    const targetStatus: CallStatus = isPlacingOnHold ? 'hold' : 'accepted';
    const heldAt = isPlacingOnHold ? acceptedAt : null;
    const holdReason = isPlacingOnHold
      ? `Waiter ${waiterName || 'Staff'} is attending Table ${alreadyAttendingCall?.table_number}`
      : null;

    // 1. Immediately update UI state optimistically so action responds with 0 latency
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).map((c) =>
          c.id === callId
            ? {
                ...c,
                status: targetStatus,
                accepted_by_waiter_id: waiterId,
                accepted_by_name: waiterName,
                accepted_at: isPlacingOnHold ? c.accepted_at || null : acceptedAt,
                held_at: isPlacingOnHold ? heldAt : null,
                hold_reason: isPlacingOnHold ? holdReason : null,
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });

    // 2. Authoritative backend synchronization
    try {
      if (isPlacingOnHold) {
        await apiFetch(`/api/waiter-calls/${callId}/hold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            waiter_id: waiterId,
            waiter_name: waiterName,
            hold_reason: holdReason,
          }),
        }).catch(async () => {
          await apiFetch(`/api/waiter-calls/${callId}/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              waiter_id: waiterId,
              waiter_name: waiterName,
              force_hold: true,
              hold_reason: holdReason,
            }),
          });
        });
      } else {
        await apiFetch(`/api/waiter-calls/${callId}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
        });
      }
    } catch (e) {
      console.warn('Accept call network error:', e);
    }
  };

  // Waiter & Admin: Complete Call (Releases and promotes next queued held call)
  const handleCompleteCall = async (callId: string): Promise<void> => {
    const completedAt = new Date().toISOString();
    setDbState((prev) => {
      const currentCall = (prev.waiter_calls || []).find((c) => c.id === callId);
      const completingWaiterId = currentCall?.accepted_by_waiter_id;

      let promotedHeld = false;
      const nextCalls = (prev.waiter_calls || []).map((c) => {
        if (c.id === callId) {
          return {
            ...c,
            status: 'completed' as const,
            completed_at: completedAt,
          };
        }
        if (
          !promotedHeld &&
          c.status === 'hold' &&
          (!c.accepted_by_waiter_id || c.accepted_by_waiter_id === completingWaiterId)
        ) {
          promotedHeld = true;
          return {
            ...c,
            status: 'pending' as const,
            held_at: null,
            hold_reason: null,
          };
        }
        return c;
      });

      const next = {
        ...prev,
        waiter_calls: nextCalls,
      };
      saveClientState(next);
      return next;
    });

    try {
      await apiFetch(`/api/waiter-calls/${callId}/complete`, { method: 'POST' });
    } catch (e) {
      console.warn('Complete call network error:', e);
    }
  };

  // Customer & Admin: Cancel Call
  const handleCancelCall = async (callId: string): Promise<void> => {
    const completedAt = new Date().toISOString();
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).map((c) =>
          c.id === callId
            ? {
                ...c,
                status: 'cancelled' as const,
                completed_at: completedAt,
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });

    try {
      await apiFetch(`/api/waiter-calls/${callId}/cancel`, { method: 'POST' });
    } catch (e) {
      console.warn('Cancel call network error:', e);
    }
  };

  // Waiter: Toggle duty status
  const handleToggleDuty = async (waiterId: string, onDuty: boolean): Promise<void> => {
    try {
      await apiFetch(`/api/waiters/${waiterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_on_duty: onDuty }),
      });
    } catch (e) {
      console.warn(e);
    }
    setDbState((prev) => {
      const next = {
        ...prev,
        waiters: (prev.waiters || []).map((w) =>
          w.id === waiterId ? { ...w, is_on_duty: onDuty } : w
        ),
      };
      saveClientState(next);
      return next;
    });
  };

  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    sessionStorage.setItem('prime_cafe_admin_token', token);
    setIsAdminOpen(true);
    setIsAdminLoginOpen(false);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    sessionStorage.removeItem('prime_cafe_admin_token');
    setIsAdminOpen(false);
  };

  const handleOpenAdminTrigger = () => {
    setIsAdminLoginOpen(true);
  };

  // Route matching
  const isNative = typeof window !== 'undefined' && isNativeApp();
  const isViewingMenu = typeof window !== 'undefined' && sessionStorage.getItem('waiter_viewing_menu') === 'true';
  const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(urlSearch) : new URLSearchParams();
  const tableQueryParam = searchParams.get('table') || searchParams.get('vip') || searchParams.get('vip_table');
  const isVipRoute =
    currentPath === '/vip' ||
    currentPath.startsWith('/vip/') ||
    currentPath.startsWith('/table/') ||
    Boolean(tableQueryParam);
  const isWaiterRoute =
    currentPath === '/waiter' ||
    currentPath.startsWith('/waiter/') ||
    (isNative && !isViewingMenu && !isVipRoute && !isAdminOpen);

  // Resolve VIP Table from URL (query param or path segment) or selection
  const vipTableFromUrl = (() => {
    if (typeof window === 'undefined') return null;
    if (tableQueryParam) {
      const q = decodeURIComponent(tableQueryParam).toLowerCase().trim();
      const matched = dbState.vip_tables.find(
        (t) =>
          t.id.toLowerCase() === q ||
          t.table_number.toLowerCase() === q ||
          t.table_number.toLowerCase().replace('-', '') === q.replace('-', '') ||
          t.name.toLowerCase().includes(q)
      );
      if (matched) return matched;
    }

    if (isVipRoute) {
      const parts = currentPath.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const param = decodeURIComponent(parts[1]).toLowerCase().trim();
        return (
          dbState.vip_tables.find(
            (t) =>
              t.id.toLowerCase() === param ||
              t.table_number.toLowerCase() === param ||
              t.table_number.toLowerCase().replace('-', '') === param.replace('-', '') ||
              t.name.toLowerCase().includes(param)
          ) || null
        );
      }
    }
    return null;
  })();

  // Auto-grant VIP access when customer scans VIP Table QR code
  useEffect(() => {
    if (typeof window === 'undefined' || dbState.vip_tables.length === 0) return;
    const urlParams = new URLSearchParams(window.location.search);
    const pass = urlParams.get('pass') || urlParams.get('scanned_pass') || urlParams.get('token');
    const access = urlParams.get('access');
    const entry = urlParams.get('entry');
    const scan = urlParams.get('scan');
    const tableParam = urlParams.get('table') || urlParams.get('vip') || urlParams.get('vip_table');

    if (tableParam || isVipRoute) {
      const target = vipTableFromUrl || dbState.vip_tables[0];
      if (target) {
        const existingSession = getVipSession(target.id);
        // Detect authentic physical QR stand camera scan via embedded hidden pass or scan token
        const isPhysicalQrScan = Boolean(
          pass ||
          scan === 'camera' ||
          scan === 'fresh' ||
          scan === '1' ||
          (entry === 'qr' && (pass || access === 'granted'))
        );

        if (isPhysicalQrScan) {
          // Physical QR stand scanned with smartphone camera: ALWAYS start a fresh 4-hour session
          startVipSession(target.id, target.table_number, pass || undefined);
          setSelectedVipTable(target);

          // Strip scan/pass/entry tokens from browser URL so subsequent page reloads/refreshes do not reset timer
          urlParams.delete('pass');
          urlParams.delete('scanned_pass');
          urlParams.delete('token');
          urlParams.delete('scan');
          urlParams.delete('pin');
          urlParams.delete('access');
          urlParams.delete('entry');
          const cleanQuery = urlParams.toString();
          const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '');
          window.history.replaceState({}, '', cleanUrl);
        } else if (existingSession && Date.now() < existingSession.expiresAt) {
          // Existing session exists and is unexpired (browser reload, page navigation, or returning tab):
          // NEVER reset timer! Strictly preserves existing activatedAt and expiresAt!
          setSelectedVipTable(target);
        } else {
          // No active valid session or session expired:
          setSelectedVipTable(target);
        }

        if (currentPath !== '/vip') {
          setCurrentPath('/vip');
        }
      }
    }
  }, [currentPath, isVipRoute, vipTableFromUrl, dbState.vip_tables]);

  const activeVipTable = selectedVipTable || vipTableFromUrl || dbState.vip_tables[0];
  const pendingCallsCount = (dbState.waiter_calls || []).filter(
    (c) => c.status === 'pending'
  ).length;

  // Check 404 for unknown menu slugs
  const isMenuRoute = currentPath.startsWith('/menu/');
  const requestedSlug = isMenuRoute
    ? currentPath.replace('/menu/', '').split('/')[0]
    : 'prime-cafe';
  const isSlugValid =
    requestedSlug === 'prime-cafe' || requestedSlug === dbState.restaurant.slug;

  if (isMenuRoute && !isSlugValid) {
    return (
      <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas text-[#080808] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gold-surface p-8 rounded-2xl border-2 border-[#080808]/40 shadow-2xl">
          <BrandLogo size="lg" className="justify-center mb-4" showSubtitle={false} />
          <h1 className="text-2xl font-extrabold text-[#080808] font-display mb-2">
            Menu Not Found
          </h1>
          <p className="text-sm text-[#1A1A1A] font-medium mb-6">
            We couldn't find a digital menu for &ldquo;{requestedSlug}&rdquo;.
          </p>
          <button
            onClick={() => navigateTo('/menu/prime-cafe')}
            className="px-5 py-2.5 rounded-lg bg-[#080808] text-[#FCF6BA] font-bold text-xs hover:bg-[#1A1A1A] shadow-md transition-all cursor-pointer"
          >
            View Four Season Cafe and Restaurant Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas font-sans selection:bg-[#080808] selection:text-[#FCF6BA]">
      {/* 1. Waiter Mobile Application View */}
      {isWaiterRoute ? (
        <WaiterMobileApp
          waiters={dbState.waiters}
          vipTables={dbState.vip_tables}
          activeCalls={dbState.waiter_calls || []}
          onAcceptCall={handleAcceptCall}
          onCompleteCall={handleCompleteCall}
          onToggleDuty={handleToggleDuty}
          onBackToMenu={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('waiter_viewing_menu', 'true');
            }
            navigateTo('/menu/prime-cafe');
          }}
        />
      ) : isVipRoute && activeVipTable ? (
        /* 2. VIP Table Customer View */
        <VipTableCustomerView
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          table={activeVipTable}
          waiters={dbState.waiters}
          activeCalls={dbState.waiter_calls || []}
          onPlaceCall={handlePlaceCall}
          onCancelCall={handleCancelCall}
          onChangeTable={() => setIsVipSelectorOpen(true)}
          onExitVip={() => {
            try {
              sessionStorage.removeItem('four_season_vip_access_table');
            } catch {}
            setSelectedVipTable(null);
            navigateTo('/menu/prime-cafe');
          }}
          onOpenQR={() => setIsQRModalOpen(true)}
        />
      ) : isAdminOpen && adminToken ? (
        /* 3. Admin Dashboard with VIP Table & Waiter Management */
        <AdminDashboard
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          vipTables={dbState.vip_tables}
          waiters={dbState.waiters}
          calls={dbState.waiter_calls || []}
          token={adminToken}
          onUpdateRestaurant={handleUpdateRestaurant}
          onUpdateCategories={handleUpdateCategories}
          onUpdateItems={handleUpdateItems}
          onUpdateTables={handleUpdateTables}
          onUpdateWaiters={handleUpdateWaiters}
          onAcceptCall={handleAcceptCall}
          onCompleteCall={handleCompleteCall}
          onCancelCall={handleCancelCall}
          onOpenQR={() => setIsQRModalOpen(true)}
          onOpenLogoCropper={() => setIsLogoCropperOpen(true)}
          onOpenPhotoEnhancer={() => setIsPhotoEnhancerOpen(true)}
          onViewMenu={() => {
            setIsAdminOpen(false);
            navigateTo('/menu/prime-cafe');
          }}
          onLogout={handleAdminLogout}
        />
      ) : (
        /* 4. Public Luxury Menu */
        <PublicMenu
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          onOpenAdmin={handleOpenAdminTrigger}
          onOpenWaiterApp={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('waiter_viewing_menu');
            }
            navigateTo('/waiter');
          }}
        />
      )}

      {/* VIP Table Pin & Selection Modal */}
      <VipTableSelectorModal
        isOpen={isVipSelectorOpen}
        onClose={() => setIsVipSelectorOpen(false)}
        vipTables={dbState.vip_tables}
        onSelectTable={(table) => {
          setSelectedVipTable(table);
          navigateTo(`/vip/${table.table_number}`);
        }}
      />

      {/* Original Named Dish Photos Studio Enhancer Modal */}
      {isPhotoEnhancerOpen && (
        <OriginalPhotoEnhancerModal
          items={dbState.items}
          onClose={() => setIsPhotoEnhancerOpen(false)}
          onUpdateItems={handleUpdateItems}
        />
      )}

      {/* Admin Authentication Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={handleAdminLoginSuccess}
      />

      {/* Persistent QR Code Modal */}
      <QRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        slug={dbState.restaurant.slug}
        cafeName={dbState.restaurant.name}
      />

      {/* Confidential Original Logo & Wall Crop Modal */}
      <ConfidentialLogoCropModal
        isOpen={isLogoCropperOpen}
        onClose={() => setIsLogoCropperOpen(false)}
        restaurant={dbState.restaurant}
        onUpdateRestaurant={handleUpdateRestaurant}
      />
    </div>
  );
}
