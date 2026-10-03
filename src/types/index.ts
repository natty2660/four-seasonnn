export type MealTime =
  | 'all'
  | 'ice_cream'
  | 'drinks'
  | 'breakfast'
  | 'lunch_dinner'
  | 'lunch'
  | 'dinner'
  | 'all_day';

export interface MenuItemSize {
  name: string;
  price?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone?: string;
  address?: string;
  google_maps_url?: string;
  opening_hours?: string;
  wifi_available?: boolean;
  logo_url: string;
  cover_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  meal_time: MealTime;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price?: number;
  image_url: string;
  is_available: boolean;
  display_order: number;
  available_from?: string | null; // e.g. "07:00"
  available_until?: string | null; // e.g. "11:30"
  is_spicy?: boolean;
  is_popular?: boolean;
  is_local_specialty?: boolean;
  sizes?: MenuItemSize[];
  transcription_note?: string; // Flagged spelling or owner confirmation note
  created_at: string;
  updated_at: string;
}

export interface MenuResponse {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  generated_at: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
}
