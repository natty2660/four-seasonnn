import { Capacitor } from '@capacitor/core';

// ONE authoritative production backend URL across the entire project
export const PRODUCTION_BACKEND_URL = 'https://four-seasonnn.vercel.app';

const SERVER_URL_KEY = 'four_season_server_url';

/**
 * Bulletproof native platform detector.
 * Returns true if running inside the Capacitor Android/iOS application.
 * Returns false when accessed via standard web browser.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Official Capacitor isNativePlatform
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') return true;
  } catch {}

  // 2. Window Capacitor object or bridge
  const win = window as any;
  if (win.Capacitor) {
    try {
      if (typeof win.Capacitor.isNativePlatform === 'function' && win.Capacitor.isNativePlatform()) {
        return true;
      }
      if (typeof win.Capacitor.getPlatform === 'function' && win.Capacitor.getPlatform() !== 'web') {
        return true;
      }
      if (win.Capacitor.platform && win.Capacitor.platform !== 'web') {
        return true;
      }
    } catch {}
  }

  // 3. Android WebView bridge injected by Capacitor or native MainActivity
  if (win.androidBridge != null || win.AndroidNativeApp != null || win._capacitor != null) {
    return true;
  }

  // 4. iOS WebKit bridge
  if (win.webkit?.messageHandlers?.bridge != null) {
    return true;
  }

  // 5. Native protocols
  const protocol = window.location.protocol;
  if (protocol === 'capacitor:' || protocol === 'ionic:') {
    return true;
  }

  // 6. Running on localhost inside Android WebView (Capacitor serves dist at https://localhost with no port)
  // Local Vite development runs strictly on port 3000.
  const hostname = window.location.hostname;
  const port = window.location.port;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // If not on dev port 3000, it is 100% running inside the Capacitor Android APK
    if (port !== '3000') {
      return true;
    }
  }

  return false;
}

/**
 * Returns the authoritative server base URL.
 * Physical Android APK connects directly to PRODUCTION_BACKEND_URL.
 * Browser connects to current origin.
 */
export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_BACKEND_URL;

  // Retrieve stored URL if any
  const stored = localStorage.getItem(SERVER_URL_KEY);
  if (stored) {
    const trimmed = stored.trim();
    // Invalidate legacy emulator loopback URLs that fail on physical devices
    if (trimmed.includes('10.0.2.2') || trimmed.includes('127.0.0.1') || trimmed.includes('localhost')) {
      localStorage.removeItem(SERVER_URL_KEY);
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.replace(/\/$/, '');
    }
  }

  // Native Capacitor Android APK always connects to authoritative production backend
  const isCapacitorLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
    window.location.port !== '3000';

  if (isNativeApp() || isCapacitorLocal) {
    return PRODUCTION_BACKEND_URL;
  }

  // In standard browser environment, use window.location.origin
  if (window.location && window.location.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }

  return PRODUCTION_BACKEND_URL;
}

export function setServerBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/$/, '');
  if (clean && !clean.includes('10.0.2.2')) {
    localStorage.setItem(SERVER_URL_KEY, clean);
  }
}

/**
 * Converts any relative API endpoint (e.g. '/api/waiter-calls') into an authoritative URL.
 * In native Capacitor APK, prefixes with PRODUCTION_BACKEND_URL.
 * In browser, preserves relative path so dev server/proxy works seamlessly.
 */
export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
    return cleanEndpoint;
  }

  if (isNativeApp()) {
    const base = getServerBaseUrl();
    return `${base}${cleanEndpoint}`;
  }

  return cleanEndpoint;
}

/**
 * Centralized API fetch helper that routes requests to the authoritative backend.
 */
export async function apiFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const url = getApiUrl(endpoint);
  return fetch(url, init);
}

// Alias helper
export const api = apiFetch;
