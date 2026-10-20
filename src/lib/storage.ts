import { Restaurant, Category, MenuItem, MenuResponse, MealTime, VipTable, Waiter, WaiterCall } from '../types/index.ts';
import { PRIME_CAFE_RESTAURANT, SEED_CATEGORIES, SEED_MENU_ITEMS } from '../data/seedData.ts';

const STORAGE_KEY = 'four_season_cafe_store_v29';

export const INITIAL_WAITERS: Waiter[] = [
  {
    id: 'waiter_reservation',
    name: 'VIP Reservation Desk',
    pin: '1234',
    phone: '+251 91 100 0000',
    is_on_duty: true,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export const INITIAL_VIP_TABLES: VipTable[] = [
  {
    id: 'vip_1',
    table_number: 'VIP-1',
    name: 'Royal Gold Suite',
    secret_code: '7771',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Primary luxury banquet suite near private water fountain',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_2',
    table_number: 'VIP-2',
    name: 'Executive Lounge',
    secret_code: '7772',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Handcrafted leather booths with privacy partition',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_3',
    table_number: 'VIP-3',
    name: 'Diplomatic Terrace',
    secret_code: '7773',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Open outdoor VIP gazebo with garden panorama',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_4',
    table_number: 'VIP-4',
    name: 'Penthouse Salon',
    secret_code: '7774',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Panoramic top-floor view dining salon',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_5',
    table_number: 'VIP-5',
    name: 'Imperial Chamber',
    secret_code: '7775',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Private state room with royal velvet upholstery',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_6',
    table_number: 'VIP-6',
    name: 'Sapphire Room',
    secret_code: '7776',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Intimate sapphire-accented booth with soft illumination',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_7',
    table_number: 'VIP-7',
    name: 'Emerald Pavilion',
    secret_code: '7777',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Lush indoor flora setting with ambient water feature',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_8',
    table_number: 'VIP-8',
    name: 'Diamond Alcove',
    secret_code: '7778',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Secluded corner alcove for private business conversations',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_9',
    table_number: 'VIP-9',
    name: 'Amber Sanctuary',
    secret_code: '7779',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Warm amber lighting with bespoke mahogany furnishings',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_10',
    table_number: 'VIP-10',
    name: 'Ruby Gallery',
    secret_code: '7780',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Artisan fine-art wall gallery view table',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_11',
    table_number: 'VIP-11',
    name: 'Crown Enclave',
    secret_code: '7781',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Elevated central enclave with dedicated service access',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_12',
    table_number: 'VIP-12',
    name: 'Sultan Majlis',
    secret_code: '7782',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Traditional high-comfort luxury Majlis lounge',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_13',
    table_number: 'VIP-13',
    name: 'Sovereign Haven',
    secret_code: '7783',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Private lounge booth with acoustic sound shielding',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_14',
    table_number: 'VIP-14',
    name: 'Grand Terrace',
    secret_code: '7784',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Spacious open-air veranda table for distinguished parties',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_15',
    table_number: 'VIP-15',
    name: 'Golden Vista',
    secret_code: '7785',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Sunset-facing glass facade with golden horizon views',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_16',
    table_number: 'VIP-16',
    name: 'Oasis Lounge',
    secret_code: '7786',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Calm water-garden surrounding with shaded canopy',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_17',
    table_number: 'VIP-17',
    name: 'Presidential Parlor',
    secret_code: '7787',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Full-service presidential conference and dining salon',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_18',
    table_number: 'VIP-18',
    name: 'Prestige Corner',
    secret_code: '7788',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Cozy VIP corner with private beverage service',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_19',
    table_number: 'VIP-19',
    name: 'Palace Veranda',
    secret_code: '7789',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Majestic exterior veranda overlooking Four Season gardens',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_20',
    table_number: 'VIP-20',
    name: 'Celestial Balcony',
    secret_code: '7790',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Upper deck starlight balcony with heated patio amenities',
    created_at: new Date().toISOString(),
  },
  {
    id: 'vip_21',
    table_number: 'VIP-21',
    name: 'Prime Sky Suite',
    secret_code: '7791',
    assigned_waiter_id: 'waiter_reservation',
    is_active: true,
    notes: 'Top-tier pinnacle penthouse suite with dedicated hospitality',
    created_at: new Date().toISOString(),
  },
];

export interface DatabaseState {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  vip_tables: VipTable[];
  waiters: Waiter[];
  waiter_calls: WaiterCall[];
  last_updated: string;
  admin_password?: string;
}

export function getInitialState(): DatabaseState {
  return {
    restaurant: { ...PRIME_CAFE_RESTAURANT },
    categories: [...SEED_CATEGORIES],
    items: SEED_MENU_ITEMS.map(({ price: _p, sizes: _s, ...rest }) => ({ ...rest })),
    vip_tables: [...INITIAL_VIP_TABLES],
    waiters: [...INITIAL_WAITERS],
    waiter_calls: [],
    last_updated: new Date().toISOString(),
  };
}

export function loadClientState(): DatabaseState {
  if (typeof window === 'undefined') {
    return getInitialState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      saveClientState(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as DatabaseState;
    if (!parsed.restaurant || !Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
      const initial = getInitialState();
      saveClientState(initial);
      return initial;
    }
    if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      parsed.categories = [...SEED_CATEGORIES];
    }
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      parsed.items = SEED_MENU_ITEMS.map(({ price: _p, sizes: _s, ...rest }) => ({ ...rest }));
    }

    // Ensure VIP tables, waiters, and calls exist
    if (!Array.isArray(parsed.vip_tables)) {
      parsed.vip_tables = [...INITIAL_VIP_TABLES];
    }
    if (!Array.isArray(parsed.waiters)) {
      parsed.waiters = [...INITIAL_WAITERS];
    }
    if (!Array.isArray(parsed.waiter_calls)) {
      parsed.waiter_calls = [];
    }

    return parsed;
  } catch (e) {
    console.warn('Failed reading client state, using fallback:', e);
    return getInitialState();
  }
}

export function saveClientState(state: DatabaseState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (Array.isArray(state.waiter_calls)) {
      import('./callSync.js').then(({ broadcastLiveCallUpdate }) => {
        broadcastLiveCallUpdate(state.waiter_calls);
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed saving client state to localStorage:', e);
  }
}

// Format prices strictly in Ethiopian Birr whole integers
export function formatBirr(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 Birr';
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('en-US')} Birr`;
}

// Validate price inputs: integer Birr only, > 0, <= 100000
export function validateBirrPrice(value: string | number): { valid: boolean; value: number; error?: string } {
  const num = typeof value === 'string' ? Number(value.trim()) : value;
  if (isNaN(num)) {
    return { valid: false, value: 0, error: 'Price must be a valid number in Ethiopian Birr.' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, value: Math.round(num), error: 'Price must be a whole integer in Birr (no decimals).' };
  }
  if (num <= 0) {
    return { valid: false, value: num, error: 'Price must be greater than zero Birr.' };
  }
  if (num > 100000) {
    return { valid: false, value: num, error: 'Price cannot exceed 100,000 Birr.' };
  }
  return { valid: true, value: num };
}

// Meal time detector: defaults to 'all' (Full Menu) as requested
export function getSuggestedMealTime(_date = new Date()): MealTime {
  return 'all';
}

// Generate menu response for a given slug
export function buildMenuResponse(state: DatabaseState, slug = 'prime-cafe'): MenuResponse | null {
  const normalizedSlug = (slug || '').toLowerCase().trim();
  const restSlug = (state.restaurant.slug || '').toLowerCase().trim();
  const validSlugs = new Set([restSlug, 'prime-cafe', 'four-season', 'four-season-cafe', 'fourseason', 'menu', 'default']);
  if (!validSlugs.has(normalizedSlug) && state.restaurant.slug !== slug) {
    return null;
  }

  // Sort categories by display_order
  const sortedCategories = [...state.categories].sort((a, b) => a.display_order - b.display_order);

  // Sort items by display_order
  const sortedItems = [...state.items].sort((a, b) => a.display_order - b.display_order);

  return {
    restaurant: state.restaurant,
    categories: sortedCategories,
    items: sortedItems,
    generated_at: new Date().toISOString(),
  };
}
