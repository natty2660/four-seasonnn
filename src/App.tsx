import { useState, useEffect, useCallback, useRef } from 'react';
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
import { reconcileWaiterCalls } from './utils/reconcileCalls.ts';
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
  const refreshCycleCount = useRef<number>(0);
  const lastUserActionTimestamp = useRef<number>(0);
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

  // =========================================================================
  // Dedicated 5-Second Real-Time Status Refresh Engine
  // =========================================================================
  // Dedicated 5-Second Real-Time Status Refresh Engine (Runs Silently Inside)
  // Reconciles waiter calls, tables, and waiters authoritatively every 5000ms
  // so all statuses appear accurately without any visible UI clutter or flickers.
  // =========================================================================
  const executeDedicatedRefresh = useCallback(async () => {
    // Prevent polling from clobbering optimistic UI state while mutations are in-flight
    if (Date.now() - lastUserActionTimestamp.current < 3500) {
      return;
    }
    refreshCycleCount.current += 1;
    // Every 6 cycles (~30s), also revalidate menu items & restaurant settings
    const shouldRevalidateMenu = refreshCycleCount.current % 6 === 0;

    try {
      const t = Date.now();
      const fetchList: Promise<any>[] = [
        apiFetch(`/api/waiter-calls?_t=${t}`, { cache: 'no-store' }),
        apiFetch(`/api/waiters?_t=${t}`, { cache: 'no-store' }),
        apiFetch(`/api/vip-tables?_t=${t}`, { cache: 'no-store' }),
      ];
      if (shouldRevalidateMenu) {
        fetchList.push(apiFetch(`/api/menu/prime-cafe?_t=${t}`, { cache: 'no-store' }));
      }

      const results = await Promise.allSettled(fetchList);
      const [callsRes, waitersRes, tablesRes, menuRes] = results;

      let calls: WaiterCall[] | null = null;
      if (callsRes?.status === 'fulfilled' && callsRes.value.ok) {
        const c = await callsRes.value.json().catch(() => null);
        if (Array.isArray(c)) calls = c;
      }

      let waiters: Waiter[] | null = null;
      if (waitersRes?.status === 'fulfilled' && waitersRes.value.ok) {
        const w = await waitersRes.value.json().catch(() => null);
        if (Array.isArray(w)) waiters = w;
      }

      let tables: VipTable[] | null = null;
      if (tablesRes?.status === 'fulfilled' && tablesRes.value.ok) {
        const t = await tablesRes.value.json().catch(() => null);
        if (Array.isArray(t)) tables = t;
      }

      let freshMenu: any = null;
      if (menuRes?.status === 'fulfilled' && menuRes.value.ok) {
        freshMenu = await menuRes.value.json().catch(() => null);
      }

      if (calls || waiters || tables || freshMenu) {
        setDbState((prev) => {
          const mergedCalls = calls
            ? reconcileWaiterCalls(prev.waiter_calls || [], calls)
            : prev.waiter_calls;
          const mergedWaiters = waiters !== null ? waiters : prev.waiters;
          const mergedTables = tables !== null ? tables : prev.vip_tables;

          const hasCallDiff = JSON.stringify(prev.waiter_calls) !== JSON.stringify(mergedCalls);
          const hasWaiterDiff = JSON.stringify(prev.waiters) !== JSON.stringify(mergedWaiters);
          const hasTableDiff = JSON.stringify(prev.vip_tables) !== JSON.stringify(mergedTables);
          const hasMenuDiff = Boolean(
            freshMenu?.restaurant &&
            JSON.stringify(prev.items) !== JSON.stringify(freshMenu.items)
          );

          if (hasCallDiff || hasWaiterDiff || hasTableDiff || hasMenuDiff) {
            const next: DatabaseState = {
              ...prev,
              ...(hasMenuDiff && freshMenu?.restaurant
                ? {
                    restaurant: freshMenu.restaurant,
                    categories: freshMenu.categories,
                    items: freshMenu.items,
                  }
                : {}),
              waiter_calls: mergedCalls,
              waiters: mergedWaiters,
              vip_tables: mergedTables,
              last_updated: new Date().toISOString(),
            };
            saveClientState(next);
            return next;
          }
          return prev;
        });
      }
    } catch {
      // Silent internal catch: existing client state preserved
    }
  }, []);

  // 1. Dedicated 5-Second Interval - runs silently inside the site every 5 seconds
  useEffect(() => {
    // Immediate refresh on mount
    executeDedicatedRefresh();

    const timer = setInterval(() => {
      executeDedicatedRefresh();
    }, 5000);

    // Instant revalidation when tab becomes visible or receives focus
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        executeDedicatedRefresh();
      }
    };
    const handleFocus = () => {
      executeDedicatedRefresh();
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [executeDedicatedRefresh]);

  // 2. Real-time Server-Sent Events (SSE) stream for sub-second push alerts
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      const streamUrl = getApiUrl('/api/waiter-calls/stream');
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        // Prevent incoming SSE broadcasts from clobbering optimistic UI state while a user mutation is in-flight
        if (Date.now() - lastUserActionTimestamp.current < 3500) {
          return;
        }
        try {
          const data = JSON.parse(event.data);
          if (data && (data.calls || data.waiters || data.tables)) {
            setDbState((prev) => {
              const mergedCalls = Array.isArray(data.calls)
                ? reconcileWaiterCalls(prev.waiter_calls || [], data.calls)
                : prev.waiter_calls;
              const mergedWaiters = Array.isArray(data.waiters) ? data.waiters : prev.waiters;
              const mergedTables = Array.isArray(data.tables) ? data.tables : prev.vip_tables;

              const hasCallDiff = JSON.stringify(prev.waiter_calls) !== JSON.stringify(mergedCalls);
              const hasWaiterDiff = JSON.stringify(prev.waiters) !== JSON.stringify(mergedWaiters);
              const hasTableDiff = JSON.stringify(prev.vip_tables) !== JSON.stringify(mergedTables);

              if (hasCallDiff || hasWaiterDiff || hasTableDiff) {
                const next: DatabaseState = {
                  ...prev,
                  waiter_calls: mergedCalls,
                  waiters: mergedWaiters,
                  vip_tables: mergedTables,
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
        // When SSE stream reconnects or errors, run dedicated refresh immediately
        executeDedicatedRefresh();
      };
    } catch (e) {
      console.warn('SSE stream setup note:', e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [executeDedicatedRefresh]);

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
    lastUserActionTimestamp.current = Date.now();
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
    lastUserActionTimestamp.current = Date.now();
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

    lastUserActionTimestamp.current = Date.now();

    // Normalize tableId matching so whether tableId is "vip_10" or "VIP-10", it matches the table in dbState.vip_tables
    const cleanId = (tableId || '').trim().toLowerCase();
    const matchedTable = dbState.vip_tables.find(
      (t) =>
        t.id.toLowerCase() === cleanId ||
        t.table_number.toLowerCase() === cleanId ||
        t.table_number.toLowerCase().replace('-', '') === cleanId.replace('-', '') ||
        t.id.toLowerCase().replace('_', '-') === cleanId ||
        t.id.toLowerCase() === cleanId.replace('-', '_')
    );
    const resolvedTableId = matchedTable ? matchedTable.id : tableId;

    try {
      const res = await apiFetch('/api/waiter-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: resolvedTableId, call_type: callType, message }),
      });

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        const call: WaiterCall = data?.call || data;

        if (call && call.id) {
          setDbState((prev) => {
            if (data && Array.isArray(data.calls)) {
              const merged = reconcileWaiterCalls(prev.waiter_calls || [], data.calls);
              const next = { ...prev, waiter_calls: merged };
              saveClientState(next);
              return next;
            }

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
      }
    } catch (e) {
      console.warn('Fallback offline place call:', e);
    }
    return false;
  };

  // Waiter & Admin: Accept Call (Instant Acceptance without automatic forced hold)
  const handleAcceptCall = async (
    callId: string,
    waiterId: string,
    waiterName: string
  ): Promise<void> => {
    lastUserActionTimestamp.current = Date.now();
    const acceptedAt = new Date().toISOString();

    // 1. Immediately update UI state to 'accepted' so multiple tables can be attended simultaneously
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).map((c) =>
          c.id === callId
            ? {
                ...c,
                status: 'accepted' as const,
                accepted_by_waiter_id: waiterId,
                accepted_by_name: waiterName,
                accepted_at: acceptedAt,
                held_at: null,
                hold_reason: null,
                revision: (c.revision || 1) + 1,
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });

    // 2. Authoritative backend synchronization
    try {
      const res = await apiFetch(`/api/waiter-calls/${callId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
      });

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.calls)) {
          setDbState((prev) => {
            const merged = reconcileWaiterCalls(prev.waiter_calls || [], data.calls);
            const next = { ...prev, waiter_calls: merged };
            saveClientState(next);
            return next;
          });
        }
      }
    } catch (e) {
      console.warn('Accept call network error:', e);
    }
  };

  // Waiter & Admin: Explicitly Place Call on Hold
  const handleHoldCall = async (
    callId: string,
    waiterId: string,
    waiterName: string,
    holdReason?: string
  ): Promise<void> => {
    lastUserActionTimestamp.current = Date.now();
    const heldAt = new Date().toISOString();
    const reason = holdReason || `Staff ${waiterName || 'Member'} will attend shortly`;

    setDbState((prev) => {
      const nextCalls = (prev.waiter_calls || []).map((c) =>
        c.id === callId
          ? {
              ...c,
              status: 'hold' as const,
              held_at: heldAt,
              hold_reason: reason,
              accepted_by_waiter_id: waiterId,
              accepted_by_name: waiterName,
              revision: (c.revision || 1) + 1,
            }
          : c
      );
      const next = { ...prev, waiter_calls: nextCalls };
      saveClientState(next);
      return next;
    });

    try {
      const res = await apiFetch(`/api/waiter-calls/${callId}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waiter_id: waiterId,
          waiter_name: waiterName,
          hold_reason: reason,
        }),
      });
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.calls)) {
          setDbState((prev) => {
            const merged = reconcileWaiterCalls(prev.waiter_calls || [], data.calls);
            const next = { ...prev, waiter_calls: merged };
            saveClientState(next);
            return next;
          });
        }
      }
    } catch (e) {
      console.warn('Hold call network error:', e);
    }
  };

  // Waiter & Admin: Complete Call (Releases and promotes next queued held call)
  const handleCompleteCall = async (callId: string): Promise<void> => {
    lastUserActionTimestamp.current = Date.now();
    const completedAt = new Date().toISOString();

    setDbState((prev) => {
      const currentCall = (prev.waiter_calls || []).find((c) => c.id === callId);
      const completingWaiterId = currentCall?.accepted_by_waiter_id || currentCall?.assigned_waiter_id;

      // Deterministically pick the oldest held call for this waiter so client and server match
      const candidateHeldCalls = (prev.waiter_calls || [])
        .filter(
          (c) =>
            c.id !== callId &&
            c.status === 'hold' &&
            (!c.accepted_by_waiter_id ||
              c.accepted_by_waiter_id === completingWaiterId ||
              c.assigned_waiter_id === completingWaiterId)
        )
        .sort(
          (a, b) =>
            new Date(a.held_at || a.created_at).getTime() -
            new Date(b.held_at || b.created_at).getTime()
        );

      const targetHeldId = candidateHeldCalls[0]?.id || null;

      const nextCalls = (prev.waiter_calls || []).map((c) => {
        if (c.id === callId) {
          return {
            ...c,
            status: 'completed' as const,
            completed_at: completedAt,
            revision: (c.revision || 1) + 1,
          };
        }
        if (targetHeldId && c.id === targetHeldId) {
          return {
            ...c,
            status: 'pending' as const,
            held_at: null,
            hold_reason: null,
            revision: (c.revision || 1) + 1,
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
      const res = await apiFetch(`/api/waiter-calls/${callId}/complete`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        // If backend returns updated calls array or promoted call, reconcile immediately
        if (data && Array.isArray(data.calls)) {
          setDbState((prev) => {
            const merged = reconcileWaiterCalls(prev.waiter_calls || [], data.calls);
            const next = { ...prev, waiter_calls: merged };
            saveClientState(next);
            return next;
          });
        }
      }
    } catch (e) {
      console.warn('Complete call network error:', e);
    }
  };

  // Customer & Admin: Cancel Call
  const handleCancelCall = async (callId: string): Promise<void> => {
    lastUserActionTimestamp.current = Date.now();
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
                revision: (c.revision || 1) + 1,
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });

    try {
      const res = await apiFetch(`/api/waiter-calls/${callId}/cancel`, { method: 'POST' });
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.calls)) {
          setDbState((prev) => {
            const merged = reconcileWaiterCalls(prev.waiter_calls || [], data.calls);
            const next = { ...prev, waiter_calls: merged };
            saveClientState(next);
            return next;
          });
        }
      }
    } catch (e) {
      console.warn('Cancel call network error:', e);
    }
  };

  // Admin: Clear completed call logs
  const handleClearCallHistory = async () => {
    lastUserActionTimestamp.current = Date.now();
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).filter(
          (c) => c.status === 'pending' || c.status === 'accepted' || c.status === 'hold'
        ),
      };
      saveClientState(next);
      return next;
    });

    try {
      await apiFetch('/api/waiter-calls/history', {
        method: 'DELETE',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      });
    } catch (e) {
      console.warn('Clear call history network error:', e);
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
          (scan && scan.toLowerCase().startsWith('cam')) ||
          scan === 'fresh' ||
          scan === '1' ||
          entry === 'qr' ||
          access === 'granted'
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

  const currentTableId = selectedVipTable?.id || vipTableFromUrl?.id;
  const currentTableNumber = selectedVipTable?.table_number || vipTableFromUrl?.table_number;
  const activeVipTable =
    (dbState.vip_tables || []).find(
      (t) =>
        (currentTableId && t.id === currentTableId) ||
        (currentTableNumber && t.table_number.toLowerCase() === currentTableNumber.toLowerCase())
    ) || selectedVipTable || vipTableFromUrl || dbState.vip_tables[0];
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
          onHoldCall={handleHoldCall}
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
          onClearHistory={handleClearCallHistory}
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
