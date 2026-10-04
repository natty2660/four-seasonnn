import { Capacitor } from '@capacitor/core';

const SERVER_URL_KEY = 'four_season_server_url';

export function getServerBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem(SERVER_URL_KEY);
  if (stored && stored.trim()) {
    return stored.trim().replace(/\/$/, '');
  }

  // If on native device (Capacitor) and loaded from local assets (localhost)
  if (Capacitor.isNativePlatform()) {
    // Default fallback host if none entered
    return 'http://10.0.2.2:3000';
  }

  return window.location.origin;
}

export function setServerBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const clean = url.trim().replace(/\/$/, '');
  localStorage.setItem(SERVER_URL_KEY, clean);
}

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (Capacitor.isNativePlatform()) {
    const base = getServerBaseUrl();
    if (base && !cleanEndpoint.startsWith('http')) {
      return `${base}${cleanEndpoint}`;
    }
  }

  return cleanEndpoint;
}
