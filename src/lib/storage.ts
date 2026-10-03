import { Restaurant, Category, MenuItem, MenuResponse, MealTime } from '../types/index.ts';
import { PRIME_CAFE_RESTAURANT, SEED_CATEGORIES, SEED_MENU_ITEMS } from '../data/seedData.ts';

const STORAGE_KEY = 'four_season_cafe_store_v19';

export interface DatabaseState {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  last_updated: string;
  admin_password?: string;
}

export function getInitialState(): DatabaseState {
  return {
    restaurant: { ...PRIME_CAFE_RESTAURANT },
    categories: [...SEED_CATEGORIES],
    items: SEED_MENU_ITEMS.map(({ price: _p, sizes: _s, ...rest }) => ({ ...rest })),
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
    const validIds = new Set(SEED_MENU_ITEMS.map((i) => i.id));
    parsed.categories = [...SEED_CATEGORIES];
    parsed.items = parsed.items
      .filter((i) => validIds.has(i.id) || i.id.startsWith('item_'))
      .map(({ price: _p, sizes: _s, ...rest }) => ({ ...rest }));
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
  if (state.restaurant.slug !== slug) {
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
