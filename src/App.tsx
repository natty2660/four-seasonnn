import { useState, useEffect, useCallback } from 'react';
import { Restaurant, Category, MenuItem } from './types/index.ts';
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

export default function App() {
  const [dbState, setDbState] = useState<DatabaseState>(() => loadClientState());
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isLogoCropperOpen, setIsLogoCropperOpen] = useState(false);
  const [isPhotoEnhancerOpen, setIsPhotoEnhancerOpen] = useState(false);
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

  // Keep route synced
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch / revalidate menu from backend API (Graceful revalidation)
  const refreshFromAPI = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/prime-cafe');
      if (res.ok) {
        const data = await res.json();
        if (data.restaurant && data.categories && data.items) {
          const freshState: DatabaseState = {
            restaurant: data.restaurant,
            categories: data.categories,
            items: data.items,
            last_updated: data.generated_at || new Date().toISOString(),
          };
          setDbState(freshState);
          saveClientState(freshState);
        }
      }
    } catch {
      // Offline / serverless cold boot fallback: local client state already loaded
    }
  }, []);

  useEffect(() => {
    refreshFromAPI();
  }, [refreshFromAPI]);

  // Handle URL path inspection
  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

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

  // Check 404 for unknown menu slugs
  const isMenuRoute = currentPath.startsWith('/menu/');
  const requestedSlug = isMenuRoute ? currentPath.replace('/menu/', '').split('/')[0] : 'prime-cafe';
  const isSlugValid = requestedSlug === 'prime-cafe' || requestedSlug === dbState.restaurant.slug;

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
            className="px-5 py-2.5 rounded-lg bg-[#080808] text-[#FCF6BA] font-bold text-xs hover:bg-[#1A1A1A] shadow-md transition-all"
          >
            View Four Season Cafe and Restaurant Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas font-sans selection:bg-[#080808] selection:text-[#FCF6BA]">
      {/* View router: Admin Dashboard or Public Menu */}
      {isAdminOpen && adminToken ? (
        <AdminDashboard
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          token={adminToken}
          onUpdateRestaurant={handleUpdateRestaurant}
          onUpdateCategories={handleUpdateCategories}
          onUpdateItems={handleUpdateItems}
          onOpenQR={() => setIsQRModalOpen(true)}
          onOpenLogoCropper={() => setIsLogoCropperOpen(true)}
          onViewMenu={() => {
            setIsAdminOpen(false);
            navigateTo('/menu/prime-cafe');
          }}
          onLogout={handleAdminLogout}
        />
      ) : (
        <PublicMenu
          restaurant={dbState.restaurant}
          categories={dbState.categories}
          items={dbState.items}
          onOpenAdmin={handleOpenAdminTrigger}
          onOpenQR={() => setIsQRModalOpen(true)}
          onOpenLogoCropper={() => setIsLogoCropperOpen(true)}
          onOpenPhotoEnhancer={() => setIsPhotoEnhancerOpen(true)}
        />
      )}

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
