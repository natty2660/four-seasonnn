export type MealTime =
  | 'all'
  | 'ice_cream'
  | 'drinks'
  | 'breakfast'
  | 'lunch_dinner'
  | 'lunch'
  | 'fast_food'
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

export type CallType = 'general' | 'order' | 'water' | 'bill' | 'urgent';
export type CallStatus = 'pending' | 'accepted' | 'completed' | 'cancelled' | 'hold' | 'missed';

export type CallPriorityLevel = 1 | 2 | 3 | 4 | 5;

export interface PriorityInfo {
  rank: CallPriorityLevel;
  code: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  title: string;
  weight: number;
  badgeClass: string;
  cardBorderClass: string;
  glowClass: string;
}

export const CALL_PRIORITY_MAP: Record<CallType, PriorityInfo> = {
  urgent: {
    rank: 1,
    code: 'P1',
    title: 'Urgent',
    weight: 500,
    badgeClass: 'bg-red-500/25 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20',
    cardBorderClass: 'border-red-500/90 from-red-950/90 via-[#2a0c0c] to-red-900/60 shadow-red-900/50',
    glowClass: 'text-red-400',
  },
  bill: {
    rank: 2,
    code: 'P2',
    title: 'Bill / Payment',
    weight: 400,
    badgeClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20',
    cardBorderClass: 'border-emerald-500/80 from-emerald-950/80 via-[#0e2417] to-emerald-900/50 shadow-emerald-900/40',
    glowClass: 'text-emerald-400',
  },
  order: {
    rank: 3,
    code: 'P3',
    title: 'Order Request',
    weight: 300,
    badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20',
    cardBorderClass: 'border-amber-500/80 from-amber-950/80 via-[#241708] to-amber-900/50 shadow-amber-900/40',
    glowClass: 'text-amber-400',
  },
  water: {
    rank: 4,
    code: 'P4',
    title: 'Water / Refill',
    weight: 200,
    badgeClass: 'bg-sky-500/25 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/20',
    cardBorderClass: 'border-sky-500/70 from-sky-950/70 via-[#081e2b] to-sky-900/40 shadow-sky-900/40',
    glowClass: 'text-sky-400',
  },
  general: {
    rank: 5,
    code: 'P5',
    title: 'General Call',
    weight: 100,
    badgeClass: 'bg-[#D4AF37]/25 text-[#FCF6BA] border-[#D4AF37]/50 shadow-sm shadow-[#D4AF37]/20',
    cardBorderClass: 'border-[#D4AF37]/70 from-[#211a0c] via-[#1a1408] to-[#120f06] shadow-amber-950/40',
    glowClass: 'text-[#FCF6BA]',
  },
};

export const getCallPriorityWeight = (type?: string | null): number => {
  if (!type) return 100;
  const key = type.toLowerCase() as CallType;
  return CALL_PRIORITY_MAP[key]?.weight || 100;
};

export interface VipTable {
  id: string;
  table_number: string; // e.g. "VIP-1"
  name: string; // e.g. "Executive Lounge"
  secret_code?: string; // Optional VIP access pin/code for high privacy
  assigned_waiter_id?: string | null; // Responsible waiter id
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface Waiter {
  id: string;
  name: string;
  pin?: string;
  phone?: string;
  is_on_duty: boolean;
  is_active: boolean;
  created_at: string;
}

export interface WaiterCall {
  id: string;
  table_id: string;
  table_number: string;
  table_name: string;
  call_type: CallType;
  message?: string;
  status: CallStatus;
  assigned_waiter_id?: string | null; // The assigned responsible waiter when call was placed
  accepted_by_waiter_id?: string | null; // Waiter who actually accepted the call
  accepted_by_name?: string | null;
  is_escalated?: boolean; // True if unanswered for 45s and escalated to all waiters
  escalated_at?: string | null;
  original_waiter_id?: string | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  held_at?: string | null;
  hold_reason?: string | null;
  missed_at?: string | null;
}
