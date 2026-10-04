import React, { useState, useMemo } from 'react';
import { Restaurant, Category, MenuItem, MealTime } from '../types/index.ts';
import { BrandLogo } from './BrandLogo.tsx';
import { ItemCard } from './ItemCard.tsx';
import {
  Search,
  Clock,
  MapPin,
  QrCode,
  Lock,
  X,
  Flame,
  CheckCircle2,
  Sparkles,
  Coffee,
  Camera,
  Navigation,
  UtensilsCrossed,
  Crop,
  Crown,
  Smartphone,
} from 'lucide-react';

interface PublicMenuProps {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  onOpenAdmin: () => void;
  onOpenQR: () => void;
  onOpenLogoCropper?: () => void;
  onOpenPhotoEnhancer?: () => void;
  onOpenVipAccess?: () => void;
  onOpenWaiterApp?: () => void;
}

const DEFAULT_HERO_BANNER = '/assets/images/four_season_confidential_wall_1790854372202.jpg';

export const PublicMenu: React.FC<PublicMenuProps> = ({
  restaurant,
  categories,
  items,
  onOpenAdmin,
  onOpenQR,
  onOpenLogoCropper,
  onOpenPhotoEnhancer,
  onOpenVipAccess,
  onOpenWaiterApp,
}) => {
  const [selectedMealTime, setSelectedMealTime] = useState<MealTime | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const heroCoverUrl =
    restaurant.cover_url &&
    !restaurant.cover_url.includes('prime_cafe') &&
    !restaurant.cover_url.includes('four_season_hero_banner')
      ? restaurant.cover_url
      : DEFAULT_HERO_BANNER;

  // Inactive state check
  if (!restaurant.is_active) {
    return (
      <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas text-[#080808] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gold-surface p-8 rounded-2xl border-2 border-[#080808]/40 shadow-2xl">
          <BrandLogo
            size="lg"
            customLogoUrl={restaurant.logo_url}
            className="justify-center mb-4"
            showSubtitle={false}
          />
          <h1 className="text-2xl font-bold text-[#080808] mb-2 font-display">
            {restaurant.name}
          </h1>
          <p className="text-[#1A1A1A] text-sm mb-6 font-medium">
            This digital menu is temporarily updating. Please ask your server or check back shortly.
          </p>
          <button
            onClick={onOpenAdmin}
            className="text-xs text-[#080808] font-bold hover:underline inline-flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Staff Management Access
          </button>
        </div>
      </div>
    );
  }

  // Filter categories by meal time tab (excluding removed ice_cream)
  const filteredCategories = useMemo(() => {
    let list = categories.filter((c) => c.meal_time !== 'ice_cream' && c.id !== 'cat_ice_cream');
    if (selectedMealTime !== 'all') {
      if (selectedMealTime === 'drinks' || selectedMealTime === 'all_day') {
        list = list.filter((c) => c.meal_time === 'drinks' || c.meal_time === 'all_day');
      } else if (selectedMealTime === 'breakfast') {
        list = list.filter((c) => c.meal_time === 'breakfast');
      } else if (
        selectedMealTime === 'lunch_dinner' ||
        selectedMealTime === 'lunch' ||
        selectedMealTime === 'dinner'
      ) {
        list = list.filter(
          (c) =>
            c.meal_time === 'lunch_dinner' ||
            c.meal_time === 'lunch' ||
            c.meal_time === 'dinner' ||
            c.id === 'cat_launch' ||
            c.id === 'cat_lunch_mains' ||
            c.id === 'cat_pizza' ||
            c.id === 'cat_pasta' ||
            c.id === 'cat_dinner_specialties'
        );
      }
    }
    return [...list].sort((a, b) => a.display_order - b.display_order);
  }, [categories, selectedMealTime]);

  // Filter items based on active categories and search query
  const itemsByCategory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const map = new Map<string, MenuItem[]>();

    for (const cat of filteredCategories) {
      const catItems = items
        .filter((i) => i.category_id === cat.id && i.category_id !== 'cat_ice_cream' && !i.id.startsWith('ice_'))
        .filter((i) => {
          if (!q) return true;
          return (
            i.name.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => a.display_order - b.display_order);

      if (catItems.length > 0 || !q) {
        map.set(cat.id, catItems);
      }
    }

    return map;
  }, [filteredCategories, items, searchQuery]);

  // Main Categories tabs arranged in sequence
  const mealTimeTabs = [
    { id: 'all', label: 'Full Menu', sub: 'Everything', icon: Sparkles },
    { id: 'breakfast', label: 'Break Fast', sub: '8:30 AM – 12 PM', icon: null },
    { id: 'lunch_dinner', label: 'Launch & Mains', sub: 'Launch, Burger & Pizza', icon: UtensilsCrossed },
    { id: 'drinks', label: 'Drinks', sub: 'Hot Drink, Juice & Mojito', icon: Coffee },
  ] as const;

  return (
    <div className="min-h-screen bg-[#D4AF37] bg-gold-canvas text-[#080808] pb-20 selection:bg-[#080808] selection:text-[#FCF6BA]">
      {/* Top Luxury Dominant Golden & Minor Black Header Bar */}
      <header className="sticky top-0 z-30 bg-[#E6C55A]/95 backdrop-blur-md border-b border-[#080808]/30 px-4 sm:px-6 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo size="sm" customLogoUrl={restaurant.logo_url} />
          </div>

          <div className="flex items-center gap-2">
            {onOpenPhotoEnhancer && (
              <button
                onClick={onOpenPhotoEnhancer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#080808] hover:bg-[#1A1A1A] text-[#D4AF37] border border-[#080808] transition-all shadow-sm"
                title="Upload your original named dish & drink photos with studio quality enhancement and zero ingredient changes"
              >
                <Camera className="w-4 h-4 text-[#D4AF37]" />
                <span>Upload Original Photos</span>
              </button>
            )}
            {onOpenVipAccess && (
              <button
                onClick={onOpenVipAccess}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA771C] text-[#0A0A0A] border border-[#080808]/40 shadow-md hover:brightness-110 active:scale-95 transition-all"
                title="Access Exclusive VIP Table Service with Waiter Call"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>VIP Table</span>
              </button>
            )}
            <button
              onClick={onOpenQR}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#080808] hover:bg-[#1A1A1A] text-[#FCF6BA] border border-[#080808] transition-all shadow-sm"
              title="View & share permanent QR code"
            >
              <QrCode className="w-4 h-4 text-[#D4AF37]" />
              <span className="hidden sm:inline">Table QR</span>
            </button>
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg text-[#080808] hover:text-[#FCF6BA] hover:bg-[#080808] border border-[#080808]/35 transition-all"
              title="Staff admin login"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Staff Access</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Wall & Provided Logo Only Banner (No descriptions, name, location, or time underneath) */}
      <div className="relative bg-[#070809] border-b border-[#080808]/35 overflow-hidden">
        <div className="relative h-64 sm:h-80 w-full bg-[#070809] flex items-center justify-center">
          <img
            src={heroCoverUrl}
            alt={`${restaurant.name} Wall and Logo`}
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            className="w-full h-full object-contain sm:object-cover object-center"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.includes('/assets/images/')) {
                const filename = target.src.split('/').pop()?.split('?')[0];
                if (filename) {
                  target.src = `/api/images/${filename}`;
                  return;
                }
              }
            }}
          />

          {onOpenLogoCropper && (
            <button
              onClick={onOpenLogoCropper}
              className="absolute top-3 right-4 z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#080808]/90 hover:bg-[#141414] text-[#FCF6BA] border border-[#D4AF37]/60 text-[11px] font-bold backdrop-blur-md shadow-lg transition-all cursor-pointer"
              title="Upload your confidential cafe photo and crop out background people & cafe (Wall & Logo only)"
            >
              <Crop className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Use / Crop Provided Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* Sticky Section Tabs & Search */}
      <div className="sticky top-[64px] z-20 bg-[#DEC05B]/95 backdrop-blur-md border-b border-[#080808]/25 px-4 sm:px-6 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
          {/* Meal Time Segmented Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {mealTimeTabs.map((tab) => {
              const isActive = selectedMealTime === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMealTime(tab.id)}
                  className={`relative shrink-0 px-3.5 py-2 rounded-xl text-xs transition-all duration-150 flex flex-col items-center justify-center min-w-[82px] border whitespace-nowrap ${
                    isActive
                      ? 'bg-[#080808] text-[#FCF6BA] font-extrabold border-[#080808] shadow-[0_4px_14px_rgba(0,0,0,0.35)]'
                      : 'bg-[#F7E6A2] text-[#080808] font-bold hover:bg-[#080808]/15 border-[#080808]/35'
                  }`}
                >
                  <span className="leading-tight flex items-center gap-1">
                    {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                    {tab.label}
                  </span>
                  <span
                    className={`text-[9px] mt-0.5 font-normal ${
                      isActive ? 'text-[#D4AF37] font-semibold' : 'text-[#1A1A1A]/85 font-medium'
                    }`}
                  >
                    {tab.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#080808] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food, coffees, juices, mojitos..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-[#F7E6A2] border border-[#080808]/40 rounded-lg text-[#080808] font-medium placeholder-[#1A1A1A]/70 focus:outline-hidden focus:border-[#080808] focus:ring-1 focus:ring-[#080808] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#080808]/75 hover:text-[#080808]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Menu Body */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">

        {/* Empty States */}
        {categories.length === 0 ? (
          <div className="text-center py-16 text-[#1A1A1A]">
            <p className="text-base font-semibold">Menu coming soon.</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-16 text-[#1A1A1A]">
            <p className="text-base font-semibold">No items available in this section.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((category) => {
              const catItems = itemsByCategory.get(category.id) || [];
              if (catItems.length === 0 && searchQuery) {
                return null;
              }

              return (
                <section key={category.id} id={category.id} className="scroll-mt-36">
                  {/* Category Header */}
                  <div className="flex items-baseline justify-between border-b-2 border-[#080808]/35 pb-2 mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#080808] font-display">
                        {category.name}
                      </h2>
                      <span className="text-xs text-[#1A1A1A] font-bold tabular-nums">
                        ({catItems.length})
                      </span>
                    </div>

                    <span className="text-[11px] text-[#080808] uppercase tracking-wider font-extrabold">
                      {category.meal_time === 'ice_cream'
                        ? 'Gelateria'
                        : category.meal_time === 'drinks' || category.meal_time === 'all_day'
                        ? 'Drinks'
                        : category.meal_time === 'lunch_dinner' ||
                          category.meal_time === 'lunch' ||
                          category.meal_time === 'dinner'
                        ? 'Lunch & Dinner'
                        : category.meal_time}
                    </span>
                  </div>

                  {/* Items List */}
                  {catItems.length === 0 ? (
                    <p className="text-xs text-[#1A1A1A] italic py-2 font-medium">
                      No items currently listed in this section.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
                      {catItems.map((item) => (
                        <ItemCard
                          key={item.id}
                          item={item}
                          onClick={() => {
                            setSelectedItem(item);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Item Detail Modal (No Price Tags) */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-gold-surface border-2 border-[#080808] w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col text-[#080808]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image or Clean Placeholder */}
            {selectedItem.image_url ? (
              <div className="relative h-60 w-full bg-[#080808]">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('/assets/images/')) {
                      const filename = target.src.split('/').pop()?.split('?')[0];
                      if (filename) {
                        target.src = `/api/images/${filename}`;
                      }
                    }
                  }}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-[#080808] text-[#FCF6BA] border border-[#D4AF37]/50 hover:bg-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="p-6 bg-[#E5C158] border-b border-[#080808]/35 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-[#080808]">
                  <Camera className="w-4 h-4 text-[#080808]" />
                  <span className="font-bold uppercase tracking-wider text-[11px]">
                    {restaurant.name} Specialty · Kitchen Crafted
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-full bg-[#080808] text-[#FCF6BA] border border-[#080808] hover:bg-[#1A1A1A] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Modal Details */}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#080808]">
                  {selectedItem.name}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-[#1A1A1A] font-semibold">
                {selectedItem.is_available ? (
                  <span className="inline-flex items-center gap-1 text-[#080808] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#080808]" /> Available today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[#080808] font-bold">
                    Not available today
                  </span>
                )}

                {selectedItem.is_spicy && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#080808] font-bold">
                      <Flame className="w-3.5 h-3.5 text-[#080808]" /> Seasoned Dish
                    </span>
                  </>
                )}

                {selectedItem.available_from && selectedItem.available_until && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-[#080808]">
                      <Clock className="w-3.5 h-3.5 text-[#080808]" />
                      Served {selectedItem.available_from} – {selectedItem.available_until}
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm text-[#111111] font-medium leading-relaxed mb-6">
                {selectedItem.description}
              </p>

              {selectedItem.transcription_note && (
                <div className="p-3 bg-[#F7E6A2] rounded-lg border border-[#080808]/35 mb-4 text-xs text-[#1A1A1A]">
                  <span className="font-bold text-[#080808] block mb-0.5">
                    Menu Board Note:
                  </span>
                  {selectedItem.transcription_note}
                </div>
              )}

              <div className="pt-4 border-t border-[#080808]/30 flex items-center justify-between">
                <span className="text-xs text-[#1A1A1A] font-medium">
                  Ask your server for pairings or dietary inquiries.
                </span>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-5 py-2.5 bg-[#080808] text-[#FCF6BA] text-xs font-bold rounded-lg hover:bg-[#1A1A1A] transition-all shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location & Directions Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 mt-14 mb-4">
        <div className="bg-gold-surface border-2 border-[#080808]/40 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#080808] font-extrabold uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-[#080808]" />
              <span>Location &amp; Directions</span>
            </div>
            <h3 className="text-xl font-extrabold text-[#080808] font-display">
              Visit {restaurant.name}
            </h3>
            <p className="text-sm text-[#111111] font-semibold">
              {restaurant.address || 'Jijiga, Ethiopia'}
            </p>
            {restaurant.opening_hours && (
              <p className="text-xs text-[#1A1A1A] font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#080808]" />
                <span>{restaurant.opening_hours}</span>
              </p>
            )}
          </div>

          <a
            href={restaurant.google_maps_url || 'https://maps.app.goo.gl/Tnb9gLs98u4fihhC9'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#080808] text-[#FCF6BA] font-extrabold text-xs shadow-[0_4px_16px_rgba(0,0,0,0.3)] hover:bg-[#1A1A1A] transition-all whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 text-[#D4AF37]" />
            Get Directions
          </a>
        </div>
      </section>

      {/* Modern Luxury Dominant Golden & Minor Black Footer */}
      <footer className="mt-16 border-t-2 border-[#080808]/30 bg-[#C59B27] py-10 px-4 text-center text-xs text-[#080808]">
        <div className="max-w-md mx-auto space-y-3">
          <BrandLogo size="md" customLogoUrl={restaurant.logo_url} className="justify-center" />
          <p className="text-[#111111] font-semibold leading-relaxed">
            Contemporary Coffee Lounge · Gourmet Restaurant
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-[#080808] font-bold">
            {onOpenVipAccess && (
              <>
                <button
                  onClick={onOpenVipAccess}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer font-black text-black"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>VIP Table Service</span>
                </button>
                <span>·</span>
              </>
            )}
            {onOpenWaiterApp && (
              <>
                <button
                  onClick={onOpenWaiterApp}
                  className="inline-flex items-center gap-1 hover:underline cursor-pointer font-black text-black"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Waiter Mobile App</span>
                </button>
                <span>·</span>
              </>
            )}
            <button
              onClick={onOpenAdmin}
              className="text-[#080808] hover:underline cursor-pointer font-extrabold"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
