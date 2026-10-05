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
      return window.location.pathname;
    }
    return '/menu/prime-cafe';
  });

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

  // Fetch / revalidate menu from backend API (Graceful revalidation)
  const refreshFromAPI = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/prime-cafe');
      if (res.ok) {
        const data = await res.json();
        if (data.restaurant && data.categories && data.items) {
          setDbState((prevState) => {
            const freshState: DatabaseState = {
              ...prevState,
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
    } catch {
      // Offline / serverless cold boot fallback: local client state already loaded
    }
  }, []);

  useEffect(() => {
    refreshFromAPI();
  }, [refreshFromAPI]);

  // Real-time polling for live VIP waiter calls
  useEffect(() => {
    const pollCalls = async () => {
      try {
        const res = await fetch('/api/waiter-calls');
        if (res.ok) {
          const calls = await res.json();
          if (Array.isArray(calls)) {
            setDbState((prev) => {
              if (JSON.stringify(prev.waiter_calls) !== JSON.stringify(calls)) {
                const next = { ...prev, waiter_calls: calls };
                saveClientState(next);
                return next;
              }
              return prev;
            });
          }
        }
      } catch {
        // Silent catch for offline or initial boot
      }
    };

    pollCalls();
    const interval = setInterval(pollCalls, 3000);
    return () => clearInterval(interval);
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

  const handleUpdateTables = (tables: VipTable[]) => {
    const next: DatabaseState = {
      ...dbState,
      vip_tables: tables,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);
  };

  const handleUpdateWaiters = (waiters: Waiter[]) => {
    const next: DatabaseState = {
      ...dbState,
      waiters,
      last_updated: new Date().toISOString(),
    };
    setDbState(next);
    saveClientState(next);
  };

  // VIP Customer: Place Call
  const handlePlaceCall = async (
    tableId: string,
    callType: CallType,
    message?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/waiter-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId, call_type: callType, message }),
      });
      if (res.ok) {
        const call = await res.json();
        setDbState((prev) => {
          const next = {
            ...prev,
            waiter_calls: [call, ...(prev.waiter_calls || [])],
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

  // Waiter & Admin: Accept Call
  const handleAcceptCall = async (
    callId: string,
    waiterId: string,
    waiterName: string
  ): Promise<void> => {
    try {
      await fetch(`/api/waiter-calls/${callId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waiter_id: waiterId, waiter_name: waiterName }),
      });
    } catch (e) {
      console.warn(e);
    }
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
                accepted_at: new Date().toISOString(),
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });
  };

  // Waiter & Admin: Complete Call
  const handleCompleteCall = async (callId: string): Promise<void> => {
    try {
      await fetch(`/api/waiter-calls/${callId}/complete`, { method: 'POST' });
    } catch (e) {
      console.warn(e);
    }
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).map((c) =>
          c.id === callId
            ? {
                ...c,
                status: 'completed' as const,
                completed_at: new Date().toISOString(),
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });
  };

  // Customer & Admin: Cancel Call
  const handleCancelCall = async (callId: string): Promise<void> => {
    try {
      await fetch(`/api/waiter-calls/${callId}/cancel`, { method: 'POST' });
    } catch (e) {
      console.warn(e);
    }
    setDbState((prev) => {
      const next = {
        ...prev,
        waiter_calls: (prev.waiter_calls || []).map((c) =>
          c.id === callId
            ? {
                ...c,
                status: 'cancelled' as const,
                completed_at: new Date().toISOString(),
              }
            : c
        ),
      };
      saveClientState(next);
      return next;
    });
  };

  // Waiter: Toggle duty status
  const handleToggleDuty = async (waiterId: string, onDuty: boolean): Promise<void> => {
    try {
      await fetch(`/api/waiters/${waiterId}`, {
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
  const urlSearch = typeof window !== 'undefined' ? window.location.search : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(urlSearch) : new URLSearchParams();
  const tableQueryParam = searchParams.get('table') || searchParams.get('vip') || searchParams.get('vip_table');
  const isWaiterRoute = currentPath === '/waiter' || currentPath.startsWith('/waiter/');
  const isVipRoute =
    currentPath === '/vip' ||
    currentPath.startsWith('/vip/') ||
    currentPath.startsWith('/table/') ||
    Boolean(tableQueryParam);

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
    const pin = urlParams.get('pin');
    const access = urlParams.get('access');
    const tableParam = urlParams.get('table') || urlParams.get('vip') || urlParams.get('vip_table');

    if (tableParam || isVipRoute) {
      const target = vipTableFromUrl || dbState.vip_tables[0];
      if (target) {
        // Direct VIP access is granted if access=granted or pin matches table secret code
        const isAccessGranted =
          access === 'granted' ||
          !target.secret_code ||
          (pin && pin.trim() === target.secret_code.trim());

        if (isAccessGranted) {
          try {
            sessionStorage.setItem('four_season_vip_access_table', target.id);
          } catch {}
          setSelectedVipTable(target);
          if (currentPath !== '/vip') {
            setCurrentPath('/vip');
          }
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
          onBackToMenu={() => navigateTo('/menu/prime-cafe')}
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
