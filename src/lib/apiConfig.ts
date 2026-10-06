import { Capacitor } from '@capacitor/core';

// ONE authoritative production backend URL across the entire project
export const PRODUCTION_BACKEND_URL =
  'https://ais-dev-ci7h2qy5u3hn6xucauliww-11082165761.europe-west2.run.app';

const SERVER_URL_KEY = 'four_season_server_url';

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
    if (trimmed.includes('10.0.2.2') || trimmed.includes('127.0.0.1')) {
      localStorage.removeItem(SERVER_URL_KEY);
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.replace(/\/$/, '');
    }
  }

  // Native Capacitor Android APK always defaults to authoritative production backend
  if (Capacitor.isNativePlatform()) {
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

  if (Capacitor.isNativePlatform()) {
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
