export interface VipSession {
  tableId: string;
  tableNumber: string;
  activatedAt: number; // timestamp in ms
  expiresAt: number;   // timestamp in ms (activatedAt + 4 hours)
}

export const VIP_SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 Hours in milliseconds

const SESSION_PREFIX = 'four_season_vip_session_';
const ACTIVE_TABLE_KEY = 'four_season_active_vip_table';

/**
 * Start or renew a 4-hour VIP session for a specific table
 */
export function startVipSession(tableId: string, tableNumber: string): VipSession {
  const now = Date.now();
  const session: VipSession = {
    tableId,
    tableNumber,
    activatedAt: now,
    expiresAt: now + VIP_SESSION_DURATION_MS,
  };

  try {
    localStorage.setItem(`${SESSION_PREFIX}${tableId}`, JSON.stringify(session));
    localStorage.setItem(ACTIVE_TABLE_KEY, tableId);
    sessionStorage.setItem('four_season_vip_access_table', tableId);
    sessionStorage.setItem(`vip_active_${tableId}`, String(now));
  } catch {
    // LocalStorage fallback handled in memory if cookies blocked
  }

  return session;
}

/**
 * Ensures or retrieves the existing VIP session without resetting the timer on refresh.
 * If a session already exists (even if page reloaded), preserves the original activatedAt and expiresAt.
 * Only if NO session exists in storage, creates a fresh 4-hour session.
 */
export function ensureVipSession(tableId: string, tableNumber: string): VipSession {
  const existing = getVipSession(tableId);
  if (existing) {
    return existing;
  }
  return startVipSession(tableId, tableNumber);
}

/**
 * Get the current VIP session for a table
 */
export function getVipSession(tableId: string): VipSession | null {
  try {
    const raw = localStorage.getItem(`${SESSION_PREFIX}${tableId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VipSession;
    if (parsed && typeof parsed.expiresAt === 'number') {
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Check if the VIP session for a table is valid and unexpired
 */
export function isVipSessionValid(tableId: string): boolean {
  const session = getVipSession(tableId);
  if (!session) return false;
  return Date.now() < session.expiresAt;
}

/**
 * Get remaining milliseconds for the session
 */
export function getRemainingVipTime(tableId: string): number {
  const session = getVipSession(tableId);
  if (!session) return 0;
  return Math.max(0, session.expiresAt - Date.now());
}

/**
 * Format milliseconds into human-readable format: "3h 45m" or "45m 12s"
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0m (Expired)';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Clear/expire VIP session for a table
 */
export function clearVipSession(tableId: string): void {
  try {
    localStorage.removeItem(`${SESSION_PREFIX}${tableId}`);
    if (localStorage.getItem(ACTIVE_TABLE_KEY) === tableId) {
      localStorage.removeItem(ACTIVE_TABLE_KEY);
    }
    sessionStorage.removeItem('four_season_vip_access_table');
    sessionStorage.removeItem(`vip_active_${tableId}`);
  } catch {
    // Ignore error
  }
}
