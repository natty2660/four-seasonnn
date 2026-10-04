import { useState, useEffect, useCallback } from 'react';
import {
  Restaurant,
  Category,
  MenuItem,
  VipTable,
  Waiter,
  WaiterCall,
  CallType,
} from './types/index.ts';
import {
  loadClientState,
  saveClientState,
  DatabaseState,
} from './lib/storage.ts';
import { getApiUrl } from './lib/apiConfig.ts';
import { PublicMenu } from './components/PublicMenu.tsx';
import { VipTableCustomerView } from './components/VipTableCustomerView.tsx';
import { WaiterMobileApp } from './components/WaiterMobileApp.tsx';
import { VipTableSelectorModal } from './components/VipTableSelectorModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AdminLoginModal } from './components/AdminLoginModal.tsx';
import { QRModal } from './components/QRModal.tsx';
import { BrandLogo } from './components/BrandLogo.tsx';
import { ConfidentialLogoCropModal } from './components/ConfidentialLogoCropModal.tsx';
import { OriginalPhotoEnhancerModal } from './components/OriginalPhotoEnhancerModal.tsx';

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() => loadClientState());
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isLogoCropperOpen, setIsLogoCropperOpen] = useState(false);
  const [isPhotoEnhancerOpen, setIsPhotoEnhancerOpen] = useState(false);
  const [isVipSelectorOpen, setIsVipSelectorOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('prime_cafe_admin_token');
    }
    return null;
  });
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  // Active VIP Table ID (from URL query, or localStorage)
  const [selectedVipTableId, setSelectedVipTableId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryTable = params.get('table') || params.get('vip');
      if (queryTable) return queryTable;
      return localStorage.getItem('four_season_selected_vip_table');
    }
    return null;
  });

  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/menu/prime-cafe';
  });

  // Keep route synced with browser navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const queryTable = params.get('table') || params.get('vip');
      if (queryTable) setSelectedVipTableId(queryTable);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch / revalidate menu, tables, and waiters from backend API
  const refreshFromAPI = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/menu/prime-cafe'));
      if (res.ok) {
        const data = await res.json();
        if (data.restaurant && data.categories && data.items) {
          setDbState((prev) => {
            const freshState: DatabaseState = {
              ...prev,
              restaurant: data.restaurant,
              categories: data.categories,
              items: data.items,
              last_updated: data.generated_at || new Date().toISOString(),
            };
            saveClientState(freshState);
            return freshState;
          });
        }
      }

      // Also fetch VIP tables, waiters, and calls
      const [tablesRes, waitersRes, callsRes] = await Promise.all([
        fetch(getApiUrl('/api/vip-tables')).catch(() => null),
        fetch(getApiUrl('/api/waiters')).catch(() => null),
        fetch(getApiUrl('/api/waiter-calls')).catch(() => null),
      ]);

      if (tablesRes && tablesRes.ok) {
        const tables = await tablesRes.json();
        setDbState((prev) => ({ ...prev, vip_tables: tables }));
      }
      if (waitersRes && waitersRes.ok) {
        const waiters = await waitersRes.json();
        setDbState((prev) => ({ ...prev, waiters }));
      }
      if (callsRes && callsRes.ok) {
        const calls = await callsRes.json();
        setDbState((prev) => ({ ...prev, waiter_calls: calls }));
      }
    } catch {
      // Offline / serverless cold boot fallback
    }
  }, []);

  useEffect(() => {
    refreshFromAPI();
  }, [refreshFromAPI]);

  // Real-time Server-Sent Events (SSE) Listener for instant call alerts & ringing
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;

    function connectSSE() {
      try {
        eventSource = new EventSource(getApiUrl('/api/waiter-calls/stream'));

        eventSource.addEventListener('init', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            setDbState((prev) => ({
              ...prev,
              waiter_calls: data.calls || prev.waiter_calls,
              vip_tables: data.tables || prev.vip_tables,
              waiters: data.waiters || prev.waiters,
            }));
          } catch {}
        });

        eventSource.addEventListener('new_call', (e: MessageEvent) => {
          try {
            const newCall: WaiterCall = JSON.parse(e.data);
            setDbState((prev) => {
              const existingIdx = prev.waiter_calls.findIndex((c) => c.id === newCall.id);
              let updatedCalls: WaiterCall[];
              if (existingIdx !== -1) {
                updatedCalls = prev.waiter_calls.map((c) => (c.id === newCall.id ? newCall : c));
              } else {
                updatedCalls = [newCall, ...prev.waiter_calls];
              }
              const next = { ...prev, waiter_calls: updatedCalls };
              saveClientState(next);
              return next;
            });
          } catch {}
        });

        const handleCallUpdate = (e: MessageEvent) => {
          try {
            const updatedCall: WaiterCall = JSON.parse(e.data);
            setDbState((prev) => {
              const updatedCalls = prev.waiter_calls.map((c) =>
                c.id === updatedCall.id ? updatedCall : c
              );
              const next = { ...prev, waiter_calls: updatedCalls };
              saveClientState(next);
              return next;
            });
          } catch {}
        };

        eventSource.addEventListener('call_accepted', handleCallUpdate);
        eventSource.addEventListener('call_completed', handleCallUpdate);
        eventSource.addEventListener('call_cancelled', handleCallUpdate);
        eventSource.addEventListener('call_updated', handleCallUpdate);

        eventSource.addEventListener('tables_updated', (e: MessageEvent) => {
          try {
            const tables: VipTable[] = JSON.parse(e.data);
            setDbState((prev) => ({ ...prev, vip_tables: tables }));
          } catch {}
        });

        eventSource.addEventListener('waiters_updated', (e: MessageEvent) => {
          try {
            const waiters: Waiter[] = JSON.parse(e.data);
            setDbState((prev) => ({ ...prev, waiters }));
          } catch {}
        });

        eventSource.addEventListener('history_cleared', (e: MessageEvent) => {
          try {
            const remaining: WaiterCall[] = JSON.parse(e.data);
            setDbState((prev) => ({ ...prev, waiter_calls: remaining }));
          } catch {}
        });

        eventSource.onerror = () => {
          eventSource?.close();
          // Reconnect after 4s
          reconnectTimeout = window.setTimeout(connectSSE, 4000);
        };
      } catch {
        reconnectTimeout = window.setTimeout(connectSSE, 4000);
      }
    }

    connectSSE();

    // Fallback high-speed polling every 4 seconds to guarantee zero missed calls
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await fetch(getApiUrl('/api/waiter-calls'));
        if (res.ok) {
          const calls: WaiterCall[] = await res.json();
          setDbState((prev) => {
            // Check if call count or statuses changed
            if (JSON.stringify(prev.waiter_calls) !== JSON.stringify(calls)) {
              return { ...prev, waiter_calls: calls };
            }
            return prev;
          });
        }
      } catch {}
    }, 4000);

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, []);

  // Handle URL navigation
  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  // State update handlers
  const handleUpdateRestaurant = (updated: Restaurant) => {
    const next: DatabaseState = {
      ...dbState,
      restaurant: updated,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);

    if (adminToken) {
      fetch('/api/restaurants', {
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
      fetch('/api/categories/sync', {
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
      fetch('/api/items/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ items }),
      }).catch(() => {});
    }
  };

  const handleUpdateVipTables = (tables: VipTable[]) => {
    const next = { ...dbState, vip_tables: tables };
    setDbState(next);
    saveClientState(next);
  };

  const handleUpdateWaiters = (waiters: Waiter[]) => {
    const next = { ...dbState, waiters };
    setDbState(next);
    saveClientState(next);
  };

  // Place a call from VIP Customer Table
  const handlePlaceVipCall = async (
    tableId: string,
    callType: CallType = 'general',
    message?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl('/api/waiter-calls'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, call_type: callType, message }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.call) {
          setDbState((prev) => {
            const existing = prev.waiter_calls.find((c) => c.id === data.call.id);
            if (existing) {
              return {
                ...prev,
                waiter_calls: prev.waiter_calls.map((c) =>
                  c.id === data.call.id ? data.call : c
                ),
              };
            }
            return {
              ...prev,
              waiter_calls: [data.call, ...prev.waiter_calls],
            };
          });
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Waiter or Admin accepts call
  const handleAcceptCall = async (callId: string, waiterId: string, waiterName: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/waiter-calls/${callId}/accept`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.call) {
          setDbState((prev) => ({
            ...prev,
            waiter_calls: prev.waiter_calls.map((c) =>
              c.id === callId ? data.call : c
            ),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  // Complete call
  const handleCompleteCall = async (callId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/waiter-calls/${callId}/complete`), {
        method: 'PUT',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.call) {
          setDbState((prev) => ({
            ...prev,
            waiter_calls: prev.waiter_calls.map((c) =>
              c.id === callId ? data.call : c
            ),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to complete call:', err);
    }
  };

  // Cancel call
  const handleCancelCall = async (callId: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/waiter-calls/${callId}/cancel`), {
        method: 'PUT',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.call) {
          setDbState((prev) => ({
            ...prev,
            waiter_calls: prev.waiter_calls.map((c) =>
              c.id === callId ? data.call : c
            ),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to cancel call:', err);
    }
  };

  // Toggle waiter duty
  const handleToggleWaiterDuty = async (waiterId: string, onDuty: boolean) => {
    try {
      const res = await fetch(getApiUrl(`/api/waiters/${waiterId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_on_duty: onDuty }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDbState((prev) => ({
          ...prev,
          waiters: prev.waiters.map((w) => (w.id === waiterId ? updated : w)),
        }));
      }
    } catch (err) {
      console.error('Failed to toggle duty:', err);
    }
  };

  // Handle VIP Table selection
  const handleSelectVipTable = (table: VipTable) => {
    setSelectedVipTableId(table.id);
    localStorage.setItem('four_season_selected_vip_table', table.id);
    navigateTo(`/vip?table=${encodeURIComponent(table.table_number)}`);
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
    if (adminToken) {
      setIsAdminOpen(true);
    } else {
      setIsAdminLoginOpen(true);
    }
  };

  // Check route destination
  const isWaiterRoute = currentPath === '/waiter' || currentPath.startsWith('/waiter/');
  const isVipRoute = currentPath === '/vip' || currentPath.startsWith('/vip/');

  // Active VIP table lookup
  const activeVipTable =
    dbState.vip_tables.find(
      (t) =>
        t.id === selectedVipTableId ||
        t.table_number.toLowerCase() === String(selectedVipTableId).toLowerCase()
    ) || dbState.vip_tables[0];

  // ==========================================
  // VIEW 1: WAITER MOBILE APP
  // ==========================================
  if (isWaiterRoute) {
    return (
      <WaiterMobileApp
        waiters={dbState.waiters}
        vipTables={dbState.vip_tables}
        activeCalls={dbState.waiter_calls}
        onAcceptCall={handleAcceptCall}
        onCompleteCall={handleCompleteCall}
        onToggleDuty={handleToggleWaiterDuty}
        onBackToMenu={() => navigateTo('/menu/prime-cafe')}
      />
    );
  }

  // ==========================================
  // VIEW 2: VIP TABLE CUSTOMER EXPERIENCE
  // ==========================================
  if (isVipRoute) {
    return (
      <>
        <VipTableCustomerView
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          table={activeVipTable}
          waiters={dbState.waiters}
          activeCalls={dbState.waiter_calls}
          onPlaceCall={handlePlaceVipCall}
          onCancelCall={handleCancelCall}
          onChangeTable={() => setIsVipSelectorOpen(true)}
          onExitVip={() => navigateTo('/menu/prime-cafe')}
          onOpenQR={() => setIsQRModalOpen(true)}
        />

        <VipTableSelectorModal
          isOpen={isVipSelectorOpen}
          onClose={() => setIsVipSelectorOpen(false)}
          vipTables={dbState.vip_tables}
          onSelectTable={handleSelectVipTable}
        />

        <QRModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          slug={dbState.restaurant.slug}
          cafeName={dbState.restaurant.name}
        />
      </>
    );
  }

  // ==========================================
  // VIEW 3: ADMIN DASHBOARD (STAFF PORTAL)
  // ==========================================
  if (isAdminOpen && adminToken) {
    return (
      <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas font-sans selection:bg-[#080808] selection:text-[#FCF6BA]">
        <AdminDashboard
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          vipTables={dbState.vip_tables}
          waiters={dbState.waiters}
          calls={dbState.waiter_calls}
          token={adminToken}
          onUpdateRestaurant={handleUpdateRestaurant}
          onUpdateCategories={handleUpdateCategories}
          onUpdateItems={handleUpdateItems}
          onUpdateTables={handleUpdateVipTables}
          onUpdateWaiters={handleUpdateWaiters}
          onAcceptCall={handleAcceptCall}
          onCompleteCall={handleCompleteCall}
          onCancelCall={handleCancelCall}
          onOpenQR={() => setIsQRModalOpen(true)}
          onOpenLogoCropper={() => setIsLogoCropperOpen(true)}
          onViewMenu={() => {
            setIsAdminOpen(false);
            navigateTo('/menu/prime-cafe');
          }}
          onLogout={handleAdminLogout}
        />

        <QRModal
          isOpen={isQRModalOpen}
          onClose={() => setIsQRModalOpen(false)}
          slug={dbState.restaurant.slug}
          cafeName={dbState.restaurant.name}
        />

        <ConfidentialLogoCropModal
          isOpen={isLogoCropperOpen}
          onClose={() => setIsLogoCropperOpen(false)}
          restaurant={dbState.restaurant}
          onUpdateRestaurant={handleUpdateRestaurant}
        />
      </div>
    );
  }

  // ==========================================
  // VIEW 4: NORMAL CUSTOMER DIGITAL MENU
  // (Separated: No VIP call button on normal menu)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas font-sans selection:bg-[#080808] selection:text-[#FCF6BA]">
      <PublicMenu
        restaurant={dbState.restaurant}
        categories={dbState.categories}
        items={dbState.items}
        onOpenAdmin={handleOpenAdminTrigger}
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenLogoCropper={() => setIsLogoCropperOpen(true)}
        onOpenPhotoEnhancer={() => setIsPhotoEnhancerOpen(true)}
        onOpenVipAccess={() => {
          setIsVipSelectorOpen(true);
        }}
        onOpenWaiterApp={() => {
          navigateTo('/waiter');
        }}
      />

      {/* VIP Table Selection Modal */}
      <VipTableSelectorModal
        isOpen={isVipSelectorOpen}
        onClose={() => setIsVipSelectorOpen(false)}
        vipTables={dbState.vip_tables}
        onSelectTable={handleSelectVipTable}
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
